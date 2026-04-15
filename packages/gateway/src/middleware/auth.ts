/**
 * JWT 认证中间件
 *
 * 考点：
 * - 安全架构：JWT 认证（JSON Web Token）
 * - 设计模式：装饰器模式（Decorator Pattern）— 在不修改原始请求处理的情况下增加认证功能
 * - 架构模式：横切关注点（Cross-cutting Concerns）— 认证逻辑集中在 Gateway 层
 *
 * JWT 验证流程：
 * 1. 从 Authorization Header 提取 Bearer Token
 * 2. 使用 jwt.verify() 验证签名（注意：必须用 verify 而不是 decode）
 * 3. 检查 Token 是否过期（exp 字段）
 * 4. 将解码后的用户信息注入到 request 对象
 * 5. 调用 next() 传递给下一个中间件
 *
 * 安全规则：
 * - 禁止使用 jwt.decode()（不验证签名，存在安全漏洞）
 * - JWT 密钥必须从环境变量读取
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '@toollab/shared-logger';
import type { TokenPayload, ApiResponse } from '@toollab/shared-types';

// 扩展 Express Request 类型，添加用户信息字段
// 考点：TypeScript 类型扩展（Declaration Merging）
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/**
 * 从 Authorization Header 中提取 Bearer Token
 * 格式：Authorization: Bearer <token>
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // 去掉 "Bearer " 前缀
}

/**
 * 构建未授权响应
 */
function buildUnauthorizedResponse(message: string): ApiResponse<never> {
  return {
    success: false,
    data: null,
    error: {
      code: 'UNAUTHORIZED',
      message,
      details: null,
    },
    timestamp: new Date().toISOString(),
  };
}

// ─── 中间件工厂函数 ───────────────────────────────────────────────────────────

/**
 * 创建 JWT 认证中间件
 *
 * 设计模式：装饰器模式（Decorator Pattern）
 * 通过工厂函数创建中间件，可配置是否强制认证
 *
 * @param options.optional - 如果为 true，Token 缺失时不会报错（用于可选认证场景）
 */
export function createAuthMiddleware(options: { optional?: boolean } = {}): RequestHandler {
  // 安全规则：从环境变量读取 JWT 密钥，禁止硬编码
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    // 启动时检查，防止配置错误导致的安全漏洞
    throw new Error('环境变量 JWT_SECRET 未配置！');
  }

  // 设计模式：装饰器模式 — 返回一个增强了认证功能的中间件函数
  return function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const token = extractBearerToken(req);

    // Token 不存在的处理
    if (!token) {
      if (options.optional) {
        // 可选认证：没有 Token 时继续，但 req.user 为 undefined
        next();
        return;
      }
      logger.warn({ message: '请求缺少认证 Token', path: req.path, ip: req.ip });
      res.status(401).json(buildUnauthorizedResponse('请提供有效的认证 Token'));
      return;
    }

    try {
      // 考点：JWT 验证的核心
      // jwt.verify() 会同时验证：
      // 1. 签名是否合法（防篡改）
      // 2. Token 是否过期（exp 字段）
      // 3. Token 是否在 nbf（not before）时间之前
      // 安全警告：禁止使用 jwt.decode()，它不验证签名
      const payload = jwt.verify(token, jwtSecret) as TokenPayload;

      // 将用户信息注入到请求对象（供后续中间件和路由处理器使用）
      req.user = payload;

      // 添加用户标识到请求头，方便下游服务识别请求者
      req.headers['x-user-id'] = payload.userId;
      req.headers['x-user-role'] = payload.role;

      logger.debug({
        message: '认证成功',
        userId: payload.userId,
        role: payload.role,
        path: req.path,
      });

      next();
    } catch (error) {
      // JWT 验证失败的处理（签名无效、Token 过期等）
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn({ message: 'Token 已过期', path: req.path, ip: req.ip });
        res.status(401).json(buildUnauthorizedResponse('Token 已过期，请刷新 Token'));
        return;
      }

      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn({ message: 'Token 无效', error: error.message, path: req.path, ip: req.ip });
        res.status(401).json(buildUnauthorizedResponse('Token 无效'));
        return;
      }

      // 未知错误
      logger.error({ message: '认证中间件异常', error: String(error) });
      res.status(500).json({
        success: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: '认证服务异常', details: null },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<never>);
    }
  };
}
