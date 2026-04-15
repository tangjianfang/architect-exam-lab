/**
 * 限流中间件 — 令牌桶算法实现
 *
 * 考点：
 * - 限流算法：令牌桶（Token Bucket）vs 漏桶（Leaky Bucket）
 * - 设计模式：策略模式（Strategy Pattern）— 限流策略可替换
 * - 分布式系统：并发控制
 *
 * ═══════════════════════════════════════════════════════════════
 * 令牌桶算法原理（Token Bucket Algorithm）
 * ═══════════════════════════════════════════════════════════════
 *
 *  时间轴 →
 *  ┌────────────────────────────────────────────────────┐
 *  │                    令牌桶                           │
 *  │  容量上限: maxTokens = 100                         │
 *  │                                                    │
 *  │  补充速率: refillRate = 10 tokens/second           │
 *  │  ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐  ← 令牌           │
 *  │  └──┘└──┘└──┘└──┘└──┘└──┘└──┘                   │
 *  │       ↑ 每秒自动补充                                │
 *  │       ↓ 请求消耗（每个请求消耗1个令牌）              │
 *  └────────────────────────────────────────────────────┘
 *
 *  特点：允许突发流量（桶中有存量令牌时可短时间内处理更多请求）
 *  对比漏桶：漏桶以固定速率处理，不允许突发；令牌桶允许突发但有上限
 *
 * ═══════════════════════════════════════════════════════════════
 * 四种限流算法对比（软考常考）：
 * ═══════════════════════════════════════════════════════════════
 *  算法          突发流量  实现复杂度  适用场景
 *  令牌桶         支持      中等        API限流（推荐）
 *  漏桶           不支持    简单        流量整形
 *  固定窗口       支持(边界) 简单        粗粒度限流
 *  滑动窗口       不支持    较高        精确限流
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '@toollab/shared-logger';
import type { ApiResponse } from '@toollab/shared-types';

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

interface TokenBucket {
  /** 当前桶中的令牌数量 */
  tokens: number;
  /** 上次补充令牌的时间戳（毫秒）*/
  lastRefillTime: number;
}

interface RateLimiterOptions {
  /** 桶的最大令牌容量（即最大突发请求数）默认 100 */
  maxTokens?: number;
  /** 每秒补充的令牌数量 默认 10 */
  refillRate?: number;
  /** 限流的 key 生成函数（默认按 IP 地址）*/
  keyGenerator?: (req: Request) => string;
}

// ─── 令牌桶实现 ───────────────────────────────────────────────────────────────

/**
 * 令牌桶管理器
 * 设计模式：单例模式（Singleton Pattern）— 确保全局共享一个令牌桶状态
 * 注意：当前使用内存存储，生产环境应使用 Redis 实现分布式限流
 */
class TokenBucketManager {
  // 设计模式：单例模式
  private static instance: TokenBucketManager;

  // 以 key（通常是 IP 地址）为索引存储各客户端的令牌桶
  private buckets = new Map<string, TokenBucket>();

  private constructor() {}

  /** 获取单例实例 */
  public static getInstance(): TokenBucketManager {
    if (!TokenBucketManager.instance) {
      TokenBucketManager.instance = new TokenBucketManager();
    }
    return TokenBucketManager.instance;
  }

  /**
   * 尝试消耗一个令牌
   *
   * 令牌补充算法：
   * 经过的时间（秒）= (当前时间 - 上次补充时间) / 1000
   * 应补充的令牌数 = 经过的时间 × 补充速率
   * 实际令牌数 = min(当前令牌 + 应补充令牌, 最大容量)
   *
   * @returns true 表示允许请求，false 表示触发限流
   */
  public tryConsume(key: string, maxTokens: number, refillRate: number): boolean {
    const now = Date.now();

    // 获取或初始化令牌桶
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: maxTokens, lastRefillTime: now };
      this.buckets.set(key, bucket);
    }

    // 计算自上次补充以来应该补充的令牌数
    const elapsedSeconds = (now - bucket.lastRefillTime) / 1000;
    const tokensToAdd = elapsedSeconds * refillRate;

    if (tokensToAdd > 0) {
      // 补充令牌（不超过桶的最大容量）
      bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefillTime = now;
    }

    // 检查是否有足够的令牌（每个请求消耗 1 个令牌）
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true; // 允许请求
    }

    return false; // 令牌不足，触发限流
  }

  /**
   * 获取指定 key 的剩余令牌数（用于响应头）
   */
  public getRemainingTokens(key: string, maxTokens: number): number {
    const bucket = this.buckets.get(key);
    return Math.floor(bucket?.tokens ?? maxTokens);
  }

  /** 清理过期的令牌桶（防止内存泄漏）*/
  public cleanup(maxAgeMs: number = 3_600_000): void {
    const cutoff = Date.now() - maxAgeMs;
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.lastRefillTime < cutoff) {
        this.buckets.delete(key);
      }
    }
  }
}

// ─── 中间件工厂函数 ───────────────────────────────────────────────────────────

/**
 * 创建限流中间件（令牌桶算法）
 *
 * @param options 限流配置
 */
export function createRateLimiterMiddleware(options: RateLimiterOptions = {}): RequestHandler {
  const {
    maxTokens = 100,
    refillRate = 10,
    // 默认按 IP 地址限流（考虑反向代理，优先读取 X-Forwarded-For）
    keyGenerator = (req: Request) => {
      const forwarded = req.headers['x-forwarded-for'];
      const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? req.ip ?? 'unknown');
      return `rate-limit:ip:${ip}`;
    },
  } = options;

  const manager = TokenBucketManager.getInstance();

  // 定期清理过期的令牌桶（每小时执行一次）
  setInterval(() => manager.cleanup(), 3_600_000);

  return function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction): void {
    const key = keyGenerator(req);
    const allowed = manager.tryConsume(key, maxTokens, refillRate);

    // 设置限流相关的响应头（RFC 6585 标准）
    const remaining = manager.getRemainingTokens(key, maxTokens);
    res.setHeader('X-RateLimit-Limit', maxTokens);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + Math.ceil(1 / refillRate));

    if (!allowed) {
      // 考点：HTTP 状态码 429 Too Many Requests（RFC 6585）
      logger.warn({ message: '触发限流', key, path: req.path });
      res.status(429).json({
        success: false,
        data: null,
        error: {
          code: 'RATE_LIMITED',
          message: '请求过于频繁，请稍后再试',
          details: { remaining: 0, retryAfterSeconds: Math.ceil(1 / refillRate) },
        },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<never>);
      return;
    }

    next();
  };
}
