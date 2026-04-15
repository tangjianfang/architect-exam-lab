# GitHub Copilot 自定义指令

> 本文件为 GitHub Copilot 提供项目级别的上下文和代码规范，确保 AI 辅助编码符合项目要求。

---

## 项目概述

**architect-exam-lab** 是一个以「在线工具聚合平台」为业务场景的微服务架构备考实战项目，目标是通过构建真实系统复现软考系统架构设计师（高级）的所有核心考点。

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 语言 | TypeScript 5.x（严格模式） |
| 运行时 | Node.js 20+ |
| 框架 | Express.js |
| 数据库 | PostgreSQL + Prisma ORM |
| 缓存 | Redis |
| 测试 | Vitest（单元）+ Playwright（E2E） |
| 容器 | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| 包管理 | pnpm workspaces（Monorepo） |

---

## 代码规范

### 命名规范
- **变量/函数**：camelCase（例：`getUserById`）
- **类/接口/类型**：PascalCase（例：`UserRepository`、`ApiResponse`）
- **常量**：UPPER_SNAKE_CASE（例：`MAX_RETRY_COUNT`）
- **文件名**：kebab-case（例：`auth.service.ts`、`rate-limiter.ts`）
- **目录名**：kebab-case（例：`auth-service`、`tool-registry`）

### 文件结构规范
每个微服务遵循以下目录结构：
```
packages/<service-name>/
├── src/
│   ├── index.ts           # 入口文件
│   ├── controllers/       # 控制器层（处理 HTTP 请求/响应）
│   ├── services/          # 业务逻辑层
│   ├── repositories/      # 数据访问层
│   ├── middleware/        # 中间件
│   └── types/             # 局部类型定义
├── tests/                 # 测试文件（与 src 同级）
├── package.json
└── tsconfig.json
```

### 注释规范
- **设计模式必须标注**：`// 设计模式：策略模式 (Strategy Pattern)`
- **考点关联必须标注**：`// 考点：CAP 理论 - 缓存一致性`
- **复杂算法必须有中文注释说明原理**
- 使用 JSDoc 风格注释公共 API

---

## 架构约束（分层架构）

### 分层规则
```
Controller → Service → Repository
```

严格遵守以下约束：

1. **Controller 层**：只处理 HTTP 请求解析和响应格式化，调用 Service 层
2. **Service 层**：包含业务逻辑，可调用 Repository 层和其他 Service
3. **Repository 层**：只负责数据访问，不包含业务逻辑

### 禁止的调用方式
- ❌ Controller 直接导入或调用 Repository
- ❌ Repository 导入 Service
- ❌ 跨微服务直接调用（必须通过 API Gateway）
- ❌ 在 Repository 层写业务逻辑
- ❌ 在 Controller 层写 SQL 或直接操作数据库

---

## 安全规则

1. **禁止硬编码密钥**：所有密钥、Token、密码必须从环境变量读取
   ```typescript
   // ✅ 正确
   const jwtSecret = process.env.JWT_SECRET;
   // ❌ 错误
   const jwtSecret = 'my-hardcoded-secret';
   ```

2. **必须参数化查询**：禁止字符串拼接 SQL
   ```typescript
   // ✅ 正确（Prisma ORM）
   await prisma.user.findUnique({ where: { id: userId } });
   // ❌ 错误
   await db.query(`SELECT * FROM users WHERE id = ${userId}`);
   ```

3. **禁止使用 eval() 和 innerHTML**：防止 XSS/代码注入
4. **JWT 必须验证签名**：不能仅解码，必须 `verify()` 而非 `decode()`
5. **密码必须使用 bcrypt 哈希**：禁止明文存储
6. **HTTP 请求必须验证输入**：使用 Zod 或 Joi 进行 Schema 验证
7. **敏感信息不得写入日志**

---

## 测试要求

1. **每个 Service 类必须有对应的单元测试文件**（`*.service.test.ts`）
2. **测试覆盖率阈值**：
   - 语句覆盖率 ≥ 80%
   - 分支覆盖率 ≥ 75%
3. **测试命名规范**：`describe('ServiceName', () => { it('should ...', () => { }) })`
4. **使用 Mock 隔离依赖**：Repository 层在 Service 测试中必须 Mock
5. **测试文件位置**：与被测文件同目录，命名为 `<filename>.test.ts`

---

## 设计模式要求

在代码中使用设计模式时，必须在相关代码位置添加注释标注：

```typescript
// 设计模式：单例模式 (Singleton Pattern)
// 考点：对象创建型模式

// 设计模式：策略模式 (Strategy Pattern)
// 考点：对象行为型模式 - 算法替换

// 设计模式：装饰器模式 (Decorator Pattern)
// 考点：结构型模式 - 功能增强

// 设计模式：工厂方法模式 (Factory Method Pattern)
// 考点：创建型模式
```

项目中使用的主要设计模式：
| 模式 | 应用位置 | 考点 |
|------|---------|------|
| 单例模式 | Logger、Cache | 创建型模式 |
| 策略模式 | CacheStrategy | 行为型模式 |
| 装饰器模式 | Auth Middleware | 结构型模式 |
| 状态机模式 | Circuit Breaker | 行为型模式 |
| 仓储模式 | UserRepository | 架构模式 |
| API Gateway 模式 | gateway/src/index.ts | 微服务模式 |

---

## 考试知识点关联说明

本项目覆盖的软考系统架构设计师核心考点：

| 知识领域 | 考点 | 项目对应文件 |
|---------|------|------------|
| 架构风格 | 微服务、事件驱动 | `docs/architecture/overview.md` |
| 架构评估 | ATAM 质量属性 | `docs/adr/001-microservice-architecture.md` |
| 设计模式 | GoF 23种模式 | 各 `src/` 文件 |
| 分布式系统 | CAP理论、一致性 | `docs/adr/003-cache-strategy.md` |
| 安全架构 | JWT、RBAC | `docs/adr/004-auth-design.md` |
| UML建模 | 4+1视图 | `docs/uml/` |
| 云原生 | Docker、K8s | `infrastructure/` |
| 软件工程 | CI/CD、DevOps | `.github/workflows/` |

---

## 构建与运行命令

```bash
# 安装依赖
pnpm install

# 启动开发环境
docker-compose -f infrastructure/docker/docker-compose.yml up -d
pnpm dev

# 运行测试
pnpm test

# 代码检查
pnpm lint

# 类型检查
pnpm typecheck

# 架构边界检查
pnpm architecture-check

# 构建生产版本
pnpm build
```

---

## AI 辅助编码指南

当使用 GitHub Copilot 编写代码时：

1. **优先使用已有的共享模块**（`packages/shared/`）
2. **新建 Service 时同步创建测试文件**
3. **每个公共函数都添加 JSDoc 注释**
4. **数据库操作使用 Prisma ORM**，禁止原始 SQL（特殊性能优化场景除外）
5. **错误处理**：使用统一的 `ApiError` 类，不要抛出原始 Error
6. **日志**：使用 `packages/shared/logger`，不要直接使用 `console.log`
