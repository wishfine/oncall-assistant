# On-Call Assistant

基于 SOP 文档的 On-Call 值班助手 Web 应用。提供关键词搜索、离线语义搜索、工具型 Agent 对话三类能力。

## 技术栈

- **语言**：TypeScript
- **运行时**：Node.js >= 18
- **框架**：Express
- **HTML 解析**：Cheerio
- **测试**：Vitest
- **前端**：原生 HTML/CSS/JS

## 快速开始

```bash
# 安装依赖
npm install

# 构建
npm run build

# 启动服务（默认端口 3000）
npm run dev

# 或使用 PORT 环境变量
PORT=8080 npm run dev
```

## 测试

```bash
# 单元测试（无需启动服务）
npm test

# 端到端验收测试（需先启动服务）
npm run dev    # 终端 1
npm run smoke  # 终端 2
```

## API 文档

### 通用

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查，返回 `{"ok": true}` |

### Phase 1 — 关键词搜索 (`/v1`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/v1` | 关键词搜索页面 |
| POST | `/v1/documents` | 上传/更新 SOP 文档 |
| GET | `/v1/search?q=<query>` | 关键词搜索 |

**POST /v1/documents**

```bash
curl -X POST http://localhost:3000/v1/documents \
  -H 'Content-Type: application/json' \
  -d '{"id": "sop-custom", "html": "<html><head><title>Custom SOP</title></head><body><p>Content here</p></body></html>"}'
```

响应：`201 { "id": "sop-custom", "title": "Custom SOP" }`

**GET /v1/search**

```bash
curl 'http://localhost:3000/v1/search?q=OOM'
curl 'http://localhost:3000/v1/search?q=故障'
curl 'http://localhost:3000/v1/search?q=replication'   # 应返回空
curl 'http://localhost:3000/v1/search?q=CDN'
curl 'http://localhost:3000/v1/search?q=%26'           # 搜索 &
```

响应格式：

```json
{
  "query": "OOM",
  "results": [
    {
      "id": "sop-001",
      "title": "后端服务 On-Call SOP",
      "snippet": "…值班工程师收到 OOM 告警后…",
      "score": 5
    }
  ]
}
```

### Phase 2 — 语义搜索 (`/v2`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/v2` | 语义搜索页面 |
| GET | `/v2/search?q=<query>` | 语义搜索 |

```bash
curl 'http://localhost:3000/v2/search?q=服务器挂了'
curl 'http://localhost:3000/v2/search?q=黑客攻击'
curl 'http://localhost:3000/v2/search?q=机器学习模型出问题'
```

语义搜索使用领域概念词典 + TF-IDF 余弦相似度实现，不依赖外部 API，完全离线可运行。查询词不需要精确出现在文档中即可找到相关 SOP。

### Phase 3 — On-Call Agent (`/v3`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/v3` | Agent 对话页面 |
| POST | `/v3/chat` | Agent 对话 |

```bash
curl -X POST http://localhost:3000/v3/chat \
  -H 'Content-Type: application/json' \
  -d '{"message": "数据库主从延迟超过30秒怎么处理？"}'

curl -X POST http://localhost:3000/v3/chat \
  -H 'Content-Type: application/json' \
  -d '{"message": "服务 OOM 了怎么办？"}'

curl -X POST http://localhost:3000/v3/chat \
  -H 'Content-Type: application/json' \
  -d '{"message": "P0 故障的响应流程是什么？"}'

curl -X POST http://localhost:3000/v3/chat \
  -H 'Content-Type: application/json' \
  -d '{"message": "怀疑有人入侵了系统"}'

curl -X POST http://localhost:3000/v3/chat \
  -H 'Content-Type: application/json' \
  -d '{"message": "推荐结果质量下降了"}'
```

响应格式：

```json
{
  "answer": "根据 sop-002.html，这是数据库主从复制/延迟问题。\n\n建议按以下步骤处理：\n1. ...",
  "toolCalls": [
    {
      "tool": "readFile",
      "args": { "fname": "sop-index.md" },
      "observation": "读取成功，1234 字符"
    },
    {
      "tool": "readFile",
      "args": { "fname": "sop-002.html" },
      "observation": "提取到 3 个相关章节：常见故障处理、场景一：主从复制中断、升级流程（文件长度 5000 字符）"
    }
  ],
  "sources": ["sop-002.html"]
}
```

## Agent 工具限制

Agent 只能使用一个工具：`readFile(fname: string) -> string`，限制如下：

- **只能读取 `data/` 目录下的文件**
- **参数只能是文件名**（basename），如 `sop-001.html`、`sop-index.md`
- **禁止**绝对路径（如 `/etc/passwd`）
- **禁止**路径穿越（如 `../README.md`）
- **禁止**通配符/glob（如 `*.html`）
- **禁止**读取目录
- **禁止**列目录

Agent 执行流程：
1. 读取 `sop-index.md` 定位相关 SOP
2. 根据问题意图选择对应 SOP 文件
3. 通过 `readFile` 读取 SOP 内容
4. 解析 SOP 章节，匹配最相关段落
5. 使用模板生成结构化回答（处理步骤 + 升级条件 + 禁止操作 + 来源引用）

## 实现说明

### Phase 1：关键词搜索

- 基于可见正文（排除 `<script>`、`<style>`、`<noscript>`、`<template>` 标签）
- 大小写不敏感匹配
- 中文字串匹配
- 标题命中加权
- 特殊处理 `q=&` 和 `q=%26` 查询 `&` 字符
- `replication` 查询返回空（该词仅出现在 `<script>` 标签中）

### Phase 2：语义搜索

- 9 个领域的离线概念词典（后端/SRE、安全、AI、DBA、前端、数据平台、移动、QA、网络/CDN）
- CJK unigram/bigram/trigram 分词 + TF-IDF 余弦相似度
- Query 扩展：原始 token x2、扩展词 x1、领域锚点 x1.5
- 标题精确命中 +0.1 bonus
- 无结果时回退 Phase 1 关键词搜索
- 不依赖外部 API

### Phase 3：Agent

- 11 种意图分类（database_replication、backend_oom、p0_escalation、security_intrusion 等）
- 按意图选择 SOP 文件，P0 类问题读取 5 个 SOP
- SOP 章节提取（h2/h3）+ 相关度评分
- 模板化回答生成：处理步骤、升级条件、禁止操作、来源引用
- `/v3` 页面展示完整工具调用链（工具名、参数、observation）

## 目录结构

```
oncall-assistant/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .gitignore
├── README_RUN.md
├── plan.md
├── data/
│   ├── sop-001.html … sop-010.html  # 10 份 SOP 文档
│   └── sop-index.md                  # Agent 定位索引
├── src/
│   ├── server.ts                     # 启动入口
│   ├── app.ts                        # Express 配置
│   ├── types.ts                      # 类型定义
│   ├── routes/
│   │   ├── v1.ts                     # /v1 路由
│   │   ├── v2.ts                     # /v2 路由
│   │   └── v3.ts                     # /v3 路由
│   └── services/
│       ├── htmlParser.ts             # HTML 解析
│       ├── documentRepository.ts     # 文档库
│       ├── keywordSearch.ts          # 关键词搜索
│       ├── semanticSearch.ts         # 语义搜索
│       ├── safeReadFile.ts           # 受限文件读取
│       └── agent.ts                  # Agent 逻辑
├── public/
│   ├── styles.css
│   ├── v1.js
│   ├── v2.js
│   └── v3.js
├── tests/
│   ├── health.test.ts
│   ├── htmlParser.test.ts
│   ├── v1.search.test.ts
│   ├── v2.semantic.test.ts
│   └── v3.agent.test.ts
├── scripts/
│   └── smoke.sh                      # curl 验收脚本
├── prompt/                           # AI 交互提示词截图
└── screenshot/                       # 效果截图
```
