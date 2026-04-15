/**
 * 认证服务（Service 层）
 *
 * 考点：
 * - 分层架构：Service 层职责（业务逻辑）
 * - 安全架构：JWT 双 Token 策略（Access Token + Refresh Token）
 * - 密码安全：bcrypt 哈希算法
 * - 设计模式：模板方法模式（登录/注册流程的步骤固定）
 *
 * 架构约束：
 * Service 层通过 Repository 接口访问数据，禁止直接使用 Prisma Client
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import type { UserRepository } from '../repositories/user.repository.js';
import { logger } from '@toollab/shared-logger';
import type { UserRole } from '@toollab/shared-types';

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
  };
}

interface RegisterResult {
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
  };
}

interface RefreshResult {
  accessToken: string;
}

// ─── 服务类 ────────────────────────────────────────────────────────────────────

export class AuthService {
  /**
   * bcrypt 成本因子（cost factor）
   * 值越高，哈希越慢（指数级），越难被暴力破解
   * 12 = 约 250ms/次（在普通服务器上），是安全与性能的平衡点
   *
   * 考点：密码哈希算法选择 — bcrypt vs Argon2 vs SHA-256
   * MD5/SHA-256 速度太快（易被 GPU 暴力破解），bcrypt/Argon2 专为密码设计
   */
  private static readonly BCRYPT_ROUNDS = 12;

  /** Access Token 有效期（15 分钟）— 短期令牌，降低泄露风险 */
  private static readonly ACCESS_TOKEN_EXPIRES = '15m';

  /** Refresh Token 有效期（7 天）— 长期令牌，用于刷新 Access Token */
  private static readonly REFRESH_TOKEN_EXPIRES = '7d';

  constructor(private readonly userRepository: UserRepository) {}

  /**
   * 用户登录
   *
   * 安全考虑：
   * 1. 无论邮箱是否存在，都执行 bcrypt.compare（防止时序攻击）
   * 2. 错误信息不区分"邮箱不存在"和"密码错误"（防止用户枚举）
   */
  async login(email: string, password: string): Promise<LoginResult> {
    logger.info({ message: '用户尝试登录', email });

    // 查询用户（通过 Repository 层）
    const user = await this.userRepository.findByEmail(email);

    // 使用常量时间比较，防止时序攻击（Timing Attack）
    // 即使用户不存在，也执行 bcrypt.compare，避免通过响应时间推断用户是否存在
    const dummyHash = '$2b$12$dummy.hash.for.timing.attack.prevention.only';
    const passwordToCompare = user?.passwordHash ?? dummyHash;
    const isPasswordValid = await bcrypt.compare(password, passwordToCompare);

    if (!user || !isPasswordValid) {
      logger.warn({ message: '登录失败：凭证无效', email });
      throw new Error('INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      logger.warn({ message: '登录失败：账户已禁用', userId: user.id });
      throw new Error('ACCOUNT_DISABLED');
    }

    // 生成双 Token
    const { accessToken, refreshToken } = this.generateTokenPair(user.id, user.email, user.role);

    // 持久化 Refresh Token（支持撤销）
    await this.userRepository.saveRefreshToken(user.id, refreshToken);

    logger.info({ message: '用户登录成功', userId: user.id });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    };
  }

  /**
   * 用户注册
   *
   * 安全考虑：
   * 1. 密码在 Service 层哈希，Repository 层只存哈希值，永不存明文
   * 2. 注册时不自动登录（需要额外的登录步骤），防止邮件未验证就获得权限
   */
  async register(email: string, username: string, password: string): Promise<RegisterResult> {
    logger.info({ message: '用户尝试注册', email, username });

    // 检查邮箱是否已存在
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      logger.warn({ message: '注册失败：邮箱已存在', email });
      throw new Error('EMAIL_EXISTS');
    }

    // 密码哈希（bcrypt 自带盐值，防止彩虹表攻击）
    // 考点：密码加盐（Salting）— bcrypt 自动生成随机盐值并包含在哈希中
    const passwordHash = await bcrypt.hash(password, AuthService.BCRYPT_ROUNDS);

    // 创建用户（通过 Repository 层，传入哈希后的密码）
    const newUser = await this.userRepository.create({
      email,
      username,
      passwordHash, // 安全规则：永远不存储明文密码
      role: 'USER',
    });

    logger.info({ message: '用户注册成功', userId: newUser.id });

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role,
      },
    };
  }

  /**
   * 刷新 Access Token
   *
   * 考点：双 Token 策略的安全设计
   * - Refresh Token 用于换取新的 Access Token
   * - 每次刷新后，旧的 Refresh Token 失效（Token Rotation）
   */
  async refreshToken(refreshToken: string): Promise<RefreshResult> {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error('JWT_SECRET 未配置');

    try {
      // 验证 Refresh Token 的签名和有效期
      const payload = jwt.verify(refreshToken, jwtSecret) as {
        userId: string;
        type: string;
      };

      if (payload.type !== 'refresh') {
        throw new Error('INVALID_REFRESH_TOKEN');
      }

      // 验证 Refresh Token 是否在数据库中（防止已撤销的 Token 被使用）
      const isValid = await this.userRepository.validateRefreshToken(
        payload.userId,
        refreshToken,
      );

      if (!isValid) {
        throw new Error('INVALID_REFRESH_TOKEN');
      }

      // 查询用户信息（获取最新的角色和状态）
      const user = await this.userRepository.findById(payload.userId);
      if (!user || !user.isActive) {
        throw new Error('INVALID_REFRESH_TOKEN');
      }

      // 生成新的 Access Token
      const newAccessToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        jwtSecret,
        { expiresIn: AuthService.ACCESS_TOKEN_EXPIRES },
      );

      return { accessToken: newAccessToken };
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_REFRESH_TOKEN') {
        throw error;
      }
      throw new Error('INVALID_REFRESH_TOKEN');
    }
  }

  /**
   * 生成 Access Token + Refresh Token 对
   * 私有方法，只供 Service 内部使用
   */
  private generateTokenPair(
    userId: string,
    email: string,
    role: UserRole,
  ): { accessToken: string; refreshToken: string } {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error('JWT_SECRET 未配置');

    // Access Token：携带用户信息，短期有效
    const accessToken = jwt.sign(
      { userId, email, role },
      jwtSecret,
      { expiresIn: AuthService.ACCESS_TOKEN_EXPIRES },
    );

    // Refresh Token：只携带 userId，长期有效，用于换取新 Access Token
    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      jwtSecret,
      { expiresIn: AuthService.REFRESH_TOKEN_EXPIRES },
    );

    return { accessToken, refreshToken };
  }
}
