# 开发视图（Development View）

> 考点关联：**4+1视图 - 开发视图**、**软件包结构**、**模块化设计**、**依赖管理**

开发视图（也称实现视图）描述系统的代码组织结构、包依赖关系和开发规范，是面向**开发者**的视图。

---

## 1. Monorepo 目录结构

```
architect-exam-lab/                  # 根目录（pnpm workspace）
├── .github/                         # GitHub 配置
│   ├── copilot-instructions.md      # Copilot 自定义指令
│   ├── CODEOWNERS                   # 代码所有者
│   ├── ISSUE_TEMPLATE/              # Issue 模板
│   └── workflows/                   # CI/CD 流水线
│       ├── ci.yml                   # 持续集成
│       └── security.yml             # 安全扫描
│
├── docs/                            # 项目文档
│   ├── architecture/                # 4+1 视图架构文档
│   ├── adr/                         # 架构决策记录
│   ├── uml/                         # UML 图（PlantUML）
│   ├── study-plan.md                # 12周学习计划
│   └── exam-knowledge-map.md        # 考点知识图谱
│
├── packages/                        # 微服务包（pnpm workspaces）
│   ├── gateway/                     # API 网关服务
│   │   ├── src/
│   │   │   ├── index.ts             # 入口文件
│   │   │   └── middleware/          # 中间件
│   │   │       ├── auth.ts          # JWT 认证中间件
│   │   │       ├── rate-limiter.ts  # 限流中间件
│   │   │       └── circuit-breaker.ts # 熔断中间件
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── auth-service/                # 认证服务
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── controllers/         # 控制器层
│   │   │   ├── services/            # 业务逻辑层
│   │   │   └── repositories/        # 数据访问层
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── tool-registry/               # 工具注册中心
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                      # 共享模块
│       ├── types/src/index.ts       # 共享类型定义
│       ├── logger/src/index.ts      # 统一日志
│       └── cache/src/index.ts       # 缓存抽象
│
├── infrastructure/                  # 基础设施配置
│   ├── docker/                      # Docker 配置
│   │   ├── docker-compose.yml       # 本地开发环境
│   │   └── Dockerfile.service       # 通用服务镜像
│   └── k8s/                         # Kubernetes 配置
│       ├── namespace.yml
│       └── gateway-deployment.yml
│
├── tests/                           # 全局测试工具
│   └── architecture-check.sh        # 架构边界检查脚本
│
├── package.json                     # 根 package.json
├── pnpm-workspace.yaml              # pnpm workspace 配置
├── tsconfig.json                    # 根 TypeScript 配置
├── tsconfig.base.json               # 基础 TS 配置（共享）
├── .eslintrc.json                   # ESLint 配置
├── .prettierrc                      # Prettier 配置
└── .gitignore
```

---

## 2. 包依赖关系

```
                    ┌─────────────────┐
                    │   shared/types  │ ← 无依赖，被所有包引用
                    └────────┬────────┘
                             │ 被引用
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐
│  shared/logger   │  │ shared/cache │  │   (其他 shared)   │
│  (依赖 types)    │  │ (依赖 types) │  │                  │
└────────┬─────────┘  └──────┬───────┘  └──────────────────┘
         │                   │
         └────────┬──────────┘
                  │ 被引用
    ┌─────────────┼─────────────────┐
    ▼             ▼                 ▼
┌─────────┐ ┌──────────────┐ ┌──────────────┐
│ gateway │ │ auth-service │ │tool-registry │
└─────────┘ └──────────────┘ └──────────────┘
```

**依赖规则：**
- `shared/*` 包不能依赖任何 `packages/*` 服务
- 微服务之间不能直接互相 import（必须通过 HTTP/事件）
- 所有服务可以依赖 `shared/*` 包

---

## 3. TypeScript 配置继承链

```
tsconfig.base.json          # 基础配置（strict, paths, etc.）
     ↑ extends
tsconfig.json               # 根目录配置（project references）
     ↑ extends
packages/*/tsconfig.json    # 各包配置（include/exclude/outDir）
```

### tsconfig.base.json 关键配置

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "strict": true,              // 严格模式
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,      // 禁止未使用变量
    "noUnusedParameters": true,  // 禁止未使用参数
    "noImplicitReturns": true,   // 禁止隐式返回
    "exactOptionalPropertyTypes": true
  }
}
```

---

## 4. 开发规范

### 4.1 文件命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| TypeScript 文件 | kebab-case | `auth.service.ts` |
| 测试文件 | `*.test.ts` | `auth.service.test.ts` |
| 类型定义 | `*.types.ts` 或 `types/index.ts` | `user.types.ts` |
| 中间件 | `*.middleware.ts` 或 kebab-case | `rate-limiter.ts` |
| 配置文件 | kebab-case | `vitest.config.ts` |

### 4.2 模块导入顺序

```typescript
// 1. Node.js 内置模块
import path from 'node:path';

// 2. 第三方库
import express from 'express';
import { z } from 'zod';

// 3. 内部共享模块（@shared/*）
import { logger } from '@shared/logger';
import type { ApiResponse } from '@shared/types';

// 4. 相对路径导入
import { AuthService } from './services/auth.service';
```

### 4.3 导出规范

- 每个模块使用 `index.ts` 作为公共 API 的统一出口
- 只导出需要对外暴露的内容，内部实现细节不导出
- 优先使用命名导出，避免默认导出（除入口文件）

---

## 5. 测试组织结构

```
packages/auth-service/
├── src/
│   ├── services/
│   │   ├── auth.service.ts
│   │   └── auth.service.test.ts    ← 单元测试与源码同目录
│   └── repositories/
│       ├── user.repository.ts
│       └── user.repository.test.ts
└── vitest.config.ts
```

**覆盖率要求：**
- 语句覆盖率（Statement） ≥ 80%
- 分支覆盖率（Branch） ≥ 75%
- 函数覆盖率（Function） ≥ 80%
