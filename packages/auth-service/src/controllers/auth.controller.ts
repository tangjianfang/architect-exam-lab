/**
 * 认证控制器（Controller 层）
 *
 * 考点：
 * - 分层架构：Controller 层职责（HTTP 请求解析 + 响应格式化）
 * - 输入验证：使用 Zod Schema 验证请求参数
 * - 错误处理：统一的错误响应格式
 *
 * 架构约束：
 * Controller 层只能调用 Service 层，禁止直接调用 Repository 层
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import type { AuthService } from '../services/auth.service.js';
import { logger } from '@toollab/shared-logger';
import type { ApiResponse } from '@toollab/shared-types';

// ─── 输入验证 Schema（使用 Zod）────────────────────────────────────────────────
// 考点：输入验证是安全架构的第一道防线

const LoginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(8, '密码至少 8 个字符'),
});

const RegisterSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  username: z
    .string()
    .min(3, '用户名至少 3 个字符')
    .max(32, '用户名最多 32 个字符')
    .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符'),
  password: z
    .string()
    .min(8, '密码至少 8 个字符')
    .regex(/[A-Z]/, '密码必须包含至少一个大写字母')
    .regex(/[0-9]/, '密码必须包含至少一个数字'),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh Token 不能为空'),
});

// ─── 控制器类 ─────────────────────────────────────────────────────────────────

export class AuthController {
  /**
   * 构造函数注入 AuthService
   * 考点：依赖注入（Dependency Injection）
   */
  constructor(private readonly authService: AuthService) {}

  /**
   * 用户登录
   * POST /login
   * Body: { email, password }
   */
  async login(req: Request, res: Response): Promise<void> {
    // 1. 输入验证（Controller 层职责）
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: '输入参数不合法',
          details: parseResult.error.flatten().fieldErrors,
        },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<never>);
      return;
    }

    const { email, password } = parseResult.data;

    try {
      // 2. 调用 Service 层执行业务逻辑
      const result = await this.authService.login(email, password);

      // 3. 格式化成功响应（Controller 层职责）
      res.status(200).json({
        success: true,
        data: result,
        error: null,
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<typeof result>);
    } catch (error) {
      this.handleServiceError(error, res, '登录');
    }
  }

  /**
   * 用户注册
   * POST /register
   * Body: { email, username, password }
   */
  async register(req: Request, res: Response): Promise<void> {
    const parseResult = RegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: '注册信息不合法',
          details: parseResult.error.flatten().fieldErrors,
        },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<never>);
      return;
    }

    const { email, username, password } = parseResult.data;

    try {
      const result = await this.authService.register(email, username, password);
      res.status(201).json({
        success: true,
        data: result,
        error: null,
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<typeof result>);
    } catch (error) {
      this.handleServiceError(error, res, '注册');
    }
  }

  /**
   * 刷新 Access Token
   * POST /refresh
   * Body: { refreshToken }
   */
  async refresh(req: Request, res: Response): Promise<void> {
    const parseResult = RefreshSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Refresh Token 无效', details: null },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<never>);
      return;
    }

    try {
      const result = await this.authService.refreshToken(parseResult.data.refreshToken);
      res.status(200).json({
        success: true,
        data: result,
        error: null,
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<typeof result>);
    } catch (error) {
      this.handleServiceError(error, res, '刷新 Token');
    }
  }

  /**
   * 统一错误处理（Controller 层）
   * 将 Service 层抛出的错误转换为 HTTP 响应
   */
  private handleServiceError(error: unknown, res: Response, operation: string): void {
    logger.error({ message: `${operation}操作失败`, error: String(error) });

    if (error instanceof Error) {
      // 已知业务错误
      if (error.message === 'INVALID_CREDENTIALS') {
        res.status(401).json({
          success: false,
          data: null,
          error: { code: 'INVALID_CREDENTIALS', message: '邮箱或密码不正确', details: null },
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<never>);
        return;
      }
      if (error.message === 'EMAIL_EXISTS') {
        res.status(409).json({
          success: false,
          data: null,
          error: { code: 'EMAIL_EXISTS', message: '该邮箱已被注册', details: null },
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<never>);
        return;
      }
      if (error.message === 'INVALID_REFRESH_TOKEN') {
        res.status(401).json({
          success: false,
          data: null,
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh Token 无效或已过期', details: null },
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<never>);
        return;
      }
    }

    // 未知错误
    res.status(500).json({
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: '服务内部错误', details: null },
      timestamp: new Date().toISOString(),
    } satisfies ApiResponse<never>);
  }
}
