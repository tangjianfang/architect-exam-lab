/**
 * API Gateway 入口文件
 *
 * 考点：
 * - API Gateway 模式（微服务架构模式）
 * - 责任链模式（Chain of Responsibility Pattern）— 中间件管道
 * - 外观模式（Facade Pattern）— 统一对外接口
 * - 代理模式（Proxy Pattern）— 请求转发
 *
 * 架构角色：
 * 本服务作为系统唯一入口，负责：
 * 1. 路由：将请求分发到对应的微服务
 * 2. 认证：验证 JWT Token 的合法性
 * 3. 限流：令牌桶算法控制请求速率
 * 4. 熔断：保护下游服务免受级联故障
 * 5. 日志：统一记录所有请求的进出
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createAuthMiddleware } from './middleware/auth.js';
import { createRateLimiterMiddleware } from './middleware/rate-limiter.js';
import { createCircuitBreakerMiddleware } from './middleware/circuit-breaker.js';
import { logger } from '@toollab/shared-logger';
import type { ApiResponse, ServiceHealth } from '@toollab/shared-types';

// ─── 配置读取 ────────────────────────────────────────────────────────────────
// 安全规则：所有密钥和地址必须从环境变量读取，禁止硬编码
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001';
const TOOL_REGISTRY_URL = process.env.TOOL_REGISTRY_URL ?? 'http://localhost:3002';

// ─── 应用初始化 ───────────────────────────────────────────────────────────────
const app = express();

// ─── 基础中间件 ───────────────────────────────────────────────────────────────
// 解析 JSON 请求体
app.use(express.json({ limit: '1mb' }));
// 解析 URL 编码请求体
app.use(express.urlencoded({ extended: true }));

// ─── 请求日志中间件（请求开始）──────────────────────────────────────────────────
// 设计模式：观察者模式 — 每个请求都触发日志记录
app.use((req: Request, _res: Response, next: NextFunction) => {
  const startTime = Date.now();
  // 将开始时间挂载到请求对象上，供后续中间件使用
  (req as Request & { startTime: number }).startTime = startTime;
  logger.info({
    message: '收到请求',
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// ─── 健康检查端点（无需认证）────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  const health: ServiceHealth = {
    service: 'gateway',
    status: 'healthy',
    latencyMs: 0,
    lastChecked: new Date(),
    details: {
      version: process.env.npm_package_version ?? '1.0.0',
      uptime: process.uptime(),
    },
  };
  const response: ApiResponse<ServiceHealth> = {
    success: true,
    data: health,
    error: null,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

// ─── 认证路由（无需 Token）───────────────────────────────────────────────────
// /auth/* 路由直接代理到 Auth Service，无需 JWT 验证
// 考点：API Gateway 的选择性认证策略
app.use(
  '/auth',
  createCircuitBreakerMiddleware({ serviceName: 'auth-service', failureThreshold: 5 }),
  createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/auth': '' },
    on: {
      error: (err: Error, _req: Request, res: Response) => {
        logger.error({ message: 'Auth Service 代理错误', error: err.message });
        res.status(502).json({
          success: false,
          data: null,
          error: { code: 'UPSTREAM_ERROR', message: 'Auth Service 暂时不可用' },
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<never>);
      },
    },
  }),
);

// ─── 需要认证的路由 ───────────────────────────────────────────────────────────
// 设计模式：责任链模式（Chain of Responsibility）
// 请求依次经过：认证验证 → 限流检查 → 熔断检查 → 代理转发

// 工具注册中心路由
app.use(
  '/tools',
  // 步骤 1：验证 JWT Token（装饰器模式）
  createAuthMiddleware(),
  // 步骤 2：限流（令牌桶算法）
  createRateLimiterMiddleware({ maxTokens: 100, refillRate: 10 }),
  // 步骤 3：熔断检查
  createCircuitBreakerMiddleware({ serviceName: 'tool-registry', failureThreshold: 5 }),
  // 步骤 4：代理到 Tool Registry
  createProxyMiddleware({
    target: TOOL_REGISTRY_URL,
    changeOrigin: true,
    pathRewrite: { '^/tools': '' },
    on: {
      error: (err: Error, _req: Request, res: Response) => {
        logger.error({ message: 'Tool Registry 代理错误', error: err.message });
        res.status(502).json({
          success: false,
          data: null,
          error: { code: 'UPSTREAM_ERROR', message: 'Tool Registry 暂时不可用' },
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<never>);
      },
    },
  }),
);

// ─── 全局 404 处理 ────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    data: null,
    error: { code: 'NOT_FOUND', message: '请求的路径不存在' },
    timestamp: new Date().toISOString(),
  } satisfies ApiResponse<never>);
});

// ─── 全局错误处理中间件 ──────────────────────────────────────────────────────
// 必须是 4 个参数才能被 Express 识别为错误处理中间件
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ message: '未处理的错误', error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    data: null,
    error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
    timestamp: new Date().toISOString(),
  } satisfies ApiResponse<never>);
});

// ─── 启动服务器 ───────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info({ message: `API Gateway 已启动`, port: PORT });
});

// ─── 优雅关闭（Graceful Shutdown）───────────────────────────────────────────
// 考点：进程管理、零停机部署
process.on('SIGTERM', () => {
  logger.info({ message: '收到 SIGTERM，开始优雅关闭...' });
  server.close(() => {
    logger.info({ message: 'API Gateway 已关闭' });
    process.exit(0);
  });
  // 超时强制退出
  setTimeout(() => process.exit(1), 30_000);
});

export { app };
