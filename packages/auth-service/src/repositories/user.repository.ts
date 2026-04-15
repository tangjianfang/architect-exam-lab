/**
 * 用户数据访问层（Repository 层）
 *
 * 考点：
 * - 设计模式：仓储模式（Repository Pattern）
 * - 分层架构：Repository 层职责（数据访问，封装 ORM 操作）
 * - 接口抽象：通过接口隔离 Service 层和数据库实现
 *
 * 仓储模式的核心价值：
 * 1. 将数据访问逻辑与业务逻辑分离
 * 2. 可以方便地替换底层数据库实现（如从 PostgreSQL 换到 MongoDB）
 * 3. 测试时可以用内存实现替代真实数据库（提高可测试性）
 *
 * 架构约束：
 * - Repository 层只能被 Service 层调用
 * - Repository 层不包含任何业务逻辑
 * - 使用 Prisma ORM 进行参数化查询（防止 SQL 注入）
 */

import { PrismaClient } from '@prisma/client';
import type { UserRole } from '@toollab/shared-types';

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  username: string;
  passwordHash: string;
  role: UserRole;
}

// ─── Repository 实现 ──────────────────────────────────────────────────────────

/**
 * 用户仓储类
 * 设计模式：仓储模式（Repository Pattern）
 *
 * 封装所有用户相关的数据库操作，提供领域对象级别的 CRUD 接口。
 * Service 层通过此接口操作用户数据，无需关心底层 Prisma/SQL 细节。
 */
export class UserRepository {
  // 考点：PrismaClient 使用单例模式（避免数据库连接池耗尽）
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    // 支持依赖注入（测试时传入 Mock），生产时使用真实 Prisma Client
    this.prisma = prisma ?? new PrismaClient();
  }

  /**
   * 根据 ID 查询用户
   * 安全规则：使用 Prisma 参数化查询，防止 SQL 注入
   */
  async findById(id: string): Promise<UserRecord | null> {
    // 考点：Prisma ORM 参数化查询（防 SQL 注入）
    // 对比危险写法：`SELECT * FROM users WHERE id = '${id}'`（禁止！）
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return null;

    return {
      ...user,
      role: user.role as UserRole,
    };
  }

  /**
   * 根据邮箱查询用户（用于登录验证）
   */
  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return null;

    return {
      ...user,
      role: user.role as UserRole,
    };
  }

  /**
   * 创建新用户
   *
   * 安全规则：
   * - 只接受哈希后的密码（passwordHash），禁止存储明文
   * - 默认角色为 USER，不允许注册时自行指定 ADMIN
   */
  async create(data: CreateUserData): Promise<UserRecord> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: data.passwordHash, // 已哈希，非明文
        role: data.role,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...user,
      role: user.role as UserRole,
    };
  }

  /**
   * 保存 Refresh Token（用于 Token 撤销机制）
   * 每次登录时更新，实现 Token Rotation 安全机制
   */
  async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await this.prisma.userSession.upsert({
      where: { userId },
      create: {
        userId,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 天后过期
      },
      update: {
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  /**
   * 验证 Refresh Token 是否有效
   *
   * 考点：Token 撤销机制
   * 通过数据库验证解决 JWT 无状态无法撤销的问题
   */
  async validateRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    const session = await this.prisma.userSession.findFirst({
      where: {
        userId,
        refreshToken,
        expiresAt: { gt: new Date() }, // 未过期
      },
    });

    return session !== null;
  }

  /**
   * 关闭数据库连接（优雅关闭时调用）
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
