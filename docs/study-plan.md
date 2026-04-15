# 软考系统架构设计师备考 12 周学习计划

> 以「在线工具聚合平台」微服务项目为载体，通过实战复现考点，覆盖 2025 年最新考纲。

---

## 总体说明

| 项目 | 内容 |
|------|------|
| **备考目标** | 软考系统架构设计师（高级）|
| **考试时间** | 每年 5 月、11 月 |
| **学习周期** | 12 周（每周约 10-15 小时）|
| **学习方法** | 以战代练，边做项目边学理论 |
| **产出要求** | 代码 + 文档 + 论文素材 |

---

## 📅 第 1 周：项目初始化 & 架构基础

**主题：** 搭建项目骨架，理解架构风格

### 本周考点
- 软件架构定义（Kruchten 4+1 视图）
- 架构风格：管道过滤器、调用/返回、事件驱动、微服务
- 质量属性：性能、可用性、安全性、可修改性

### 实践任务
- [ ] Fork 本项目，完成本地环境搭建（Node.js 20、pnpm、Docker）
- [ ] 理解并运行 `docker-compose up` 启动所有服务
- [ ] 阅读 `docs/architecture/overview.md`，画出自己理解的 4+1 视图关系
- [ ] 编写第一个 ADR（参考 `docs/adr/template.md`），记录一个架构决策

### 产出要求
- [ ] 完成环境搭建，所有服务正常启动
- [ ] 产出一份 ADR 文档
- [ ] 理论笔记：4+1 视图模型的定义和各视图关注点

---

## 📅 第 2 周：API Gateway 与设计模式（I）

**主题：** 深入理解 API Gateway，学习结构型设计模式

### 本周考点
- API Gateway 模式（边缘服务、横切关注点）
- 设计模式：装饰器模式、代理模式、责任链模式
- 中间件模式

### 实践任务
- [ ] 阅读 `packages/gateway/src/index.ts`，理解中间件管道的责任链模式
- [ ] 阅读 `packages/gateway/src/middleware/auth.ts`，分析装饰器模式的应用
- [ ] 为 Gateway 添加请求日志中间件（使用 `packages/shared/logger`）
- [ ] 编写 Gateway 中间件的单元测试（Vitest）

### 产出要求
- [ ] Gateway 单元测试覆盖率 ≥ 80%
- [ ] 理论笔记：GoF 23 种设计模式分类（创建型 / 结构型 / 行为型）

---

## 📅 第 3 周：认证服务与安全架构

**主题：** 实现 JWT 认证，掌握安全架构设计

### 本周考点
- 安全架构：认证（Authentication）vs 授权（Authorization）
- JWT（JSON Web Token）原理与安全性
- RBAC 权限模型
- 密码安全（bcrypt、Argon2）

### 实践任务
- [ ] 阅读 `packages/auth-service/src/` 所有文件，理解分层架构
- [ ] 阅读 `docs/adr/004-auth-design.md`，掌握双 Token 策略
- [ ] 实现登录 API 的端到端流程（Controller → Service → Repository）
- [ ] 编写 AuthService 单元测试，Mock UserRepository

### 产出要求
- [ ] AuthService 单元测试通过，覆盖率 ≥ 80%
- [ ] 理论笔记：JWT 结构（Header.Payload.Signature）、RBAC 权限模型

---

## 📅 第 4 周：分层架构与仓储模式

**主题：** 深化分层架构理解，实现 Repository 模式

### 本周考点
- 分层架构（Layered Architecture）：表示层、业务层、数据访问层
- 仓储模式（Repository Pattern）
- ORM 设计原则（Prisma）
- 依赖倒置原则（DIP）

### 实践任务
- [ ] 运行 `pnpm architecture-check`，理解架构边界检查的实现
- [ ] 阅读 `packages/auth-service/src/repositories/user.repository.ts`
- [ ] 尝试在 Controller 中直接调用 Repository，观察 CI 报警
- [ ] 为 UserRepository 编写测试（使用内存数据库或 Mock）

### 产出要求
- [ ] 理解并能解释为何禁止 Controller 直接调用 Repository
- [ ] 理论笔记：SOLID 原则（SRP、OCP、LSP、ISP、DIP）

---

## 📅 第 5 周：缓存策略与分布式理论

**主题：** 实现 Cache-Aside 模式，掌握 CAP 理论

### 本周考点
- CAP 理论（Consistency / Availability / Partition tolerance）
- BASE 理论（Basically Available / Soft state / Eventually consistent）
- 缓存模式：Cache-Aside、Write-Through、Write-Behind
- 缓存穿透 / 缓存击穿 / 缓存雪崩

### 实践任务
- [ ] 阅读 `packages/shared/cache/src/index.ts`，理解策略模式
- [ ] 阅读 `docs/adr/003-cache-strategy.md`
- [ ] 在 Tool Registry 中加入缓存（Cache-Aside 模式）
- [ ] 编写缓存策略单元测试（分别测试 MemoryCache 和 RedisCacheStrategy）

### 产出要求
- [ ] 缓存模块单元测试通过
- [ ] 理论笔记：CAP 理论 + BASE 理论 + 三大缓存问题及解决方案

---

## 📅 第 6 周：限流与熔断（容错设计）

**主题：** 深入令牌桶算法和熔断器状态机

### 本周考点
- 限流算法：令牌桶（Token Bucket）、漏桶（Leaky Bucket）、固定窗口、滑动窗口
- 熔断器模式（Circuit Breaker）
- 弹性设计（Resilience）：重试、超时、降级
- 设计模式：状态模式（State Pattern）

### 实践任务
- [ ] 阅读 `packages/gateway/src/middleware/rate-limiter.ts`，理解令牌桶实现
- [ ] 阅读 `packages/gateway/src/middleware/circuit-breaker.ts`，追踪状态机转换
- [ ] 编写压测脚本，观察限流和熔断的触发过程
- [ ] 为 RateLimiter 编写单元测试，验证令牌补充逻辑

### 产出要求
- [ ] 能手画令牌桶算法流程图
- [ ] 理论笔记：四种限流算法对比 + 熔断器三种状态

---

## 📅 第 7 周：UML 建模（一）— 结构图

**主题：** 掌握 UML 结构图绘制（用例图、类图、组件图）

### 本周考点
- UML 用例图：参与者、用例、关联、包含、扩展、泛化
- UML 类图：属性、方法、继承、实现、关联、聚合、组合
- UML 组件图：组件、接口、连接器

### 实践任务
- [ ] 阅读 `docs/uml/use-case.puml`，安装 PlantUML 插件并预览图形
- [ ] 阅读 `docs/uml/class-diagram.puml`，对照代码理解模型
- [ ] 手绘（或使用 PlantUML）补充一个新的用例图（如工具管理子系统）
- [ ] 为新功能绘制类图，覆盖继承和聚合关系

### 产出要求
- [ ] 产出 2 个 PlantUML 图（用例图 + 类图）
- [ ] 理论笔记：UML 各关系类型对比（关联 vs 聚合 vs 组合 vs 依赖）

---

## 📅 第 8 周：UML 建模（二）— 行为图

**主题：** 掌握时序图、活动图、状态图的绘制

### 本周考点
- UML 时序图：参与者、生命线、消息、组合片段（alt/loop/opt）
- UML 活动图：活动、决策、并行
- UML 状态图：状态、转换、事件、动作

### 实践任务
- [ ] 阅读 `docs/uml/sequence-api-request.puml`，理解完整请求链路
- [ ] 绘制用户注册流程的时序图（从客户端到数据库）
- [ ] 绘制工具状态机的状态图（PENDING → ACTIVE → DEPRECATED → INACTIVE）
- [ ] 绘制熔断器的状态图（CLOSED → OPEN → HALF-OPEN）

### 产出要求
- [ ] 产出 3 个 UML 图（时序图 + 活动图 + 状态图）
- [ ] 理论笔记：时序图 vs 协作图 vs 通信图的区别

---

## 📅 第 9 周：云原生与容器化

**主题：** 掌握 Docker 和 Kubernetes 核心概念

### 本周考点
- Docker：镜像、容器、Dockerfile、多阶段构建、网络
- Kubernetes：Pod、Deployment、Service、ConfigMap、Secret、PVC
- 服务发现（Service Discovery）
- 健康检查（Liveness/Readiness Probe）

### 实践任务
- [ ] 阅读 `infrastructure/docker/Dockerfile.service`，理解多阶段构建
- [ ] 阅读 `infrastructure/docker/docker-compose.yml`，理解网络配置
- [ ] 阅读 `infrastructure/k8s/gateway-deployment.yml`，分析 K8s 配置
- [ ] 修改 docker-compose.yml，为 gateway 添加健康检查配置

### 产出要求
- [ ] 能解释 Docker 多阶段构建的优势
- [ ] 理论笔记：K8s 核心概念 + Deployment vs StatefulSet

---

## 📅 第 10 周：DevOps 与 CI/CD

**主题：** 深入 CI/CD 流水线，理解 DevOps 文化

### 本周考点
- DevOps：持续集成（CI）、持续交付（CD）、持续部署
- CI/CD 流水线设计（构建、测试、安全扫描、部署）
- 蓝绿部署（Blue-Green）、金丝雀发布（Canary）
- 配置管理与版本控制

### 实践任务
- [ ] 阅读 `.github/workflows/ci.yml`，理解流水线各阶段
- [ ] 阅读 `.github/workflows/security.yml`，理解 CodeQL 扫描
- [ ] 向 CI 流水线添加新的检查步骤（如依赖版本检查）
- [ ] 模拟一次 PR 流程，观察所有 CI 检查的执行

### 产出要求
- [ ] 能描述完整的 CI/CD 流水线各阶段
- [ ] 理论笔记：DevOps vs 传统开发模式 + 蓝绿部署 vs 金丝雀发布

---

## 📅 第 11 周：软件工程方法论 & 论文写作

**主题：** 理解主流开发方法论，练习论文写作

### 本周考点
- 软件开发模型：瀑布、迭代、敏捷（Scrum/XP）
- 软件质量保证：代码审查、静态分析、测试策略
- 架构评估方法：ATAM、CBAM
- 软考论文写作技巧

### 实践任务
- [ ] 基于本项目经历，起草一篇软考论文（1800-2400字）
  - 题目：《论微服务架构在在线工具平台中的应用》
  - 内容：背景介绍 → 架构决策 → 实施过程 → 质量属性分析 → 总结
- [ ] 整理项目中使用的设计模式清单（≥5种）
- [ ] 复习 `docs/adr/001-microservice-architecture.md` 中的 ATAM 分析

### 产出要求
- [ ] 完成论文初稿（800字以上）
- [ ] 理论笔记：ATAM 评估流程（9个步骤）

---

## 📅 第 12 周：冲刺复习 & 模拟题训练

**主题：** 综合复习，专项突破薄弱考点

### 本周考点
- 全面复习 `docs/exam-knowledge-map.md` 中的所有考点
- 重点：架构风格、设计模式、UML 图形、安全架构、云原生

### 实践任务
- [ ] 完整运行项目，确保所有测试通过（`pnpm test`）
- [ ] 完成 `docs/exam-knowledge-map.md` 中所有考点的自我测评
- [ ] 完成至少 2 套历年真题（上午选择题 75 题 + 下午案例题）
- [ ] 打磨论文，确保字数、格式符合要求
- [ ] 检查项目测试覆盖率，确保 ≥ 80%

### 产出要求
- [ ] 论文定稿（1800-2400字）
- [ ] 历年真题正确率：上午卷 ≥ 60%（45/75），下午卷 ≥ 60%

---

## 📊 每周时间分配建议

| 活动 | 时间占比 | 周均时长 |
|------|---------|---------|
| 读项目代码 & 文档 | 30% | 3-4小时 |
| 编写代码（实践任务）| 30% | 3-4小时 |
| 理论学习 & 笔记 | 25% | 2-3小时 |
| 真题练习 | 15% | 1-2小时 |

---

## 📚 推荐参考资料

| 类型 | 资源 |
|------|------|
| 官方教材 | 《系统架构设计师教程（第2版）》清华大学出版社 |
| 辅助教材 | 《软件架构实践（第3版）》Len Bass 等著 |
| 设计模式 | 《设计模式：可复用面向对象软件的基础》GoF |
| UML | 《UML精粹》Martin Fowler |
| 在线资源 | 历年真题（考试网、希赛网）|
| 项目文档 | 本项目 `docs/` 目录所有文档 |
