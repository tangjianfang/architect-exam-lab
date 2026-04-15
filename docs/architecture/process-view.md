# 进程视图（Process View）

> 考点关联：**4+1视图 - 进程视图**、**并发与同步**、**进程间通信（IPC）**、**分布式系统**

进程视图描述系统运行时的并发特性、进程/线程组织方式、同步机制和通信协议。它关注系统的**非功能需求**（性能、可用性）。

---

## 1. 系统进程架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        Docker 网络（toollab-network）              │
│                                                                    │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐  │
│  │   gateway:3000  │    │auth-service:3001│    │ registry:3002│  │
│  │                 │    │                 │    │              │  │
│  │ Process: Node.js│    │ Process: Node.js│    │Process:Node.js│  │
│  │ Threads: 1(主)  │    │ Threads: 1(主)  │    │Threads: 1(主)│  │
│  │ Workers: N(可选)│    │ Event Loop: 异步│    │Event Loop:异步│  │
│  │                 │    │                 │    │              │  │
│  └────────┬────────┘    └────────┬────────┘    └──────┬───────┘  │
│           │ HTTP/REST            │ HTTP/REST           │          │
│           └─────────────────────┘─────────────────────┘          │
│                                                                    │
│  ┌─────────────────────┐         ┌─────────────────────┐         │
│  │   PostgreSQL:5432   │         │     Redis:6379      │         │
│  │   主进程 + 子进程    │         │   单进程 + IO多路复用 │         │
│  └─────────────────────┘         └─────────────────────┘         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Node.js 事件循环机制

> **考点：事件驱动架构、异步 I/O、非阻塞模型**

```
Node.js 事件循环（Event Loop）阶段：

  ┌──────────────────────────┐
  │         timers           │ ← setTimeout/setInterval 回调
  └──────────────┬───────────┘
                 ↓
  ┌──────────────────────────┐
  │    pending callbacks     │ ← I/O 错误回调
  └──────────────┬───────────┘
                 ↓
  ┌──────────────────────────┐
  │         idle/prepare     │ ← 内部使用
  └──────────────┬───────────┘
                 ↓
  ┌──────────────────────────┐
  │           poll           │ ← 等待新的 I/O 事件
  └──────────────┬───────────┘
                 ↓
  ┌──────────────────────────┐
  │           check          │ ← setImmediate 回调
  └──────────────┬───────────┘
                 ↓
  ┌──────────────────────────┐
  │      close callbacks     │ ← socket.destroy() 等
  └──────────────────────────┘
```

**关键原则：**
- 所有 I/O 操作（DB 查询、HTTP 请求、文件读写）必须异步（`async/await`）
- 避免在事件循环中执行 CPU 密集型操作（如大量同步计算）
- CPU 密集任务使用 `worker_threads` 或独立子进程处理

---

## 3. 请求处理并发模型

### 3.1 Gateway 请求处理流程（并发）

```
时间轴 →

请求1: ────[Auth MW]────[Rate Limit]────[Proxy]────→ Auth Service
请求2:      ────[Auth MW]────[Rate Limit]────[Proxy]────→ Tool Registry
请求3:           ────[Auth MW]──X (限流拒绝，立即返回 429)
请求4:                ────[Auth MW]────[Proxy]──X (熔断，立即返回 503)

✅ 异步非阻塞：多请求并发处理，不互相阻塞
✅ 中间件管道：每个请求经过完整的中间件链
✅ 快速失败：限流/熔断立即返回，不等待下游
```

### 3.2 数据库连接池管理

```typescript
// Prisma 连接池配置
// 考点：数据库连接池、资源管理
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // 连接池大小 = CPU 核数 * 2 + 1（经验公式）
  // 对于 PostgreSQL，默认连接池大小为 10
});
```

---

## 4. 服务间通信机制

> **考点：分布式系统通信 - 同步 vs 异步**

### 4.1 同步通信（当前实现）

```
Gateway ──HTTP/REST──→ Auth Service
Gateway ──HTTP/REST──→ Tool Registry
```

**特点：**
- 请求-响应模式，调用方等待响应
- 适合需要立即返回结果的场景
- 服务耦合度相对较高（需要目标服务可用）

### 4.2 异步通信（预留扩展）

```
工具执行服务 ──发布消息──→ Message Queue (Redis Pub/Sub)
                                        ↓ 订阅
                              日志服务 / 统计服务
```

**特点：**
- 发布-订阅模式，发送方不等待
- 适合事件通知、日志、统计等场景
- 服务解耦度高，但增加系统复杂性

---

## 5. 超时与重试策略

> **考点：分布式系统容错设计**

| 场景 | 超时设置 | 重试策略 |
|------|---------|---------|
| Gateway → 微服务 | 5000ms | 不重试（幂等性未知）|
| 数据库查询 | 3000ms | 指数退避，最多3次 |
| Redis 操作 | 1000ms | 不重试（快速失败）|
| 健康检查 | 2000ms | 间隔30秒，持续重试 |

### 指数退避算法

```typescript
// 考点：指数退避（Exponential Backoff）
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      // 指数退避：1s, 2s, 4s...（加入随机抖动防止惊群效应）
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## 6. 进程生命周期管理

### 6.1 优雅关闭（Graceful Shutdown）

> **考点：高可用设计、零停机部署**

```typescript
// 监听关闭信号，优雅关闭服务
// 考点：进程信号处理、资源清理
process.on('SIGTERM', async () => {
  console.log('收到 SIGTERM 信号，开始优雅关闭...');
  
  // 1. 停止接受新请求
  server.close(async () => {
    // 2. 等待现有请求处理完成（最多30秒）
    // 3. 关闭数据库连接
    await prisma.$disconnect();
    // 4. 关闭 Redis 连接
    await redisClient.quit();
    // 5. 退出进程
    process.exit(0);
  });
  
  // 超时强制退出
  setTimeout(() => process.exit(1), 30000);
});
```

### 6.2 健康检查端点

```
GET /health → 200 OK
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00Z",
  "version": "1.0.0",
  "uptime": 3600,
  "dependencies": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```
