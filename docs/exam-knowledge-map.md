# 软考系统架构设计师考点知识图谱

> 将软考系统架构设计师（高级）2025 年考纲的所有核心考点映射到本项目的具体文件/代码/文档。

---

## 📐 一、架构设计基础

| 考点 | 重要程度 | 项目对应文件 | 备注 |
|------|---------|------------|------|
| 软件架构定义与作用 | ⭐⭐⭐⭐⭐ | `docs/architecture/overview.md` | 高频考点 |
| 4+1 视图模型（Kruchten） | ⭐⭐⭐⭐⭐ | `docs/architecture/` 目录 | 每年必考 |
| 架构风格：管道过滤器 | ⭐⭐⭐ | `docs/architecture/overview.md` | 了解即可 |
| 架构风格：调用/返回 | ⭐⭐⭐⭐ | `packages/*/src/` 分层结构 | 重点 |
| 架构风格：事件驱动 | ⭐⭐⭐⭐ | `docs/architecture/process-view.md` | 重点 |
| 架构风格：微服务 | ⭐⭐⭐⭐⭐ | 整个项目 | 必考 |
| 架构风格：SOA vs 微服务 | ⭐⭐⭐⭐ | `docs/adr/001-microservice-architecture.md` | 常考对比 |
| 分层架构约束 | ⭐⭐⭐⭐ | `tests/architecture-check.sh` | 实践验证 |
| ATAM 架构评估方法 | ⭐⭐⭐⭐⭐ | `docs/adr/` 所有 ADR | 论文核心 |
| CBAM 成本收益分析 | ⭐⭐⭐ | `docs/adr/001-*.md` | 了解 |
| 质量属性：性能/可用性 | ⭐⭐⭐⭐⭐ | `docs/architecture/overview.md` | 必考 |
| 质量属性：安全性 | ⭐⭐⭐⭐⭐ | `docs/adr/004-auth-design.md` | 必考 |
| 质量属性：可修改性 | ⭐⭐⭐⭐ | `docs/architecture/logical-view.md` | 重点 |

---

## 🎨 二、设计模式

| 考点 | 重要程度 | 项目对应代码 | 备注 |
|------|---------|------------|------|
| **创建型模式** | | | |
| 单例模式（Singleton） | ⭐⭐⭐⭐⭐ | `packages/shared/logger/src/index.ts` | 必考 |
| 工厂方法模式（Factory Method）| ⭐⭐⭐⭐ | `packages/shared/cache/src/index.ts` | 常考 |
| 抽象工厂（Abstract Factory）| ⭐⭐⭐ | — | 了解 |
| 建造者模式（Builder）| ⭐⭐⭐ | — | 了解 |
| 原型模式（Prototype）| ⭐⭐ | — | 了解 |
| **结构型模式** | | | |
| 装饰器模式（Decorator）| ⭐⭐⭐⭐⭐ | `packages/gateway/src/middleware/auth.ts` | 必考 |
| 代理模式（Proxy）| ⭐⭐⭐⭐ | `packages/gateway/src/index.ts` | 常考 |
| 适配器模式（Adapter）| ⭐⭐⭐⭐ | `packages/shared/logger/src/index.ts` | 常考 |
| 外观模式（Facade）| ⭐⭐⭐⭐ | `packages/gateway/src/index.ts` | 常考 |
| 组合模式（Composite）| ⭐⭐⭐ | — | 了解 |
| 享元模式（Flyweight）| ⭐⭐ | — | 了解 |
| 桥接模式（Bridge）| ⭐⭐⭐ | — | 了解 |
| **行为型模式** | | | |
| 策略模式（Strategy）| ⭐⭐⭐⭐⭐ | `packages/shared/cache/src/index.ts` | 必考 |
| 状态模式（State）| ⭐⭐⭐⭐⭐ | `packages/gateway/src/middleware/circuit-breaker.ts` | 必考 |
| 观察者模式（Observer）| ⭐⭐⭐⭐ | 日志系统 | 常考 |
| 责任链模式（Chain of Resp.）| ⭐⭐⭐⭐ | Gateway 中间件管道 | 常考 |
| 模板方法（Template Method）| ⭐⭐⭐ | — | 了解 |
| 命令模式（Command）| ⭐⭐⭐ | — | 了解 |
| 迭代器（Iterator）| ⭐⭐ | — | 了解 |
| 中介者（Mediator）| ⭐⭐⭐ | API Gateway | 常考 |
| 仓储模式（Repository）| ⭐⭐⭐⭐ | `packages/auth-service/src/repositories/` | 架构模式 |

---

## 📊 三、UML 建模

| 考点 | 重要程度 | 项目对应文件 | 备注 |
|------|---------|------------|------|
| 用例图：参与者/用例/关联 | ⭐⭐⭐⭐⭐ | `docs/uml/use-case.puml` | 每年必考 |
| 用例图：包含/扩展/泛化 | ⭐⭐⭐⭐⭐ | `docs/uml/use-case.puml` | 每年必考 |
| 类图：属性/方法 | ⭐⭐⭐⭐⭐ | `docs/uml/class-diagram.puml` | 每年必考 |
| 类图：继承/实现/关联 | ⭐⭐⭐⭐⭐ | `docs/uml/class-diagram.puml` | 每年必考 |
| 类图：聚合 vs 组合区别 | ⭐⭐⭐⭐ | `docs/uml/class-diagram.puml` | 常考区分 |
| 时序图：生命线/消息 | ⭐⭐⭐⭐⭐ | `docs/uml/sequence-api-request.puml` | 每年必考 |
| 时序图：alt/loop/opt | ⭐⭐⭐⭐ | `docs/uml/sequence-api-request.puml` | 常考 |
| 组件图 | ⭐⭐⭐⭐ | `docs/uml/component-diagram.puml` | 常考 |
| 部署图 | ⭐⭐⭐⭐ | `docs/uml/deployment.puml` | 常考 |
| 状态图 | ⭐⭐⭐⭐ | 熔断器状态（circuit-breaker.ts）| 常考 |
| 活动图 | ⭐⭐⭐ | — | 了解 |
| 协作图/通信图 | ⭐⭐⭐ | — | 了解 |

---

## 🌐 四、分布式系统

| 考点 | 重要程度 | 项目对应文件 | 备注 |
|------|---------|------------|------|
| CAP 理论 | ⭐⭐⭐⭐⭐ | `docs/adr/003-cache-strategy.md` | 必考 |
| BASE 理论 | ⭐⭐⭐⭐ | `docs/adr/003-cache-strategy.md` | 常考 |
| 缓存模式（Cache-Aside）| ⭐⭐⭐⭐⭐ | `packages/shared/cache/src/index.ts` | 必考 |
| 缓存穿透/击穿/雪崩 | ⭐⭐⭐⭐⭐ | `docs/adr/003-cache-strategy.md` | 必考 |
| 限流算法（令牌桶/漏桶）| ⭐⭐⭐⭐⭐ | `packages/gateway/src/middleware/rate-limiter.ts` | 必考 |
| 熔断器模式 | ⭐⭐⭐⭐⭐ | `packages/gateway/src/middleware/circuit-breaker.ts` | 必考 |
| 服务注册与发现 | ⭐⭐⭐⭐ | `packages/tool-registry/src/index.ts` | 常考 |
| 分布式事务（SAGA）| ⭐⭐⭐ | `docs/adr/001-*.md` 风险点 | 了解 |
| 一致性哈希 | ⭐⭐⭐ | — | 了解 |
| 消息队列（异步通信）| ⭐⭐⭐⭐ | `docs/architecture/process-view.md` | 常考 |
| API Gateway 模式 | ⭐⭐⭐⭐⭐ | `packages/gateway/src/index.ts` | 必考 |

---

## 🔐 五、安全架构

| 考点 | 重要程度 | 项目对应文件 | 备注 |
|------|---------|------------|------|
| 认证 vs 授权 | ⭐⭐⭐⭐⭐ | `docs/adr/004-auth-design.md` | 必考 |
| JWT 结构与验证 | ⭐⭐⭐⭐⭐ | `packages/gateway/src/middleware/auth.ts` | 必考 |
| RBAC 权限模型 | ⭐⭐⭐⭐⭐ | `docs/adr/004-auth-design.md` | 必考 |
| 密码安全（bcrypt）| ⭐⭐⭐⭐ | `packages/auth-service/src/services/` | 常考 |
| OWASP Top 10 | ⭐⭐⭐⭐ | `.github/workflows/security.yml` | 常考 |
| SQL 注入防护 | ⭐⭐⭐⭐ | Prisma ORM 参数化查询 | 常考 |
| XSS 防护 | ⭐⭐⭐⭐ | `.github/copilot-instructions.md` 规范 | 常考 |
| HTTPS/TLS | ⭐⭐⭐⭐ | `infrastructure/k8s/gateway-deployment.yml` | 常考 |
| 最小权限原则 | ⭐⭐⭐⭐ | Dockerfile 非 root 用户 | 常考 |

---

## ☁️ 六、云原生与容器化

| 考点 | 重要程度 | 项目对应文件 | 备注 |
|------|---------|------------|------|
| Docker 核心概念 | ⭐⭐⭐⭐⭐ | `infrastructure/docker/` | 必考 |
| Dockerfile 多阶段构建 | ⭐⭐⭐⭐ | `infrastructure/docker/Dockerfile.service` | 常考 |
| Docker Compose | ⭐⭐⭐⭐ | `infrastructure/docker/docker-compose.yml` | 常考 |
| K8s Pod/Deployment | ⭐⭐⭐⭐⭐ | `infrastructure/k8s/` | 必考 |
| K8s Service 类型 | ⭐⭐⭐⭐ | `infrastructure/k8s/gateway-deployment.yml` | 常考 |
| K8s ConfigMap/Secret | ⭐⭐⭐⭐ | `infrastructure/k8s/` | 常考 |
| K8s HPA（自动扩缩容）| ⭐⭐⭐⭐ | `docs/architecture/physical-view.md` | 常考 |
| 微服务 vs 单体 vs SOA | ⭐⭐⭐⭐⭐ | `docs/adr/001-microservice-architecture.md` | 必考 |
| Service Mesh（了解）| ⭐⭐⭐ | `docs/adr/002-api-gateway-pattern.md` | 了解 |

---

## 🛠️ 七、软件工程

| 考点 | 重要程度 | 项目对应文件 | 备注 |
|------|---------|------------|------|
| 软件开发模型（敏捷）| ⭐⭐⭐⭐ | `.github/ISSUE_TEMPLATE/` | 常考 |
| CI/CD 流水线 | ⭐⭐⭐⭐⭐ | `.github/workflows/ci.yml` | 必考 |
| 代码审查（Code Review）| ⭐⭐⭐⭐ | GitHub PR 流程 | 常考 |
| 测试策略（单元/集成/E2E）| ⭐⭐⭐⭐ | `packages/*/src/**/*.test.ts` | 常考 |
| 测试覆盖率 | ⭐⭐⭐⭐ | `.github/workflows/ci.yml` 覆盖率检查 | 常考 |
| 静态代码分析 | ⭐⭐⭐⭐ | `.github/workflows/security.yml` CodeQL | 常考 |
| 依赖管理 | ⭐⭐⭐ | `pnpm-workspace.yaml` | 了解 |
| 版本控制（Git Flow）| ⭐⭐⭐⭐ | `.github/workflows/ci.yml` 分支策略 | 常考 |
| Monorepo 架构 | ⭐⭐⭐ | `pnpm-workspace.yaml` | 了解 |
| 架构决策记录（ADR）| ⭐⭐⭐⭐ | `docs/adr/` | 常考 |

---

## 📝 八、论文写作核心素材

项目中可用于论文写作的核心场景：

| 论文题目方向 | 项目素材 |
|------------|---------|
| 微服务架构应用 | 整个项目架构 + `docs/adr/001-*` ATAM 分析 |
| API Gateway 设计 | `packages/gateway/` + `docs/adr/002-*` |
| 缓存架构设计 | `packages/shared/cache/` + `docs/adr/003-*` |
| 安全架构设计 | `packages/auth-service/` + `docs/adr/004-*` |
| 云原生部署 | `infrastructure/` + `docs/architecture/physical-view.md` |
| 设计模式应用 | Gateway 中间件 + Cache 策略 + Logger 单例 |

---

## 🎯 高频考点速记

```
必背内容（90%以上出题概率）：
1. 4+1视图：逻辑/开发/进程/物理/场景
2. CAP理论：CP系统 vs AP系统的选择依据
3. JWT：Header.Payload.Signature 结构
4. 熔断器：CLOSED→OPEN→HALF-OPEN 状态转换
5. 令牌桶 vs 漏桶：突发流量处理差异
6. 缓存三大问题：穿透(空值缓存)/击穿(互斥锁)/雪崩(TTL抖动)
7. UML关系：聚合(空心菱形) vs 组合(实心菱形)
8. ATAM：敏感点/权衡点/风险点/非风险点
9. RBAC：主体→角色→权限→资源 四元素
10. 微服务 vs SOA：服务粒度/部署方式/通信协议差异
```
