# ADR-004：认证授权设计 — JWT + RBAC

| 字段 | 内容 |
|------|------|
| **ADR 编号** | ADR-004 |
| **标题** | 采用 JWT 无状态认证 + RBAC 权限控制 |
| **日期** | 2025-01-04 |
| **状态** | ✅ 已接受（Accepted）|
| **关联考点** | 安全架构、认证与授权、RBAC、JWT |

---

## 背景与问题

微服务架构中的认证授权设计面临特殊挑战：

1. **无状态服务**：微服务应该是无状态的，传统 Session-Cookie 方案需要共享 Session 存储
2. **多服务认证**：每个服务都需要验证请求者的身份，不能每次都查数据库
3. **权限粒度**：不同角色（管理员、开发者、普通用户）的权限差异显著
4. **Token 失效问题**：用户账户被封禁时，如何立即使其 Token 失效？

---

## 可选方案

### 方案一：Session-Cookie（有状态认证）

服务器端存储 Session，Cookie 中只存 Session ID。

**优点：**
- Token 可立即失效（删除服务器端 Session）
- Session 数据不暴露给客户端

**缺点：**
- 微服务架构中需要共享 Session 存储（如 Redis）
- 每次请求都需要查询 Session 存储，有额外 I/O
- 水平扩展时 Session 同步复杂

### 方案二：JWT（无状态认证）

将用户信息编码到 Token 中，服务端通过签名验证，无需查询数据库。

**优点：**
- 无状态，天然支持水平扩展
- 减少数据库查询（验证时只需校验签名）
- 标准化（RFC 7519），生态成熟
- Token 携带用户信息，服务间无需额外查询

**缺点：**
- Token 一旦签发，在过期前无法真正撤销（可通过黑名单补偿）
- Token 较大（Base64 编码后约 200-500 字节）

### 方案三：OAuth 2.0 + OIDC

使用标准授权协议，引入 Authorization Server。

**优点：**
- 支持第三方登录（GitHub、Google 等）
- 标准化，安全性经过验证

**缺点：**
- 实现复杂，对备考项目来说过于重量级
- 需要额外的 Authorization Server 组件

---

## 决策结果

**选择方案二：JWT + RBAC**

**双 Token 策略（Access Token + Refresh Token）：**

```
Access Token：
  - 有效期：15 分钟（短生命周期，降低泄露风险）
  - 携带信息：{ userId, email, role, iat, exp }
  - 存储：客户端内存（不存 localStorage，防 XSS）
  - 验证：Gateway 中间件拦截，验证签名和有效期

Refresh Token：
  - 有效期：7 天（长生命周期）
  - 携带信息：{ userId, tokenVersion }（最小信息）
  - 存储：HttpOnly Cookie（防 XSS）+ 数据库记录（支持撤销）
  - 验证：Auth Service 专用接口
```

---

## JWT 结构详解

> **考点：JWT 结构** — Header.Payload.Signature

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.    ← Header（Base64）
eyJ1c2VySWQiOiJ1c2VyMTIzIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3MDAwMDAwMDB9.  ← Payload（Base64）
HMACSHA256(base64(header) + "." + base64(payload), secret)                 ← Signature
```

**Header：**
```json
{ "alg": "HS256", "typ": "JWT" }
```

**Payload（Access Token）：**
```json
{
  "userId": "user-uuid-123",
  "email": "user@example.com",
  "role": "USER",
  "iat": 1700000000,    // 签发时间
  "exp": 1700000900     // 过期时间（15分钟后）
}
```

---

## RBAC 权限模型设计

> **考点：基于角色的访问控制（RBAC, Role-Based Access Control）**

```
主体（Subject）→ 角色（Role）→ 权限（Permission）→ 资源（Resource）

用户 tangjianfang ─→ ADMIN 角色 ─→ [READ, WRITE, DELETE] ─→ 所有资源
用户 developer123 ─→ DEVELOPER 角色 ─→ [READ, WRITE] ─→ 自己的工具
用户 enduser456  ─→ USER 角色    ─→ [READ] ─→ 工具列表/调用工具
```

### 权限矩阵

| 操作 | ADMIN | DEVELOPER | USER |
|------|-------|-----------|------|
| 查看工具列表 | ✅ | ✅ | ✅ |
| 调用工具 API | ✅ | ✅ | ✅ |
| 注册新工具 | ✅ | ✅ | ❌ |
| 管理自己的工具 | ✅ | ✅ | ❌ |
| 管理所有工具 | ✅ | ❌ | ❌ |
| 管理用户 | ✅ | ❌ | ❌ |
| 查看系统指标 | ✅ | ❌ | ❌ |

---

## Token 撤销机制（解决 JWT 无状态问题）

> **权衡**：纯 JWT 无状态无法撤销，引入 Redis 黑名单在可用性和一致性间折中

```typescript
// 策略：Token 版本号（tokenVersion）
// 当用户修改密码或管理员封禁账户时，递增 tokenVersion
// 验证时检查 Token 中的 tokenVersion 是否与数据库一致

interface TokenPayload {
  userId: string;
  role: UserRole;
  tokenVersion: number;  // 版本号
  iat: number;
  exp: number;
}

// 验证流程
// 1. 验证 JWT 签名（无需数据库）
// 2. 检查 Redis 黑名单（高速缓存）
// 3. 必要时查数据库 tokenVersion（权限变更时）
```

---

## 密码安全策略

> **考点：密码安全** — 哈希算法选择

| 算法 | 是否推荐 | 理由 |
|------|---------|------|
| MD5 | ❌ 禁止 | 已被破解，速度太快（易暴力破解）|
| SHA-256 | ❌ 不推荐 | 无盐值，速度快，容易被彩虹表攻击 |
| bcrypt | ✅ 推荐 | 自带盐值，成本因子可调，专为密码设计 |
| Argon2id | ✅ 最佳 | 2015 密码哈希竞赛冠军，抗 GPU 攻击 |

**本项目使用 bcrypt（cost factor = 12）**

---

## ATAM 质量属性影响分析

| 质量属性 | 影响方向 | 分析 |
|---------|---------|------|
| **安全性（Security）** | ✅ 正面 | JWT 签名防篡改；bcrypt 密码哈希；HttpOnly Cookie 防 XSS |
| **性能（Performance）** | ✅ 正面 | Gateway 验证 JWT 只需验证签名，无需数据库查询 |
| **可用性（Availability）** | ✅ 正面 | 无状态 Token，任意服务实例可验证，不依赖共享存储 |
| **可修改性（Modifiability）** | ⚠️ 中性 | Token 格式变更需要版本兼容处理 |
| **不可抵赖性（Non-repudiation）** | ✅ 正面 | JWT 记录用户 ID 和操作时间，操作可追溯 |

---

## 安全最佳实践清单

- [x] JWT 密钥从环境变量读取，不硬编码
- [x] Access Token 有效期 ≤ 15 分钟
- [x] Refresh Token 使用 HttpOnly Cookie 存储
- [x] 密码使用 bcrypt 哈希，cost factor ≥ 12
- [x] 登录接口防暴力破解（限速：5次/分钟/IP）
- [x] HTTPS 传输（生产环境强制）
- [x] 敏感字段（密码哈希）不在 API 响应中返回
- [x] JWT Payload 不存储敏感信息（仅 userId、role）

---

## 参考资料

- RFC 7519 - JSON Web Token (JWT)
- NIST SP 800-63B - 数字身份认证指南
- OWASP Authentication Cheat Sheet
- 《系统架构设计师教程》安全架构章节
