# 物理视图（Physical View）

> 考点关联：**4+1视图 - 物理视图**、**部署架构**、**容器化技术**、**Kubernetes**、**云原生**

物理视图（也称部署视图）描述软件组件到物理节点的映射关系，以及节点之间的网络连接。

---

## 1. 本地开发环境（Docker Compose）

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     开发者本地机器（localhost）                             │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                    Docker 网络：toollab-network                      │   │
│  │                                                                    │   │
│  │  ┌────────────────┐  ┌─────────────────┐  ┌───────────────────┐   │   │
│  │  │ gateway:3000   │  │auth-service:3001│  │ tool-registry:3002│   │   │
│  │  │                │  │                 │  │                   │   │   │
│  │  │ CPU: 0.5核     │  │ CPU: 0.5核      │  │ CPU: 0.5核        │   │   │
│  │  │ Memory: 256MB  │  │ Memory: 256MB   │  │ Memory: 256MB     │   │   │
│  │  └────────┬───────┘  └────────┬────────┘  └─────────┬─────────┘   │   │
│  │           │                   │                      │             │   │
│  │           └───────────────────┼──────────────────────┘             │   │
│  │                               │                                    │   │
│  │              ┌────────────────┼────────────────┐                   │   │
│  │              ▼                ▼                ▼                   │   │
│  │  ┌──────────────────┐  ┌──────────────────────────────────────┐   │   │
│  │  │ postgres:5432    │  │         redis:6379                   │   │   │
│  │  │ Volume: pgdata   │  │ Volume: redisdata（持久化）            │   │   │
│  │  └──────────────────┘  └──────────────────────────────────────┘   │   │
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  端口映射（宿主机 → 容器）：                                                 │
│  3000:3000（gateway）  3001:3001（auth）  5432:5432（postgres）             │
│  3002:3002（registry） 6379:6379（redis）                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 生产环境（Kubernetes）

> **考点：Kubernetes 核心概念** — Pod、Deployment、Service、Namespace、ConfigMap

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster（生产环境）                      │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │              Namespace: toollab-prod                           │   │
│  │                                                               │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │                  Ingress Controller                      │ │   │
│  │  │              (nginx / AWS ALB)                          │ │   │
│  │  └───────────────────────┬─────────────────────────────────┘ │   │
│  │                           │ 路由: /api/* → gateway-svc        │   │
│  │                           ▼                                   │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │              gateway Deployment（2 replicas）           │  │   │
│  │  │    ┌─────────────┐        ┌─────────────┐             │  │   │
│  │  │    │  Pod        │        │  Pod        │             │  │   │
│  │  │    │  gateway    │        │  gateway    │             │  │   │
│  │  │    │  :3000      │        │  :3000      │             │  │   │
│  │  │    └─────────────┘        └─────────────┘             │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  │                           │                                   │   │
│  │          ┌────────────────┼────────────────┐                  │   │
│  │          ▼                ▼                ▼                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │
│  │  │ auth-service │  │tool-registry │  │ (其他服务)    │        │   │
│  │  │ 2 replicas   │  │ 2 replicas   │  │              │        │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │              Namespace: toollab-infra（基础设施）                │   │
│  │  ┌──────────────────────┐  ┌──────────────────────────────┐  │   │
│  │  │ PostgreSQL           │  │ Redis Cluster                │  │   │
│  │  │ StatefulSet          │  │ StatefulSet                  │  │   │
│  │  │ PersistentVolume     │  │ PersistentVolume             │  │   │
│  │  └──────────────────────┘  └──────────────────────────────┘  │   │
│  └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Kubernetes 资源规格

| 服务 | CPU Request | CPU Limit | Memory Request | Memory Limit | Replicas |
|------|------------|-----------|---------------|--------------|---------|
| gateway | 100m | 500m | 128Mi | 256Mi | 2-5（HPA）|
| auth-service | 100m | 300m | 128Mi | 256Mi | 2-3（HPA）|
| tool-registry | 100m | 300m | 128Mi | 256Mi | 2（固定）|
| PostgreSQL | 500m | 2000m | 512Mi | 2Gi | 1（主）|
| Redis | 100m | 500m | 128Mi | 512Mi | 1（单实例）|

---

## 4. 网络策略

```
Ingress（外部流量）
    ↓ 443/HTTPS
Ingress Controller
    ↓ 80/HTTP（集群内）
gateway Service（ClusterIP）
    ↓ 3001/HTTP（仅内部）
auth-service Service（ClusterIP）[NetworkPolicy: 只允许 gateway 访问]
    ↓ 3002/HTTP（仅内部）
tool-registry Service（ClusterIP）[NetworkPolicy: 只允许 gateway 访问]

PostgreSQL Service（ClusterIP）[NetworkPolicy: 只允许 auth-service/registry 访问]
Redis Service（ClusterIP）[NetworkPolicy: 只允许所有服务访问]
```

---

## 5. 多阶段 Docker 构建

> **考点：Docker 多阶段构建** — 减小镜像体积、安全隔离构建环境

```dockerfile
# 阶段一：构建（包含开发依赖）
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build  # 编译 TypeScript → JavaScript

# 阶段二：生产镜像（只包含运行时依赖）
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
# 非 root 用户运行（安全最佳实践）
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**构建产物对比：**
| 镜像 | 大小 |
|------|------|
| 包含所有依赖（包括 devDependencies）| ~800MB |
| 多阶段构建生产镜像 | ~150MB |

---

## 6. 监控与可观测性

> **考点：运维监控** — 日志、指标、链路追踪（三大支柱）

| 可观测性支柱 | 工具 | 用途 |
|------------|------|------|
| 日志（Logs） | 结构化 JSON 日志 → ELK/Loki | 问题排查、审计 |
| 指标（Metrics） | Prometheus + Grafana | 性能监控、告警 |
| 链路追踪（Traces） | OpenTelemetry | 分布式请求追踪 |
| 健康检查 | Kubernetes Liveness/Readiness Probe | 自动故障恢复 |
