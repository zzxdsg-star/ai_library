# CLAUDE.md — AI 知识库管理平台

## 项目定位

一个人开发的 AI 知识库管理平台（课题项目），支持知识生产（手动录入 + 文档导入）、管理（CRUD + 检索 + 状态控制）、消费（基于知识库的 RAG 对话 Agent）。

## 关键文件

- 设计文档：[docs/superpowers/specs/2026-05-25-ai-knowledge-base-design.md](docs/superpowers/specs/2026-05-25-ai-knowledge-base-design.md) — 完整架构、数据库、API、RAG 管线定义
- 实现计划：[docs/superpowers/plans/2026-05-25-ai-knowledge-base-platform.md](docs/superpowers/plans/2026-05-25-ai-knowledge-base-platform.md) — 21 个 Task 的逐步实现步骤

## 技术栈

| 层 | 选择 |
|---|---|
| 前端 | React + Vite + Ant Design + RTK + TypeScript |
| 后端 | Express + tsx + TypeScript |
| ORM | Prisma |
| 数据库 | PostgreSQL + pgvector（主存储 + 向量 + 全文搜索） |
| 缓存 | Redis（热点数据、Session） |
| 消息队列 | RabbitMQ（文档入库异步分块+Embedding） |
| AI | 阿里云百炼（Embedding: text-embedding-v2, LLM: qwen-plus） |
| RAG 框架 | LangChain（ChatOpenAI + OpenAIEmbeddings + RecursiveCharacterTextSplitter） |

## 项目结构

```
ai-library/
├── client/          # React 前端 (Vite)
├── server/          # Express 后端
├── shared/          # 前后端共享 TypeScript 类型
├── docker-compose.yml  # 本地开发基础设施 (PG+Redis+RabbitMQ)
├── docs/            # 设计文档
└── README.md
```

## 基础设施

用户在自己的 Linux 虚拟机 Docker 上部署 PostgreSQL+pgvector、Redis、RabbitMQ。
本项目仅提供 `docker-compose.yml`，不负责安装和启动这些服务。
开发时假设这些服务已在 `localhost` 默认端口运行。

## 核心架构决策

1. **前后端分离**：同一 monorepo，npm workspaces 管理，不采用 Next.js 一体化方案
2. **RAG 混合检索**：向量相似度 (cosine, top_k=10) + BM25 全文搜索 (top_k=5) → RRF 融合 (k=60) → 取 top_k=5
3. **LangChain 标准封装**：Embedding、分块、LLM 调用使用 LangChain（ChatOpenAI + OpenAIEmbeddings + RecursiveCharacterTextSplitter），混合检索 + RRF 融合逻辑自研保留为技术亮点
4. **SSE 流式返回**：对话采用 `text/event-stream`，格式 `data: {"type":"chunk"|"done",...}\n\n`
5. **文档入库异步**：上传 → 创建 entry(PENDING) → RabbitMQ → Consumer 处理 → COMPLETED/FAILED，前端轮询状态
6. **文件去重**：上传文件计算 SHA256，相同 hash 不重复入库
7. **认证**：JWT，不做 RBAC/多工作空间/匿名访问，知识库操作校验资源归属
8. **知识内容**：Markdown 格式，手动录入用 TextArea（后续可换 rich editor）
9. **API 响应**：统一 `{ code: number, data: T, message: string }`，分页 `{ total, records, current, size }`
10. **错误处理**：`AppError(code, message, httpStatus)` + 全局 error middleware + 前端 axios interceptor

## 开发约定

- **每次修改前先读 spec**，确保不偏离设计
- **所有 RAG 参数必须在代码中注释选型理由**（spec 第 5 节）
- **不做过度设计**：不抽象的不要抽象，三个相似代码块不需要抽取 helper
- **不添加未在 spec 中定义的功能**（加分项需先讨论再规划）
- **命名**：数据库字段用 snake_case，TypeScript 用 camelCase，Prisma 用 `@map()` 映射
- **Git**：不执行 git 操作，用户自行管理版本控制
- **注释**：关键逻辑、RAG 参数选型、非显而易见的实现都需注释说明理由
- **文档**：每个模块/服务入口处写一段 JSDoc 说明职责，README 保持更新

# 识图能力

你的底层模型不具备原生识图能力。遇到图片时，**不要用 Read 工具**，改用 vision.js：

```
node vision.js "<图片路径>" "用中文描述这张图片"
```

## 触发场景

- 用户分享图片路径（本地或网络 URL）
- 消息中出现 "Saved attachments:" 并列出图片
- 用户要求分析、描述、识别图片内容

## 配置好之后

用户直接发图片，自动识图，无需手动打命令。

## 当前状态

- 设计阶段完成（2026-05-25），spec + plan 已定稿
- 全部 21 个 Task 已实现（2026-05-26），前端 + 后端代码均已就绪
- 已连接基础设施并启动验证，Demo 可运行
- **今日修复**：中文编码乱码、文件上传内存解析（不落盘）、分批 Embedding（百炼 25 条限制）、Markdown 渲染、状态自动刷新、失败反馈弹窗、UI 美化（暖金主题）
- 加分项待后续规划迭代
