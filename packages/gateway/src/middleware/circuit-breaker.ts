/**
 * 熔断器中间件 — 状态机模式实现
 *
 * 考点：
 * - 设计模式：状态模式（State Pattern）— 三种状态之间的转换
 * - 分布式系统：容错设计（Fault Tolerance）
 * - 架构模式：熔断器模式（Circuit Breaker Pattern）
 *
 * ═══════════════════════════════════════════════════════════════
 * 熔断器状态机（Circuit Breaker State Machine）
 * ═══════════════════════════════════════════════════════════════
 *
 *              连续失败次数 ≥ 阈值
 *   ┌─────────┐ ─────────────────────────→ ┌──────────┐
 *   │  CLOSED  │                            │   OPEN   │
 *   │（正常）  │ ←─────────────────────────  │（熔断中）│
 *   └─────────┘  探测请求成功                └──────────┘
 *        ↑                                       │
 *        │ 探测成功                              │ 等待恢复时间（如 30 秒）
 *        │                                       ▼
 *        │                               ┌────────────┐
 *        └───────────────────────────────│ HALF-OPEN  │
 *          探测请求失败，回到 OPEN          │（探测中）  │
 *                                         └────────────┘
 *
 * 状态说明：
 * - CLOSED（关闭）：正常状态，请求正常通过，统计失败次数
 * - OPEN（开路）：熔断状态，直接拒绝请求（快速失败），保护下游服务
 * - HALF-OPEN（半开）：恢复探测状态，放行少量请求测试下游服务是否恢复
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '@toollab/shared-logger';
import type { ApiResponse } from '@toollab/shared-types';

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

/** 熔断器状态枚举 */
export enum CircuitBreakerState {
  /** 关闭状态（正常工作）*/
  CLOSED = 'CLOSED',
  /** 开路状态（熔断中，拒绝所有请求）*/
  OPEN = 'OPEN',
  /** 半开状态（探测下游服务是否恢复）*/
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerOptions {
  /** 服务名称（用于日志和指标）*/
  serviceName: string;
  /** 触发熔断的连续失败次数阈值，默认 5 */
  failureThreshold?: number;
  /** 熔断后恢复探测的等待时间（毫秒），默认 30000ms */
  recoveryTimeMs?: number;
  /** 半开状态下允许通过的探测请求数，默认 1 */
  halfOpenMaxRequests?: number;
}

interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastStateChangeTime: number;
}

// ─── 熔断器实现 ───────────────────────────────────────────────────────────────

/**
 * 熔断器实现类
 *
 * 设计模式：状态模式（State Pattern）
 * 将不同状态下的行为封装到对应的状态中，通过状态转换来改变行为
 */
class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private lastStateChangeTime: number = Date.now();
  private halfOpenRequestCount = 0;

  constructor(
    private readonly serviceName: string,
    private readonly failureThreshold: number,
    private readonly recoveryTimeMs: number,
    private readonly halfOpenMaxRequests: number,
  ) {}

  /**
   * 检查是否允许请求通过
   * 这是状态机的核心决策逻辑
   */
  public allowRequest(): boolean {
    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        // 关闭状态：所有请求都允许通过
        return true;

      case CircuitBreakerState.OPEN: {
        // 开路状态：检查是否已经过了恢复等待时间
        const elapsed = Date.now() - (this.lastFailureTime ?? 0);
        if (elapsed >= this.recoveryTimeMs) {
          // 转换到半开状态，尝试探测
          this.transitionTo(CircuitBreakerState.HALF_OPEN);
          this.halfOpenRequestCount = 0;
          return true; // 允许第一个探测请求
        }
        return false; // 还在等待恢复期，拒绝请求
      }

      case CircuitBreakerState.HALF_OPEN:
        // 半开状态：只允许有限数量的探测请求
        if (this.halfOpenRequestCount < this.halfOpenMaxRequests) {
          this.halfOpenRequestCount++;
          return true;
        }
        return false;

      default:
        return true;
    }
  }

  /**
   * 记录请求成功
   */
  public recordSuccess(): void {
    this.failureCount = 0;
    this.successCount++;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // 探测成功！关闭熔断器，恢复正常
      logger.info({
        message: `熔断器恢复：${this.serviceName}`,
        state: 'HALF_OPEN → CLOSED',
      });
      this.transitionTo(CircuitBreakerState.CLOSED);
    }
  }

  /**
   * 记录请求失败
   */
  public recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // 探测失败，回到开路状态
      logger.warn({
        message: `熔断器探测失败：${this.serviceName}`,
        state: 'HALF_OPEN → OPEN',
      });
      this.transitionTo(CircuitBreakerState.OPEN);
      return;
    }

    if (
      this.state === CircuitBreakerState.CLOSED &&
      this.failureCount >= this.failureThreshold
    ) {
      // 连续失败次数达到阈值，触发熔断
      logger.error({
        message: `熔断器触发：${this.serviceName}`,
        state: 'CLOSED → OPEN',
        failureCount: this.failureCount,
        threshold: this.failureThreshold,
      });
      this.transitionTo(CircuitBreakerState.OPEN);
    }
  }

  /** 获取当前状态统计信息 */
  public getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChangeTime: this.lastStateChangeTime,
    };
  }

  /** 状态转换（记录日志）*/
  private transitionTo(newState: CircuitBreakerState): void {
    logger.info({
      message: `熔断器状态转换：${this.serviceName}`,
      from: this.state,
      to: newState,
    });
    this.state = newState;
    this.lastStateChangeTime = Date.now();
  }
}

// ─── 熔断器注册表（按服务名管理）─────────────────────────────────────────────
// 设计模式：注册表模式 + 单例模式
const circuitBreakerRegistry = new Map<string, CircuitBreaker>();

// ─── 中间件工厂函数 ───────────────────────────────────────────────────────────

/**
 * 创建熔断器中间件
 *
 * @param options 熔断器配置
 */
export function createCircuitBreakerMiddleware(options: CircuitBreakerOptions): RequestHandler {
  const {
    serviceName,
    failureThreshold = 5,
    recoveryTimeMs = 30_000,
    halfOpenMaxRequests = 1,
  } = options;

  // 获取或创建该服务的熔断器实例
  if (!circuitBreakerRegistry.has(serviceName)) {
    circuitBreakerRegistry.set(
      serviceName,
      new CircuitBreaker(serviceName, failureThreshold, recoveryTimeMs, halfOpenMaxRequests),
    );
  }
  const breaker = circuitBreakerRegistry.get(serviceName)!;

  return function circuitBreakerMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!breaker.allowRequest()) {
      // 熔断器开路，快速失败（Fast Fail）
      // 考点：可用性设计 — 快速失败比长时间等待超时更好
      const stats = breaker.getStats();
      logger.warn({
        message: `熔断器阻止请求：${serviceName}`,
        state: stats.state,
        path: req.path,
      });

      res.status(503).json({
        success: false,
        data: null,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: `${serviceName} 服务暂时不可用，请稍后再试`,
          details: {
            circuitBreakerState: stats.state,
            retryAfterMs: recoveryTimeMs,
          },
        },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<never>);
      return;
    }

    // 拦截响应，根据状态码更新熔断器
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode >= 500) {
        breaker.recordFailure();
      } else {
        breaker.recordSuccess();
      }
      return originalJson(body);
    };

    next();
  };
}

/** 获取熔断器状态（用于健康检查和监控）*/
export function getCircuitBreakerStats(serviceName: string): CircuitBreakerStats | null {
  return circuitBreakerRegistry.get(serviceName)?.getStats() ?? null;
}
