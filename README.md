# architect-exam-lab

软考系统架构设计师（高级）备考实战仓库 — 以战代练，用微服务架构项目复现核心考点。

[![CI 持续集成](https://github.com/tangjianfang/architect-exam-lab/workflows/CI%20%E6%8C%81%E7%BB%AD%E9%9B%86%E6%88%90/badge.svg)](https://github.com/tangjianfang/architect-exam-lab/actions/workflows/ci.yml)
[![安全扫描](https://github.com/tangjianfang/architect-exam-lab/workflows/%E5%AE%89%E5%85%A8%E6%89%AB%E6%8F%8F/badge.svg)](https://github.com/tangjianfang/architect-exam-lab/actions/workflows/security.yml)
[![部署展示页](https://github.com/tangjianfang/architect-exam-lab/workflows/%E9%83%A8%E7%BD%B2%E5%B1%95%E7%A4%BA%E9%A1%B5/badge.svg)](https://github.com/tangjianfang/architect-exam-lab/actions/workflows/deploy.yml)

## 在线展示与部署

- 展示地址（部署后）：https://tangjianfang.github.io/architect-exam-lab/
- 部署方式：GitHub Actions 工作流 `.github/workflows/deploy.yml`
- 自动触发：`main` 分支变更 `site/**`、`README.md` 或 `deploy.yml`
- 手动触发：GitHub Actions 页面选择 **部署展示页** → **Run workflow**

## 使用说明

1. 打开 GitHub Actions 页面：  
   https://github.com/tangjianfang/architect-exam-lab/actions
2. 选择工作流 **部署展示页**。
3. 点击 **Run workflow** 执行部署。
4. 等待工作流成功后访问：
   https://tangjianfang.github.io/architect-exam-lab/

## 项目文档入口

- 架构总览：`/docs/architecture/overview.md`
- ADR 目录：`/docs/adr/`
- UML 图：`/docs/uml/`
