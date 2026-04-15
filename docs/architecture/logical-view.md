# 逻辑视图（Logical View）

> 考点关联：**4+1视图 - 逻辑视图**、**领域建模**、**面向对象分析设计**

逻辑视图描述系统的功能分解、核心领域模型以及各模块的职责边界。它关注系统的**功能需求**，是面向最终用户和开发者的视图。

---

## 1. 系统功能分解（功能结构图）

```
在线工具聚合平台
├── 用户管理子系统
│   ├── 注册/登录
│   ├── 个人信息管理
│   └── 权限管理（RBAC）
├── API 网关子系统
│   ├── 请求路由
│   ├── 认证验证（JWT）
│   ├── 限流控制（令牌桶）
│   └── 熔断保护（状态机）
├── 工具注册子系统
│   ├── 工具注册/注销
│   ├── 服务发现
│   ├── 健康检查
│   └── 元数据管理
└── 工具执行子系统
    ├── 工具调用
    ├── 结果缓存
    └── 执行日志
```

---

## 2. 核心领域模型

### 2.1 领域实体关系图

```
┌──────────────────┐          ┌──────────────────────┐
│      User        │          │        Tool          │
│──────────────────│          │──────────────────────│
│ id: string       │          │ id: string           │
│ email: string    │          │ name: string         │
│ username: string │          │ description: string  │
│ passwordHash:str │  1    *  │ endpoint: string     │
│ role: UserRole   │──────────│ version: string      │
│ createdAt: Date  │  拥有工具  │ status: ToolStatus  │
│ updatedAt: Date  │  (收藏)   │ tags: string[]       │
└──────────────────┘          │ ownerId: string      │
         │                    │ createdAt: Date      │
         │ 1                  └──────────────────────┘
         │                              │
         │ *                            │ 1
┌──────────────────┐          ┌──────────────────────┐
│   UserSession    │          │     ToolExecution    │
│──────────────────│          │──────────────────────│
│ id: string       │          │ id: string           │
│ userId: string   │          │ toolId: string       │
│ token: string    │          │ userId: string       │
│ expiresAt: Date  │          │ input: JSON          │
│ createdAt: Date  │          │ output: JSON         │
└──────────────────┘          │ duration: number     │
                              │ status: ExecStatus   │
                              │ createdAt: Date      │
                              └──────────────────────┘
```

### 2.2 领域枚举定义

```typescript
// 用户角色（RBAC 角色定义）
// 考点：基于角色的访问控制（RBAC）
enum UserRole {
  ADMIN = 'ADMIN',       // 管理员：可管理所有工具和用户
  DEVELOPER = 'DEV',     // 开发者：可注册和管理自己的工具
  USER = 'USER'          // 普通用户：可使用工具
}

// 工具状态（状态机）
enum ToolStatus {
  PENDING = 'PENDING',   // 待审核
  ACTIVE = 'ACTIVE',     // 已激活（可被调用）
  DEPRECATED = 'DEPRECATED', // 已废弃（仍可调用但提示迁移）
  INACTIVE = 'INACTIVE'  // 已下线（不可调用）
}

// 执行状态
enum ExecutionStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT'
}
```

---

## 3. 模块职责定义

### 3.1 API Gateway 模块

| 职责 | 说明 | 设计模式 |
|------|------|---------|
| 请求路由 | 根据路径将请求转发到对应的微服务 | 代理模式（Proxy）|
| 认证验证 | 验证 JWT Token 的合法性 | 装饰器模式（Decorator）|
| 限流控制 | 令牌桶算法控制请求速率 | 策略模式（Strategy）|
| 熔断保护 | 状态机检测下游服务健康 | 状态模式（State）|
| 日志聚合 | 统一记录所有请求日志 | 观察者模式（Observer）|

### 3.2 Auth Service 模块

| 职责 | 说明 |
|------|------|
| 用户注册 | 邮箱/密码注册，bcrypt 哈希存储 |
| 用户登录 | 验证凭证，签发 JWT（Access + Refresh Token）|
| Token 刷新 | 使用 Refresh Token 换取新的 Access Token |
| 权限验证 | 验证用户是否有权执行特定操作（RBAC）|
| 密码重置 | 邮件验证码重置密码流程 |

### 3.3 Tool Registry 模块

| 职责 | 说明 |
|------|------|
| 工具注册 | 开发者提交工具元数据 |
| 服务发现 | 返回可用工具列表（支持标签过滤）|
| 健康检查 | 定期 Ping 注册的工具服务端点 |
| 版本管理 | 支持工具多版本并存 |

---

## 4. 分层架构约束

> **考点：分层架构（Layered Architecture）** — 关注职责分离和依赖方向

```
┌─────────────────────────────────────────┐
│         Controller 层（表示层）           │
│   处理 HTTP 请求/响应，参数校验，DTO转换    │
│   不包含业务逻辑，只调用 Service           │
└─────────────────────┬───────────────────┘
                       │ 调用（单向）
                       ▼
┌─────────────────────────────────────────┐
│          Service 层（业务逻辑层）          │
│   核心业务规则，事务管理，跨 Repository 协调 │
│   不直接操作数据库，通过 Repository 访问    │
└─────────────────────┬───────────────────┘
                       │ 调用（单向）
                       ▼
┌─────────────────────────────────────────┐
│       Repository 层（数据访问层）          │
│   封装数据库操作，提供领域对象的增删改查     │
│   使用 Prisma ORM，不暴露 DB 细节         │
└─────────────────────────────────────────┘
```

**违规示例（禁止）：**
```typescript
// ❌ 禁止：Controller 直接操作 Repository
class AuthController {
  constructor(private userRepo: UserRepository) {} // 违规！
}

// ✅ 正确：Controller 只依赖 Service
class AuthController {
  constructor(private authService: AuthService) {} // 正确
}
```
