# AI 知识库管理平台

基于 RAG（检索增强生成）技术的 AI 知识管理平台，支持知识的生产、管理和智能消费。

## 技术栈

- **前端**: React + Vite + Ant Design + RTK + TypeScript
- **后端**: Express + Prisma + TypeScript
- **数据库**: PostgreSQL + pgvector（向量存储 + 全文搜索）
- **缓存**: Redis
- **消息队列**: RabbitMQ（文档异步处理）
- **RAG 框架**: LangChain（ChatOpenAI + OpenAIEmbeddings + RecursiveCharacterTextSplitter）
- **AI**: 阿里云百炼（通义千问）

## 快速启动

### 环境要求

- Node.js >= 18
- 阿里云百炼 API Key

### 1. 启动基础设施

```bash
# 在 Docker 宿主机上启动 PostgreSQL、Redis、RabbitMQ
docker compose up -d
```

### 2. 配置环境变量

编辑 `server/.env`：
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_knowledge
JWT_SECRET=your-jwt-secret
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
BAILIAN_API_KEY=your-bailian-api-key
```

### 3. 安装依赖

```bash
npm install
```

### 4. 初始化数据库

```bash
cd server
npx prisma migrate dev
```

### 5. 启动开发服务

```bash
# 终端 1: 后端 (localhost:3000)
cd server && npm run dev

# 终端 2: 前端 (localhost:5173)
cd client && npm run dev
```

### 6. 访问

打开 http://localhost:5173

## 架构

```
client (React:5173) → server (Express:3000) → PostgreSQL + pgvector
                                               Redis (cache)
                                               RabbitMQ (async docs)
                                               ↓
                                          阿里云百炼 API
```

### 核心模块

- **知识管理**: 知识库 CRUD、知识条目管理、文档上传与解析、状态管理
- **RAG 管线**: 智能分块 → 向量化 → 混合检索（BM25 + 向量 + RRF 融合） → LLM 生成
- **对话 Agent**: 基于知识库的 SSE 流式问答、多轮对话、引用来源展示
- **用户系统**: JWT 注册/登录、资源归属隔离

### 数据流

1. **知识入库**: 手动录入/文档上传 → 解析 → 分块 → Embedding → 入库
2. **对话问答**: 提问 → 混合检索 → RRF 融合 → 拼接上下文 → LLM 流式生成

## 项目结构

```
ai-library/
├── client/                # React 前端
│   └── src/
│       ├── api/           # API 请求层
│       ├── store/         # RTK 状态管理
│       ├── pages/         # 路由页面
│       └── components/    # UI 组件
├── server/                # Express 后端
│   └── src/
│       ├── routes/        # API 路由
│       ├── services/      # 业务逻辑
│       ├── middleware/     # 中间件
│       ├── rag/           # RAG 管线
│       ├── ingestion/     # 文档解析
│       ├── queue/         # RabbitMQ 队列
│       ├── cache/         # Redis 缓存
│       ├── ai/            # 百炼 SDK
│       └── errors/        # 错误处理
├── shared/                # 共享类型定义
├── docs/                  # 设计文档
├── docker-compose.yml     # 基础设施部署
└── README.md
```
