/**
 * 工具注册中心入口
 *
 * 考点：
 * - 服务注册与发现（Service Registry Pattern）
 * - 健康检查（Health Check Pattern）
 */

import express from 'express';
import { z } from 'zod';
import { logger } from '@toollab/shared-logger';
import type { ApiResponse, ServiceHealth } from '@toollab/shared-types';
import type { Request, Response } from 'express';

const PORT = parseInt(process.env.PORT ?? '3002', 10);
const app = express();
app.use(express.json());

// 内存存储（生产环境应使用 PostgreSQL）
// 设计模式：注册表模式（Registry Pattern）
const toolRegistry = new Map<string, {
  id: string; name: string; description: string;
  endpoint: string; version: string; status: string;
  tags: string[]; ownerId: string; registeredAt: Date;
}>();

// ─── 健康检查 ──────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  const health: ServiceHealth = {
    service: 'tool-registry',
    status: 'healthy',
    latencyMs: 0,
    lastChecked: new Date(),
    details: { toolCount: toolRegistry.size, uptime: process.uptime() },
  };
  res.status(200).json({ success: true, data: health, error: null, timestamp: new Date().toISOString() } satisfies ApiResponse<ServiceHealth>);
});

// ─── 注册工具 ──────────────────────────────────────────────────────────────────
const RegisterToolSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  description: z.string().min(1).max(256),
  endpoint: z.string().url(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  tags: z.array(z.string()).max(10).default([]),
});

app.post('/tools', (req: Request, res: Response) => {
  const parseResult = RegisterToolSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false, data: null,
      error: { code: 'VALIDATION_ERROR', message: '工具信息不合法', details: parseResult.error.flatten().fieldErrors },
      timestamp: new Date().toISOString(),
    } satisfies ApiResponse<never>);
    return;
  }

  const { name, description, endpoint, version, tags } = parseResult.data;
  const ownerId = req.headers['x-user-id'] as string ?? 'unknown';

  if (toolRegistry.has(name)) {
    res.status(409).json({
      success: false, data: null,
      error: { code: 'TOOL_EXISTS', message: `工具 "${name}" 已注册`, details: null },
      timestamp: new Date().toISOString(),
    } satisfies ApiResponse<never>);
    return;
  }

  const tool = {
    id: `tool-${Date.now()}`,
    name, description, endpoint, version,
    status: 'ACTIVE', tags, ownerId,
    registeredAt: new Date(),
  };
  toolRegistry.set(name, tool);

  logger.info({ message: '工具已注册', toolName: name, ownerId });
  res.status(201).json({ success: true, data: tool, error: null, timestamp: new Date().toISOString() } satisfies ApiResponse<typeof tool>);
});

// ─── 查询工具列表 ───────────────────────────────────────────────────────────────
app.get('/tools', (_req: Request, res: Response) => {
  const tools = Array.from(toolRegistry.values()).filter(t => t.status === 'ACTIVE');
  res.status(200).json({ success: true, data: tools, error: null, timestamp: new Date().toISOString() } satisfies ApiResponse<typeof tools>);
});

// ─── 查询单个工具 ───────────────────────────────────────────────────────────────
app.get('/tools/:name', (req: Request, res: Response) => {
  const tool = toolRegistry.get(req.params['name'] ?? '');
  if (!tool) {
    res.status(404).json({
      success: false, data: null,
      error: { code: 'NOT_FOUND', message: `工具 "${req.params['name']}" 不存在`, details: null },
      timestamp: new Date().toISOString(),
    } satisfies ApiResponse<never>);
    return;
  }
  res.status(200).json({ success: true, data: tool, error: null, timestamp: new Date().toISOString() } satisfies ApiResponse<typeof tool>);
});

const server = app.listen(PORT, () => {
  logger.info({ message: '工具注册中心已启动', port: PORT });
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 30_000);
});

export { app };
