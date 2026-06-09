# AI 知识库管理平台

基于 RAG（检索增强生成）技术的智能知识管理平台，支持知识的生产、管理、消费全流程。

视频演示链接：https://www.bilibili.com/video/BV1PPE76uESW/

## 技术栈

| 层 | 技术选型 |
|---|---|
| 前端 | React 18 + Vite + Ant Design 5 + Redux Toolkit + TypeScript |
| 后端 | Express + tsx + TypeScript |
| ORM | Prisma |
| 数据库 | PostgreSQL + pgvector（向量存储 + 全文搜索） |
| 缓存 | Redis（8 种 Key 全覆盖） |
| 消息队列 | RabbitMQ（文档异步分块 + Embedding） |
| AI 模型 | 阿里云百炼 — Embedding: text-embedding-v3, LLM: qwen-plus, Vision: qwen-vl-plus |
| RAG 框架 | LangChain（ChatOpenAI + OpenAIEmbeddings + RecursiveCharacterTextSplitter） |
| 对象存储 | 阿里云 OSS（多模态图片存储） |

## 功能

### 知识生产
- 手动录入 Markdown（分栏实时预览编辑器）
- 文档上传（PDF、Word、Markdown、TXT、CSV、Excel），内存解析不落盘
- 图片上传（PNG/JPG）→ OSS 存储 + AI 视觉识别生成描述
- CSV/Excel 自动解析为 Markdown table 入库
- 文件 SHA256 去重

### 知识管理
- 知识库 CRUD + 条目标题编辑（文件后缀锁死）
- 条目批量删除 + 预览弹窗 + 详情抽屉
- 条目状态控制（启用/禁用）+ 处理状态追踪
- 文本、Markdown、图片可预览；PDF/Word/CSV/Excel 暂不支持

### 知识消费 — RAG 对话 Agent
- 向量语义检索（cosine, top_k=10）+ BM25 关键词检索（top_k=5）
- RRF 融合排序 → top_k=5 最优结果
- qwen-plus 流式 SSE 生成，Markdown 渲染回答
- 多轮对话 + 知识库级自定义 system_prompt
- 对话命中热度统计 + 引用来源展示

### 自动知识提炼
- 手动提炼：全库或单会话，分会话并行调用 LLM 提取
- 定时提炼：每天凌晨 4:30 node-schedule 自动执行
- SHA256 + 标题双重去重，200 字过滤

### 热度统计
- 全局概览：知识库/条目/会话计数 + 热门条目 TOP 10 + 知识库活跃度分布
- 单库统计：该知识库下热门条目排行
- ECharts 可视化（柱状图 + 环形图），5 分钟自动刷新

### 用户系统
- JWT 注册/登录（用户名或邮箱均可登录）
- 数学图形验证码（SVG + Redis 5 分钟过期 + 一次性使用）
- 路由守卫 + 未登录红色提示

### 性能优化
- 前端：路由懒加载、React.memo/useMemo/useCallback、轮询条件控制
- 后端：PrismaClient 全局单例、DB 索引、多行 INSERT、SSE 断开保护

## 快速启动

### 环境要求

- Node.js >= 18
- Docker（用于启动 PG + Redis + RabbitMQ）
- 阿里云百炼 API Key
- 阿里云 OSS Bucket（图片存储）

### 1. 启动基础设施

```bash
docker compose up -d
```

### 2. 配置环境变量

编辑 `server/.env`：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_knowledge
JWT_SECRET=your-jwt-secret
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
BAILIAN_API_KEY=your-bailian-api-key
OSS_ACCESS_KEY_ID=your-oss-access-key-id
OSS_ACCESS_KEY_SECRET=your-oss-access-key-secret
OSS_BUCKET=my-ai-library
OSS_REGION=oss-cn-beijing
```

### 3. 安装依赖 & 初始化数据库

```bash
npm install
cd server
npx prisma migrate dev
npx prisma db execute --file prisma/vector_index.sql  # 创建 pgvector 索引
```

### 4. 启动

```bash
# 终端 1 — 后端 (localhost:3000)
cd server && npm run dev

# 终端 2 — 前端 (localhost:5173)
cd client && npm run dev
```

### 5. 访问

打开 http://localhost:5173，注册账号即可使用。

## 项目结构

```
ai-library/
├── client/                    # React 前端
│   └── src/
│       ├── api/               # API 请求 + axios 拦截器
│       ├── store/             # RTK 状态管理 (auth/knowledgeBase/entry/chat)
│       ├── pages/             # 路由页面
│       ├── components/        # UI 组件
│       │   ├── chat/          # 对话相关 (SessionList/ChatWindow/MessageBubble)
│       │   └── knowledge/     # 知识相关 (EntryEditor/FileUpload)
│       └── hooks/             # 自定义 Hooks (useSSE)
├── server/                    # Express 后端
│   └── src/
│       ├── routes/            # API 路由 (auth/knowledge/chat/analytics/debug)
│       ├── services/          # 业务逻辑层
│       ├── middleware/         # JWT 认证 / 错误处理 / CORS
│       ├── rag/               # RAG 管线 (chunker/embedder/retriever/generator)
│       ├── ingestion/         # 文档解析 (PDF/Word/MD/TXT/CSV/XLSX)
│       ├── queue/             # RabbitMQ (producer/consumer)
│       ├── cache/             # Redis 缓存
│       ├── ai/                # 百炼 SDK (Embedding/LLM/Vision)
│       ├── storage/           # OSS 客户端
│       ├── lib/               # 共享工具 (prisma 单例)
│       └── errors/            # 错误码 + AppError
├── shared/                    # 前后端共享 TypeScript 类型
├── docs/                      # 设计文档
├── docker-compose.yml         # PG + Redis + RabbitMQ
└── README.md
```

## 核心架构

```
┌─────────┐     HTTP/SSE     ┌──────────┐
│  React  │ ◄──────────────► │ Express  │
│ (Vite)  │                  │  (tsx)   │
└─────────┘                  └──┬───┬───┘
                                │   │
                   ┌────────────┘   └────────────┐
                   ▼                              ▼
            ┌─────────────┐              ┌──────────────┐
            │ PostgreSQL  │              │    Redis     │
            │  + pgvector │              │  (8 种 Key)  │
            └──────┬──────┘              └──────────────┘
                   │
            ┌──────┴──────┐      ┌──────────┐      ┌──────────┐
            │  RabbitMQ   │      │ 阿里云 OSS│      │ 阿里云百炼│
            │ (文档异步)   │      │ (图片存储) │      │ (AI 模型) │
            └─────────────┘      └──────────┘      └──────────┘
```

### RAG 对话流程

```
用户提问 → 混合检索（向量 + BM25 → RRF） → 拼接上下文 → qwen-plus 流式 SSE → 前端渲染
```

### 文档入库流程

```
上传 → 内存解析 → SHA256 去重 → 创建 Entry → RabbitMQ → Consumer 分块+Embedding → COMPLETED
```

## API 概览

| 模块 | 端点 | 说明 |
|---|---|---|
| 认证 | POST /api/auth/register | 注册（含验证码） |
| 认证 | POST /api/auth/login | 登录（用户名/邮箱 + 验证码） |
| 认证 | GET /api/auth/captcha | 获取数学验证码 SVG |
| 知识库 | CRUD /api/knowledge-bases | 知识库增删改查 |
| 条目 | CRUD /api/knowledge-bases/:id/entries | 条目增删改查 + 预览 |
| 文件 | POST /api/knowledge-bases/:id/entries/upload | 文档上传 |
| 图片 | POST /api/knowledge-bases/:id/entries/upload-images | 批量图片上传 |
| 对话 | CRUD /api/knowledge-bases/:id/chat/sessions | 会话管理 |
| 对话 | POST /api/knowledge-bases/:id/chat/sessions/:sid/messages | 发送消息（SSE） |
| 提炼 | POST /api/knowledge-bases/:id/chat/extract | 手动知识提炼 |
| 统计 | GET /api/analytics/overview | 全局热度统计 |
| 统计 | GET /api/analytics/kb/:id | 单库热度统计 |
| 调试 | GET /api/debug/clear-cache | 清除所有 Redis 缓存 |

### 统一响应格式

```json
{ "code": 0, "data": {}, "message": "ok" }
```

分页格式：

```json
{ "total": 100, "records": [...], "current": 1, "size": 10 }
```
