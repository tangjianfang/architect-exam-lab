/**
 * 认证服务入口文件
 *
 * 考点：
 * - 分层架构（Controller → Service → Repository）
 * - 依赖注入（Dependency Injection）
 * - 单一职责原则（SRP）
 */

import express from 'express';
import { AuthController } from './controllers/auth.controller.js';
import { AuthService } from './services/auth.service.js';
import { UserRepository } from './repositories/user.repository.js';
import { logger } from '@toollab/shared-logger';
import type { ApiResponse, ServiceHealth } from '@toollab/shared-types';
import type { Request, Response, NextFunction } from 'express';

// ─── 配置读取 ─────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ─── 依赖注入（手动 DI）────────────────────────────────────────────────────────
// 考点：依赖倒置原则（DIP）— 高层模块不直接依赖低层模块，通过接口解耦
// 构建依赖树：Repository → Service → Controller
const userRepository = new UserRepository();
const authService = new AuthService(userRepository);
const authController = new AuthController(authService);

// ─── Express 应用初始化 ───────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// ─── 健康检查端点 ─────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  const health: ServiceHealth = {
    service: 'auth-service',
    status: 'healthy',
    latencyMs: 0,
    lastChecked: new Date(),
    details: { version: '1.0.0', uptime: process.uptime() },
  };
  res.status(200).json({
    success: true,
    data: health,
    error: null,
    timestamp: new Date().toISOString(),
  } satisfies ApiResponse<ServiceHealth>);
});

// ─── 路由注册 ─────────────────────────────────────────────────────────────────
// POST /login   — 用户登录，返回 JWT Access Token + Refresh Token
// POST /register — 用户注册
// POST /refresh  — 刷新 Access Token
app.post('/login', (req, res) => authController.login(req, res));
app.post('/register', (req, res) => authController.register(req, res));
app.post('/refresh', (req, res) => authController.refresh(req, res));

// ─── 全局错误处理 ─────────────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ message: '未处理的错误', error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    data: null,
    error: { code: 'INTERNAL_ERROR', message: '认证服务内部错误', details: null },
    timestamp: new Date().toISOString(),
  } satisfies ApiResponse<never>);
});

// ─── 启动 ────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info({ message: '认证服务已启动', port: PORT });
});

// 优雅关闭
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 30_000);
});

export { app };
