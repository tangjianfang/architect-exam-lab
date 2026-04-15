# ADR-003：采用 Cache-Aside 缓存策略

| 字段 | 内容 |
|------|------|
| **ADR 编号** | ADR-003 |
| **标题** | 采用 Cache-Aside（旁路缓存）模式 + Redis 实现分布式缓存 |
| **日期** | 2025-01-03 |
| **状态** | ✅ 已接受（Accepted）|
| **关联考点** | 分布式缓存、CAP 理论、缓存一致性、缓存穿透/击穿/雪崩 |

---

## 背景与问题

工具聚合平台存在以下性能和可用性挑战：

1. **工具元数据高频读取**：每次 API 调用都需要查询工具的路由信息，数据库压力大
2. **用户认证信息重复查询**：Token 验证需要频繁查询用户信息
3. **P99 响应时间目标**：< 200ms，但数据库查询平均耗时 ~50ms
4. **读写比例**：工具元数据读:写 ≈ 1000:1，非常适合缓存

**核心问题**：如何在保证数据一致性的前提下，通过缓存将响应时间降低到目标水平？

---

## 背景知识：CAP 理论

> **考点：CAP 理论**（Brewer 定理，2000年）

CAP 理论指出，分布式系统无法同时满足以下三个保证：

| 特性 | 说明 |
|------|------|
| **C - 一致性（Consistency）** | 所有节点在同一时刻看到相同的数据 |
| **A - 可用性（Availability）** | 每个请求都能收到（不一定是最新）响应 |
| **P - 分区容错性（Partition Tolerance）** | 网络分区时系统仍能继续运行 |

在分布式系统中，网络分区（P）不可避免，因此需要在 **C** 和 **A** 之间权衡：

- **CP 系统**（如 ZooKeeper）：一致性 > 可用性
- **AP 系统**（如 Redis、DNS）：可用性 > 一致性
- **本项目 Redis 选择 AP**：允许缓存短暂不一致（通过 TTL 控制），保证高可用

---

## 可选方案

### 方案一：Cache-Aside（旁路缓存 / Lazy Loading）

应用层手动管理缓存，读时先查缓存，缓存未命中再查数据库，然后写入缓存。

```
读操作：
  ① 查询缓存 (Redis)
  ② 缓存命中 → 直接返回
  ③ 缓存未命中 → 查询数据库 → 写入缓存 → 返回

写操作：
  ① 更新数据库
  ② 删除缓存（让下次读时重新加载）
```

**优点：**
- 只缓存被实际请求的数据，避免预加载无效数据
- 缓存和数据库解耦，缓存故障不影响主链路
- 实现简单，易于理解和测试

**缺点：**
- 首次访问（缓存冷启动）有额外数据库查询延迟
- 写操作后的短暂数据不一致（直到缓存过期或被删除）

### 方案二：Write-Through（直写缓存）

每次写数据库时同时更新缓存。

**优点：** 缓存和数据库数据强一致

**缺点：** 写操作性能下降（同时写两处）；可能缓存大量不会被读取的数据

### 方案三：Write-Behind（异步回写）

先更新缓存，异步批量写入数据库。

**优点：** 写性能极高

**缺点：** 数据丢失风险；实现复杂；不适合强一致性场景

---

## 决策结果

**选择方案一：Cache-Aside + Redis**

**选择理由：**
1. **读多写少场景最优**：工具元数据几乎是只读的，Cache-Aside 最适合
2. **容错性好**：Redis 宕机时降级到直接读数据库，可用性高
3. **覆盖考点**：Cache-Aside 是最重要的缓存模式，软考必考
4. **可接受的一致性**：工具元数据允许 5 分钟内的短暂不一致

---

## 缓存实现策略

### 缓存 Key 设计规范

```
格式：{namespace}:{entity}:{identifier}
示例：
  toollab:tool:text-converter        ← 工具信息缓存
  toollab:user:user123               ← 用户信息缓存
  toollab:rate-limit:ip:192.168.1.1  ← 限流计数器
  toollab:session:token-hash         ← 会话状态
```

### TTL（过期时间）设置

| 数据类型 | TTL | 理由 |
|---------|-----|------|
| 工具元数据 | 300 秒（5 分钟）| 变更频率低，可容忍短暂不一致 |
| 用户信息 | 60 秒（1 分钟）| 权限变更需较快生效 |
| 限流计数器 | 60 秒（滑动窗口）| 固定窗口限流周期 |
| 健康检查结果 | 30 秒 | 需要较快感知服务状态变化 |

### 缓存穿透防护

> **考点：缓存穿透** — 查询不存在的 Key，每次都穿透到数据库

```typescript
// 防护策略：缓存空值（Null Object Pattern）
async function getToolWithCache(toolId: string): Promise<Tool | null> {
  const cached = await redis.get(`toollab:tool:${toolId}`);

  if (cached === 'NULL') {
    return null;  // 已知不存在，直接返回 null
  }

  if (cached) {
    return JSON.parse(cached);
  }

  const tool = await db.findTool(toolId);

  if (!tool) {
    // 缓存空值，TTL 设置较短（60秒），防止缓存污染
    await redis.setEx(`toollab:tool:${toolId}`, 60, 'NULL');
    return null;
  }

  await redis.setEx(`toollab:tool:${toolId}`, 300, JSON.stringify(tool));
  return tool;
}
```

### 缓存击穿防护

> **考点：缓存击穿** — 热点 Key 过期瞬间，大量请求同时打到数据库

```typescript
// 防护策略：互斥锁（Mutex Lock）
// 考点：分布式锁
async function getHotKeyWithLock(key: string): Promise<string | null> {
  const cached = await redis.get(key);
  if (cached) return cached;

  // 尝试获取分布式锁（SET NX EX）
  const lockKey = `lock:${key}`;
  const lockAcquired = await redis.set(lockKey, '1', { NX: true, EX: 5 });

  if (lockAcquired) {
    try {
      const value = await db.query(key);
      await redis.setEx(key, 300, value);
      return value;
    } finally {
      await redis.del(lockKey);  // 释放锁
    }
  } else {
    // 未获得锁，等待后重试（其他进程正在重建缓存）
    await sleep(100);
    return redis.get(key);
  }
}
```

### 缓存雪崩防护

> **考点：缓存雪崩** — 大量 Key 同时过期，导致数据库压力骤增

```typescript
// 防护策略：TTL 加随机抖动
function getTtlWithJitter(baseTtl: number): number {
  // 在基础 TTL 上增加 ±20% 的随机抖动，避免同时过期
  const jitter = baseTtl * 0.2 * (Math.random() * 2 - 1);
  return Math.floor(baseTtl + jitter);
}
```

---

## ATAM 质量属性影响分析

| 质量属性 | 影响方向 | 分析 |
|---------|---------|------|
| **性能（Performance）** | ✅ 显著正面 | 缓存命中时响应时间从 ~50ms 降到 ~2ms（25倍提升） |
| **可用性（Availability）** | ✅ 正面 | Redis 宕机可降级到数据库，主链路不中断 |
| **一致性（Consistency）** | ⚠️ 负面 | 缓存与数据库存在 TTL 内的短暂不一致（可接受的权衡）|
| **可修改性（Modifiability）** | ✅ 正面 | 缓存策略通过 `shared/cache` 抽象层封装，可切换实现 |
| **可测试性（Testability）** | ✅ 正面 | 抽象 CacheStrategy 接口，测试时可用 MemoryCache 替换 Redis |
| **运维复杂度** | ⚠️ 负面 | 增加 Redis 组件，需要监控和维护 |

---

## 参考资料

- Martin Fowler - [Cache-Aside Pattern](https://martinfowler.com/bliki/TwoHardThings.html)
- Microsoft Azure - [缓存模式](https://docs.microsoft.com/azure/architecture/patterns/cache-aside)
- 《系统架构设计师教程》分布式存储章节
- CAP 理论原文：Brewer, E. (2000). *Towards robust distributed systems*
