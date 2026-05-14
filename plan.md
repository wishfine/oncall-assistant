# Question 1: On-call 助手实现计划

## 1. 项目目标概述

本项目要在 `question-1/` 中实现一个基于 SOP HTML 文档的 On-call 助手 Web 应用。系统需要读取 `data/` 目录下的 SOP 文档，提供关键词搜索、离线语义搜索和工具型 Agent 对话三类能力。

题目按 Phase 1、Phase 2、Phase 3 分阶段评分，是因为三个阶段分别考察不同能力：

- Phase 1：基础后端 API、HTML 文档解析、可见正文索引、关键词检索。
- Phase 2：在关键词之外做自然语言语义匹配，考察检索设计和排序质量。
- Phase 3：实现受限工具调用的 Agent，对话回答必须能追溯到 SOP 文件内容。

最终交付物包括：

- 可运行的 HTTP API 服务。
- `/v1`、`/v2`、`/v3` 三个前端页面。
- 文档解析、关键词检索、语义检索、Agent 工具读取等后端能力。
- 自动测试和 smoke 验收脚本。
- 运行说明文档。
- `prompt/` 目录中的 AI 提示词截图。
- `screenshot/` 目录中的最终效果截图。
- 清晰的 Git 阶段提交历史。
- 打包整个 Git 仓库的 zip 文件，且不包含 `node_modules`。

前端需要完成：

- `/v1`：关键词搜索输入框和结果列表。
- `/v2`：语义搜索输入框和结果列表。
- `/v3`：对话界面，展示用户问题、Agent 回答和工具调用过程。

后端需要完成：

- 加载、解析、索引 SOP HTML。
- 实现 `/v1/documents`、`/v1/search`。
- 实现 `/v2/search`。
- 实现 `/v3/chat` 或等价 Agent API。
- 限制 Agent 只能通过 `readFile(fname)` 读取 `data/` 内文件。
- 提供可测试、可启动、可构建的工程结构。

## 2. 题目要求整理

### 2.1 Phase 1：关键词搜索

需要实现的 API：

- `POST /v1/documents`
- `GET /v1/search?q=...`
- `GET /v1`

`POST /v1/documents` 的职责：

- 接收请求体 `{ "id": "sop-001", "html": "<html>...</html>" }`。
- 解析 HTML 中的标题和正文。
- 移除 `script`、`style`、`noscript`、`template` 等非正文内容。
- 将文档加入内存文档库或更新已有文档。
- 返回 `201 { "id": "sop-001", "title": "后端服务 On-Call SOP" }`。

`GET /v1/search?q=...` 的职责：

- 使用关键词在文档可见正文中检索。
- 支持中文、英文和混合查询。
- 支持大小写不敏感匹配，例如 `oom` 和 `OOM` 应等价。
- 搜索结果按相关性排序。
- 返回结果中的 snippet 必须来自可见正文，不应来自脚本或样式。
- 需要特别兼容 `q=&` 和 `q=%26`，确保能搜索正文中的 `&` 字符。

`GET /v1` 页面的职责：

- 展示一个可操作的关键词搜索页面。
- 包含搜索输入框、提交按钮、结果列表。
- 结果至少展示 `id`、`title`、`snippet`、`score`。
- 页面不需要复杂框架，静态 HTML/CSS/JS 足够。

搜索结果格式：

```json
{
  "query": "...",
  "results": [
    {
      "id": "sop-001",
      "title": "后端服务 On-Call SOP",
      "snippet": "...",
      "score": 1.0
    }
  ]
}
```

必须通过的验收用例：

- `GET /v1/search?q=OOM` 返回 `sop-001`。
- `GET /v1/search?q=故障` 返回多个文档。
- `GET /v1/search?q=replication` 返回空，因为该词只出现在 `script` 标签内。
- `GET /v1/search?q=CDN` 返回 `sop-003` 和 `sop-010`。
- `GET /v1/search?q=&` 或 `GET /v1/search?q=%26` 返回正文中包含 `&` 的文档。

### 2.2 Phase 2：语义搜索

需要实现的 API：

- `GET /v2/search?q=...`
- `GET /v2`

`GET /v2/search?q=...` 的职责：

- 接收自然语言查询。
- 查询词不需要精确出现在文档中，也要能找到相关 SOP。
- 返回格式与 Phase 1 一致，即 `{ query, results }`。
- 结果按语义相关性排序。

`GET /v2` 页面的职责：

- 展示一个语义搜索页面。
- 包含搜索输入框、提交按钮、结果列表。
- 结果展示 `id`、`title`、`snippet`、`score`。
- 页面可以复用 `/v1` 的布局和样式。

为什么不能只做关键词匹配：

- 验收查询如“服务器挂了”“黑客攻击”“机器学习模型出问题”不一定以原词出现在 SOP 正文中。
- 如果只做 `text.includes(query)` 或简单分词匹配，会无法将“服务器挂了”映射到“后端服务超时、Kubernetes、基础设施故障”等语义。
- Phase 2 的评分点是“查询词不需要在文档中精确出现”和“结果按相关性排序”。

推荐的离线语义搜索方案：

- 默认不依赖外部 embedding API，保证评测环境离线也能跑通。
- 使用领域概念词典把自然语言意图扩展成 SOP 相关词，例如：
  - “服务器挂了” -> `服务`、`超时`、`不可用`、`Kubernetes`、`Pod`、`Ingress`、`基础设施`
  - “黑客攻击” -> `安全`、`入侵`、`DDoS`、`SQL注入`、`WAF`、`SIEM`
  - “机器学习模型出问题” -> `模型`、`推理`、`推荐`、`GPU`、`特征`、`AB实验`
- 对标题、正文、文件领域标签分别加权。
- 可结合 TF-IDF、字符 n-gram、关键词扩展命中数和章节标题命中数计算综合分。
- 语义规则应该通用化到“领域概念”和“同义词扩展”，不要只针对三条测试写硬编码答案。

必须通过的验收用例：

- `GET /v2/search?q=服务器挂了`：`sop-001` 和 `sop-004` 靠前。
- `GET /v2/search?q=黑客攻击`：`sop-005` 靠前。
- `GET /v2/search?q=机器学习模型出问题`：`sop-008` 靠前。

### 2.3 Phase 3：On-call Agent

`GET /v3` 页面的职责：

- 展示 On-call 助手对话界面。
- 包含消息输入框、发送按钮、对话历史。
- 展示 Agent 工具调用过程，包括工具名、参数、读取到的 observation 摘要。
- 展示最终回答，回答要基于 SOP 内容。

Agent API 建议设计：

- `POST /v3/chat`
- 请求体建议为：

```json
{
  "message": "数据库主从延迟超过30秒怎么处理？"
}
```

- 响应体建议为：

```json
{
  "answer": "...",
  "toolCalls": [
    {
      "tool": "readFile",
      "args": { "fname": "sop-index.md" },
      "observation": "..."
    },
    {
      "tool": "readFile",
      "args": { "fname": "sop-002.html" },
      "observation": "..."
    }
  ],
  "sources": ["sop-002.html"]
}
```

Agent 只能使用的工具：

- `readFile(fname: string) -> string`

`readFile(fname)` 的限制：

- 只能读取 `question-1/data/` 目录下的文件。
- 参数只能是文件名，例如 `sop-002.html`、`sop-index.md`。
- 禁止绝对路径。
- 禁止 `../` 路径穿越。
- 禁止读取目录。
- 禁止 glob，例如 `*.html`。
- 禁止列目录。
- 禁止读取项目其他文件，例如 `README.md`、`.env`、`package.json`。

为什么要展示工具调用过程：

- 题目明确要求“对话过程展示 Agent 的工具调用过程”。
- 这是 Phase 3 的核心评分点之一。
- 展示工具调用能证明回答确实来自 `readFile` 读取到的 SOP，而不是凭空生成。

必须支持的典型问题：

- “数据库主从延迟超过30秒怎么处理？” -> 读取 `sop-002.html`，给出 DBA 处理步骤。
- “服务 OOM 了怎么办？” -> 读取 `sop-001.html`，给出后端服务 OOM 排查和处理建议。
- “P0 故障的响应流程是什么？” -> 综合多个 SOP，至少包含后端、DBA、SRE、安全、网络等 P0/升级流程信息。
- “怀疑有人入侵了系统” -> 读取 `sop-005.html`，给出安全事件响应流程。
- “推荐结果质量下降了” -> 读取 `sop-008.html`，给出模型效果下降排查方向。

## 3. 当前仓库状态

当前 `question-1/` 目录中已有文件：

- `README.md`
- `data/sop-001.html`
- `data/sop-002.html`
- `data/sop-003.html`
- `data/sop-004.html`
- `data/sop-005.html`
- `data/sop-006.html`
- `data/sop-007.html`
- `data/sop-008.html`
- `data/sop-009.html`
- `data/sop-010.html`

`data/` 目录中的 SOP 文件领域：

- `sop-001.html`：后端服务，包含 OOM、服务超时、连接池耗尽、消息队列积压、配置回滚、P0 升级。
- `sop-002.html`：数据库 DBA，包含主从复制、主从延迟、慢查询、连接数暴涨、Redis 内存、数据恢复。
- `sop-003.html`：前端 Web，包含页面白屏、CDN 资源失败、JS 错误、性能劣化、CORS。
- `sop-004.html`：SRE 基础设施，包含 Kubernetes、Etcd、Ingress、CI/CD、云资源配额、P0 基础设施故障。
- `sop-005.html`：信息安全，包含 DDoS、SQL 注入、数据泄露、入侵行为、恶意软件、安全升级流程。
- `sop-006.html`：数据平台，包含 ETL 失败、Flink、HDFS、Kafka、数据质量、数据延迟。
- `sop-007.html`：移动客户端，包含 App 崩溃、网络请求异常、移动端 OOM、推送服务、商店审核。
- `sop-008.html`：AI 算法，包含模型推理延迟、推荐效果下降、GPU 资源、特征服务、AB 实验。
- `sop-009.html`：QA 质量保障，包含自动化测试、测试环境、性能测试、测试数据、线上 Bug 验证。
- `sop-010.html`：网络与 CDN，包含 CDN 节点、DNS、跨区域网络、负载均衡、DDoS 防护。

当前缺少：

- `package.json`
- `tsconfig.json`
- `.gitignore`
- Express server 入口。
- API 路由。
- HTML 解析模块。
- 文档库和搜索服务。
- 前端页面。
- 测试文件。
- smoke 验收脚本。
- 运行说明文档。
- `prompt/` 目录。
- `screenshot/` 目录。

隐藏坑点：

- `sop-002.html`、`sop-006.html`、`sop-008.html` 有 `script` 标签，脚本内容不能进入搜索索引。
- `sop-002.html`、`sop-009.html` 有 `style` 标签，样式内容不能进入搜索索引。
- `sop-003.html`、`sop-008.html`、`sop-010.html` 大量使用 HTML 实体，例如 `&amp;`、`&#38;`、`&period;`、`&colon;`。
- `sop-004.html` 存在不完整和未闭合的 HTML 标签，解析器必须容错。
- `sop-005.html` DOM 嵌套很深，不能依赖固定层级提取正文。
- `replication` 只出现在脚本变量名 `replicationLag` 中，Phase 1 必须返回空。
- `q=&` 按普通 query parser 可能被解析为空字符串，需要特殊处理。

## 4. 推荐技术栈

推荐技术栈：

- TypeScript
- Node.js
- Express
- Cheerio 或 htmlparser2
- Vitest
- Supertest
- 原生 HTML/CSS/JS

推荐理由：

- TypeScript 能给文档模型、搜索结果、Agent 工具调用结果提供清晰类型，降低后续阶段维护成本。
- Node.js + Express 足以覆盖本题所有 HTTP API，启动快、代码少、评测友好。
- Cheerio/htmlparser2 能容错解析坏 HTML，并方便移除 `script/style/noscript/template`。
- Vitest 启动快，适合单元测试 parser、search、agent。
- Supertest 适合直接测试 Express API，不需要真实监听端口。
- 原生 HTML/CSS/JS 能满足页面要求，避免引入 Vite/React 构建链。

为什么不建议一开始使用复杂前端框架：

- 题目对前端“不做要求”，重点是 API 和检索/Agent 能力。
- React/Vue/Vite 会增加依赖、构建配置和调试成本。
- 三个页面都是简单表单、结果列表和对话记录，原生静态页面足够。

为什么不建议默认依赖外部 embedding API：

- 评测环境可能没有 API Key 或网络访问。
- 外部 API 会增加失败点和成本。
- Phase 2 只要求语义搜索，不强制真实 embedding。
- 离线领域词典 + TF-IDF/n-gram 能稳定覆盖题目给出的验收用例。

为什么前端静态页面已经足够：

- `/v1`、`/v2` 只需要调用搜索 API 并渲染结果。
- `/v3` 只需要调用 chat API 并渲染对话和工具调用过程。
- 静态页面更容易截图、更少构建步骤，也更符合“不要过度设计”。

## 5. 总体目录结构设计

建议目录结构：

```text
question-1/
  package.json
  tsconfig.json
  .gitignore
  README_RUN.md
  src/
    server.ts
    app.ts
    routes/
      v1.ts
      v2.ts
      v3.ts
    services/
      htmlParser.ts
      documentRepository.ts
      keywordSearch.ts
      semanticSearch.ts
      agent.ts
      safeReadFile.ts
      snippet.ts
    types.ts
  public/
    styles.css
    v1.js
    v2.js
    v3.js
  data/
    sop-001.html
    sop-002.html
    sop-003.html
    sop-004.html
    sop-005.html
    sop-006.html
    sop-007.html
    sop-008.html
    sop-009.html
    sop-010.html
    sop-index.md
  tests/
    htmlParser.test.ts
    v1.search.test.ts
    v2.semantic.test.ts
    v3.agent.test.ts
  scripts/
    smoke.sh
  prompt/
  screenshot/
```

关键文件作用：

- `package.json`：声明依赖、开发脚本、构建脚本、测试脚本。
- `tsconfig.json`：配置 TypeScript 编译目标和输出目录。
- `.gitignore`：排除 `node_modules`、`dist`、`.DS_Store`、日志等生成物。
- `README_RUN.md`：最终运行说明、测试说明、阶段能力说明。
- `src/server.ts`：读取端口并启动 Express 服务。
- `src/app.ts`：创建 Express app，注册中间件、静态资源和路由。
- `src/routes/v1.ts`：实现 `/v1` 页面、`/v1/documents`、`/v1/search`。
- `src/routes/v2.ts`：实现 `/v2` 页面、`/v2/search`。
- `src/routes/v3.ts`：实现 `/v3` 页面、`/v3/chat`。
- `src/services/htmlParser.ts`：解析 HTML，移除非正文节点，提取 title/text。
- `src/services/documentRepository.ts`：启动时加载 `data/*.html`，维护内存文档库。
- `src/services/keywordSearch.ts`：Phase 1 关键词检索和排序。
- `src/services/semanticSearch.ts`：Phase 2 离线语义检索和排序。
- `src/services/agent.ts`：Phase 3 Agent 文件选择、工具调用编排和回答生成。
- `src/services/safeReadFile.ts`：受限 `readFile(fname)` 工具实现。
- `src/services/snippet.ts`：从正文中生成高亮或普通摘要片段。
- `src/types.ts`：定义 `DocumentRecord`、`SearchResult`、`ToolCall` 等类型。
- `public/styles.css`：三阶段页面共用样式。
- `public/v1.js`：`/v1` 页面交互逻辑。
- `public/v2.js`：`/v2` 页面交互逻辑。
- `public/v3.js`：`/v3` 页面交互逻辑和工具调用展示。
- `data/sop-index.md`：Agent 可读取的 SOP 文件索引，由 Stage 5 添加。
- `tests/`：自动测试，覆盖 README 明确验收用例。
- `scripts/smoke.sh`：启动服务后的 curl 验收脚本。
- `prompt/`：存放 AI 交互提示词截图。
- `screenshot/`：存放最终效果截图。

## 6. 分阶段实施计划

### Stage 0：项目理解与方案确认

阶段目标：

- 只读分析仓库。
- 明确题目要求、评分点、验收用例和风险点。
- 不写代码，不修改文件。

要新增或修改的文件：

- 无。

具体实现任务：

- 阅读根目录 `README.md`。
- 阅读 `question-1/README.md`。
- 阅读 `question-1/data/` 下所有 SOP HTML。
- 检查是否已有 package、server、前端、测试。
- 梳理 Phase 1、Phase 2、Phase 3 的评分点。

关键实现细节：

- 注意 SOP 文件中存在脚本、样式、HTML 实体和坏 HTML。
- 注意提交要求包括 `prompt/`、`screenshot/`、Git 历史和个人简历。

验收方式：

- 输出中文分析和实施计划。
- 确认没有文件被修改。

建议测试命令：

```bash
git status --short
find . -maxdepth 2 -type f | sort
```

建议 Git commit message：

- 不提交。

该阶段完成后给后续 AI 的注意事项：

- 不要直接开始写大段代码。
- 先确认实现方案和阶段边界。
- 后续每个阶段都应该单独验收、单独提交。

### Stage 1：初始化项目结构

阶段目标：

- 初始化 TypeScript + Express 项目。
- 配置基础脚本。
- 实现 `/health`。
- 保证项目能启动、能 build。

要新增或修改的文件：

- `package.json`
- `tsconfig.json`
- `.gitignore`
- `src/server.ts`
- `src/app.ts`
- `src/routes/` 目录
- `src/services/` 目录
- `src/types.ts`
- `public/` 目录
- `tests/` 目录

具体实现任务：

- 初始化 npm 项目。
- 安装运行依赖：`express`、`cheerio`。
- 安装开发依赖：`typescript`、`tsx`、`vitest`、`supertest`、`@types/node`、`@types/express`、`@types/supertest`。
- 配置脚本：
  - `npm run dev`
  - `npm run build`
  - `npm start`
  - `npm test`
- 在 `src/app.ts` 创建 Express app。
- 注册 JSON body parser。
- 注册静态资源目录 `public/`。
- 添加 `GET /health` 返回 `{ ok: true }`。
- 在 `src/server.ts` 监听端口，默认 `3000`。

关键实现细节：

- `app.ts` 导出 app，方便 Supertest 测试。
- `server.ts` 只负责启动监听，避免测试时自动占端口。
- `.gitignore` 必须排除 `node_modules/`、`dist/`、`.DS_Store`、日志文件。

验收方式：

- `npm install` 成功。
- `npm run build` 成功。
- `npm run dev` 启动后，`GET /health` 返回 `{ ok: true }`。

建议测试命令：

```bash
npm install
npm run build
npm test
npm run dev
curl http://localhost:3000/health
```

建议 Git commit message：

```text
chore(question-1): initialize express typescript app
```

该阶段完成后给后续 AI 的注意事项：

- 不要在 Stage 1 中实现搜索逻辑。
- 只建立可运行骨架。
- 确保 `app.ts` 与 `server.ts` 分离，方便后续测试。

### Stage 2：HTML 解析与文档库

阶段目标：

- 读取 `data/` 目录下所有 SOP HTML。
- 解析 `id`、`filename`、`title`、`text`、`html`。
- 移除非正文内容。
- 解码 HTML 实体。
- 兼容坏 HTML。
- 建立内存文档库。

要新增或修改的文件：

- `src/services/htmlParser.ts`
- `src/services/documentRepository.ts`
- `src/types.ts`
- `tests/htmlParser.test.ts`
- 可按需要补充 `src/services/snippet.ts` 的空骨架或留到 Stage 3。

具体实现任务：

- 实现 `parseHtmlDocument(id, filename, html)`。
- 使用 Cheerio/htmlparser2 加载 HTML。
- 删除 `script`、`style`、`noscript`、`template`。
- 从 `<title>` 或 `<h1>` 提取标题，优先使用 `<title>`，缺失时回退 `<h1>`，再缺失回退 id。
- 从 `body` 或整个文档提取可见文本。
- 归一化空白字符。
- 确保 HTML 实体被解码，例如 `&amp;` -> `&`。
- 实现 `DocumentRepository`：
  - 启动时加载 `data/*.html`。
  - 支持 `listDocuments()`。
  - 支持 `getDocument(id)`。
  - 支持 `upsertDocument({ id, html })`。

关键实现细节：

- 不要用正则手写 HTML parser。
- 不要依赖固定 DOM 层级，`sop-005.html` 嵌套很深。
- `sop-004.html` 标签不完整，必须让解析器容错。
- `replicationLag` 在 `sop-002.html` 的 script 中，解析后正文不能包含 `replication`。
- `sop-010.html` 中的 `网络&amp;CDN` 应被解析为 `网络&CDN`。

验收方式：

- 文档库能加载 10 个 SOP。
- 每个文档都有 id、filename、title、text、html。
- 解析后的 `sop-002` text 不包含 `replicationLag`。
- 解析后的 `sop-010` text 包含 `网络&CDN`。
- 解析 `sop-004` 不报错。

建议测试命令：

```bash
npm test -- htmlParser
npm run build
```

建议 Git commit message：

```text
feat(question-1): parse sop html into document index
```

该阶段完成后给后续 AI 的注意事项：

- 后续所有搜索都必须基于 `DocumentRecord.text`，不要直接搜 raw html。
- 文档库应该是后续 v1/v2/agent 的唯一数据入口。

### Stage 3：Phase 1 关键词搜索

阶段目标：

- 实现 `POST /v1/documents`。
- 实现 `GET /v1/search?q=...`。
- 实现 `GET /v1` 页面。
- 搜索只基于可见正文。
- 通过 README 中 Phase 1 验收用例。

要新增或修改的文件：

- `src/routes/v1.ts`
- `src/services/keywordSearch.ts`
- `src/services/snippet.ts`
- `src/app.ts`
- `public/v1.js`
- `public/styles.css`
- `tests/v1.search.test.ts`

具体实现任务：

- 在 `app.ts` 注册 v1 路由。
- `GET /v1` 返回静态搜索页面或 HTML 模板。
- `POST /v1/documents` 调用 document repository upsert。
- `GET /v1/search?q=...` 调用关键词搜索。
- 实现关键词匹配：
  - 英文大小写不敏感。
  - 中文按原文子串匹配。
  - 支持中英文混合。
  - 支持 `&` 字符检索。
- 实现 scoring：
  - 标题命中加权。
  - 正文命中次数加权。
  - 文件 id 或领域词可轻微加权，但不要污染可见文本搜索。
- 实现 snippet：
  - 优先围绕首次命中位置截取。
  - 没有明确位置时取正文开头。
  - snippet 必须来自可见正文。
- 特别处理 `q=&` 和 `q=%26`：
  - `q=%26` 正常解析为 `&`。
  - 对原始 URL 为 `/v1/search?q=&` 的情况，可按题目要求特殊解释为查询 `&`。
  - 普通空查询可以返回空结果或 400，但不能影响 `q=&` 用例。

关键实现细节：

- 不要搜索 raw HTML，否则 `replication` 会误命中。
- 不要把 style 中的 CSS 类名当正文。
- `CDN` 应能同时命中 `sop-003` 和 `sop-010`。
- `故障` 应返回多个 SOP。

验收方式：

- `/v1` 页面可打开和搜索。
- `GET /v1/search?q=OOM` 返回 `sop-001`。
- `GET /v1/search?q=故障` 返回多个文档。
- `GET /v1/search?q=replication` 返回空数组。
- `GET /v1/search?q=CDN` 返回 `sop-003` 和 `sop-010`。
- `GET /v1/search?q=%26` 能搜索正文中的 `&`。

建议测试命令：

```bash
npm test -- v1
npm run build
npm run dev
curl 'http://localhost:3000/v1/search?q=OOM'
curl 'http://localhost:3000/v1/search?q=故障'
curl 'http://localhost:3000/v1/search?q=replication'
curl 'http://localhost:3000/v1/search?q=CDN'
curl 'http://localhost:3000/v1/search?q=%26'
```

建议 Git commit message：

```text
feat(question-1): add phase 1 keyword search
```

该阶段完成后给后续 AI 的注意事项：

- v1 搜索应保持简单可靠，不要为了 v2 改坏 v1。
- Phase 2 可以复用文档库和 snippet，但不要改变 v1 API 输出格式。

### Stage 4：Phase 2 语义搜索

阶段目标：

- 实现 `GET /v2/search?q=...`。
- 实现 `GET /v2` 页面。
- 默认不依赖外部 API。
- 使用离线语义方法让指定语义查询排序正确。

要新增或修改的文件：

- `src/routes/v2.ts`
- `src/services/semanticSearch.ts`
- `src/app.ts`
- `public/v2.js`
- `public/styles.css`
- `tests/v2.semantic.test.ts`

具体实现任务：

- 在 `app.ts` 注册 v2 路由。
- `GET /v2` 返回语义搜索页面。
- `GET /v2/search?q=...` 调用 semantic search。
- 建立领域概念词典：
  - 后端服务：`服务器`、`服务`、`挂了`、`超时`、`不可用`、`OOM`、`Kubernetes`、`Pod`、`下游`
  - SRE：`基础设施`、`K8s`、`Kubernetes`、`Etcd`、`Ingress`、`节点`、`NotReady`、`集群`
  - 安全：`黑客`、`攻击`、`入侵`、`恶意`、`DDoS`、`SQL注入`、`WAF`、`SIEM`
  - AI：`机器学习`、`模型`、`推荐`、`搜索排序`、`推理`、`GPU`、`特征`、`AB实验`
  - DBA、前端、数据平台、移动、QA、网络等也应有基本领域词。
- 将 query 扩展为概念词集合。
- 对文档计算综合分：
  - query 原词命中。
  - 扩展词命中。
  - 标题命中。
  - 领域标签命中。
  - TF-IDF 或字符 n-gram 相似度。
- 返回排序后的结果。

关键实现细节：

- 不要把三条验收查询写成 `if query === ... return sop-x`。
- 语义词典可以是可解释、可维护的离线方案。
- `服务器挂了` 应同时把 `sop-001` 和 `sop-004` 排前，因为一个是后端服务，一个是基础设施/SRE。
- `黑客攻击` 应把 `sop-005` 明显排第一。
- `机器学习模型出问题` 应把 `sop-008` 明显排第一。

验收方式：

- `/v2` 页面可打开和搜索。
- `/v2/search?q=服务器挂了` 的前几名包含 `sop-001` 和 `sop-004`。
- `/v2/search?q=黑客攻击` 的第一名或靠前结果是 `sop-005`。
- `/v2/search?q=机器学习模型出问题` 的第一名或靠前结果是 `sop-008`。
- v1 测试仍然通过。

建议测试命令：

```bash
npm test -- v2
npm test
npm run build
npm run dev
curl 'http://localhost:3000/v2/search?q=服务器挂了'
curl 'http://localhost:3000/v2/search?q=黑客攻击'
curl 'http://localhost:3000/v2/search?q=机器学习模型出问题'
```

建议 Git commit message：

```text
feat(question-1): add offline semantic search
```

该阶段完成后给后续 AI 的注意事项：

- 保持离线可运行。
- 如果后续要接 embedding API，也必须保留离线 fallback。
- 不要为了提升某个查询破坏通用排序逻辑。

### Stage 5：Phase 3 On-call Agent

阶段目标：

- 实现 `GET /v3` 页面。
- 实现 `POST /v3/chat`。
- Agent 只能通过 `readFile(fname)` 读取 `data/` 目录下文件。
- 防止路径穿越和越权读取。
- Agent 先读 `sop-index.md`，再选择 SOP 文件。
- 回答必须基于读取到的 SOP 内容。
- 前端展示工具调用过程。

要新增或修改的文件：

- `src/routes/v3.ts`
- `src/services/agent.ts`
- `src/services/safeReadFile.ts`
- `src/app.ts`
- `public/v3.js`
- `public/styles.css`
- `data/sop-index.md`
- `tests/v3.agent.test.ts`

具体实现任务：

- 新增 `data/sop-index.md`，内容是 SOP 文件和主题索引：
  - 文件名。
  - 部门/领域。
  - 关键问题。
  - 典型关键词。
- 实现 `safeReadFile(fname)`：
  - 只接受 basename。
  - 拒绝空字符串。
  - 拒绝包含 `/`、`\`、`..`、`*`、`?` 的输入。
  - 使用 `path.resolve(dataDir, fname)` 后检查结果仍在 `dataDir` 内。
  - 拒绝目录。
  - 只返回文件内容字符串。
- 实现 Agent 流程：
  - 第一步调用 `readFile("sop-index.md")`。
  - 根据用户问题从索引中选择一个或多个 SOP 文件。
  - 调用 `readFile("sop-xxx.html")`。
  - 解析读取内容，提取相关段落。
  - 生成回答，列出处理步骤、升级条件、禁止操作或注意事项。
  - 返回 `answer`、`toolCalls`、`sources`。
- `POST /v3/chat` 接收 `{ message }`，返回 Agent 响应。
- `GET /v3` 返回对话页面。

关键实现细节：

- Agent 可以使用已有 parser 解析 `readFile` 返回的 HTML，但读取动作必须通过 `readFile`。
- 不允许 Agent 直接访问 `DocumentRepository` 来绕过工具读取。
- P0 问题应读取多个 SOP，至少覆盖有 P0/升级流程的相关文档。
- observation 不要把整个 HTML 全量塞给前端，可以返回摘要、长度、标题和前若干字符。
- 最终 answer 要引用来源文件名。

验收方式：

- `/v3` 页面可打开。
- 问“数据库主从延迟超过30秒怎么处理？”会显示读取 `sop-index.md` 和 `sop-002.html`，回答包含主从延迟/复制排查步骤。
- 问“服务 OOM 了怎么办？”会读取 `sop-001.html`，回答包含堆转储、JVM、扩容、回滚等。
- 问“P0 故障的响应流程是什么？”会读取多个 SOP，回答包含 P0 升级时限和升级路径。
- 问“怀疑有人入侵了系统”会读取 `sop-005.html`，回答包含安全事件响应。
- 问“推荐结果质量下降了”会读取 `sop-008.html`，回答包含模型效果下降排查。
- 传入非法文件名的工具测试会被拒绝。

建议测试命令：

```bash
npm test -- v3
npm test
npm run build
npm run dev
curl -X POST http://localhost:3000/v3/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"数据库主从延迟超过30秒怎么处理？"}'
```

建议 Git commit message：

```text
feat(question-1): add tool-based on-call agent
```

该阶段完成后给后续 AI 的注意事项：

- 不要让 Agent 直接列目录。
- 不要让 Agent 读取 `README.md`、`.env` 或任意路径。
- 不要隐藏工具调用过程。
- 不要生成脱离 SOP 的泛泛回答。

### Stage 6：前端页面优化

阶段目标：

- `/v1`、`/v2`、`/v3` 页面统一风格。
- 页面适合最终截图。
- 结果展示清晰。
- Agent 工具调用过程可读。

要新增或修改的文件：

- `public/styles.css`
- `public/v1.js`
- `public/v2.js`
- `public/v3.js`
- `src/routes/v1.ts`
- `src/routes/v2.ts`
- `src/routes/v3.ts`

具体实现任务：

- 统一页面布局：
  - 顶部标题。
  - 阶段说明短文案。
  - 输入区域。
  - 结果区域。
- `/v1` 和 `/v2` 搜索结果展示：
  - `id`
  - `title`
  - `snippet`
  - `score`
- `/v3` Agent 页面展示：
  - 用户问题。
  - Agent 回答。
  - 工具调用列表。
  - 工具参数。
  - observation 摘要。
  - sources。
- 增加错误态和 loading 态。
- 控制页面宽度和间距，保证截图清晰。

关键实现细节：

- 不需要大型设计系统。
- 不要把 UI 做成营销页。
- 重点是评审者能一眼看到 API 能力和 Agent 工具 trace。
- 移动端不必复杂，但基本响应式要可用。

验收方式：

- 浏览器访问 `/v1`、`/v2`、`/v3` 都能正常操作。
- 页面无明显文字重叠。
- 搜索结果和 Agent trace 在截图中清晰可见。
- API 测试仍然通过。

建议测试命令：

```bash
npm test
npm run build
npm run dev
```

手工打开：

```text
http://localhost:3000/v1
http://localhost:3000/v2
http://localhost:3000/v3
```

建议 Git commit message：

```text
style(question-1): polish phase pages
```

该阶段完成后给后续 AI 的注意事项：

- 页面优化不要改坏 API 格式。
- 截图前应准备好固定的典型查询。

### Stage 7：测试与验收脚本

阶段目标：

- 添加 parser 测试。
- 添加 v1 搜索测试。
- 添加 v2 语义搜索测试。
- 添加 Agent 工具调用测试。
- 添加 smoke 验收脚本。
- 覆盖 README 中明确给出的验收用例。

要新增或修改的文件：

- `tests/htmlParser.test.ts`
- `tests/v1.search.test.ts`
- `tests/v2.semantic.test.ts`
- `tests/v3.agent.test.ts`
- `scripts/smoke.sh`
- `package.json`

具体实现任务：

- Parser 测试：
  - 加载 10 个 SOP。
  - `script/style` 不进入 text。
  - HTML 实体解码。
  - 坏 HTML 可解析。
- v1 测试：
  - `OOM` -> `sop-001`
  - `故障` -> 多个文档
  - `replication` -> 空
  - `CDN` -> `sop-003`、`sop-010`
  - `%26` -> 包含 `&` 的文档
- v2 测试：
  - `服务器挂了` -> `sop-001`、`sop-004` 靠前
  - `黑客攻击` -> `sop-005` 靠前
  - `机器学习模型出问题` -> `sop-008` 靠前
- Agent 测试：
  - 典型问题会调用正确文件。
  - toolCalls 包含 `readFile`。
  - 非法文件名被拒绝。
  - P0 问题读取多个 SOP。
- smoke 脚本：
  - 假设服务已在 `localhost:3000` 启动。
  - 使用 curl 执行 README 验收用例。
  - 输出 PASS/FAIL。

关键实现细节：

- Supertest 测 API，不需要真实端口。
- `smoke.sh` 用于最终手工验收，需要可读输出。
- 测试不要依赖结果数组完整顺序，除非题目要求“靠前”。
- 对 Phase 2 可断言 top 1 或 top 3，避免过度脆弱。

验收方式：

- `npm test` 全部通过。
- `npm run build` 通过。
- 启动服务后 `scripts/smoke.sh` 通过。

建议测试命令：

```bash
npm test
npm run build
npm run dev
bash scripts/smoke.sh
```

建议 Git commit message：

```text
test(question-1): add api and smoke tests
```

该阶段完成后给后续 AI 的注意事项：

- 后续改动必须先跑测试。
- 如果某个测试失败，优先最小修复，不要重写架构。

### Stage 8：README、prompt、screenshot 与最终提交

阶段目标：

- 添加运行说明。
- 说明安装、启动、测试方式。
- 说明每个阶段实现内容。
- 说明 Agent 工具限制。
- 准备 `prompt/` 和 `screenshot/`。
- 检查 `node_modules` 不进入提交或压缩包。
- 检查 Git 历史清晰。

要新增或修改的文件：

- `README_RUN.md`
- `prompt/`
- `screenshot/`
- 可按需更新 `README.md`，但不要覆盖题目原始要求；更推荐新增 `README_RUN.md`。

具体实现任务：

- `README_RUN.md` 包含：
  - 技术栈。
  - 安装命令。
  - 启动命令。
  - 测试命令。
  - API 列表。
  - Phase 1/2/3 实现说明。
  - Agent 工具限制说明。
  - 典型 curl 示例。
- 截图：
  - `/v1` 搜索 `CDN` 或 `OOM`。
  - `/v2` 搜索 `服务器挂了` 或 `黑客攻击`。
  - `/v3` 对话并展示工具调用过程。
- `prompt/` 放入开发过程中与 AI 交互的所有提示词截图。
- 最终检查 Git 状态和 Git log。

关键实现细节：

- `node_modules` 不提交，不打包。
- `dist` 通常不提交，除非 README 明确需要。
- `.DS_Store` 不提交。
- 根目录需要放个人简历，这是题目通用提交要求，后续操作者需要自行补充。

验收方式：

- 运行说明能让他人从零启动项目。
- `prompt/` 和 `screenshot/` 存在且有内容。
- Git log 有多个阶段性 commit。
- 打包命令排除 `node_modules`。

建议测试命令：

```bash
npm install
npm run build
npm test
npm run dev
bash scripts/smoke.sh
git status --short
git log --oneline --decorate -n 20
```

建议 Git commit message：

```text
docs(question-1): add runbook screenshots and submission assets
```

该阶段完成后给后续 AI 的注意事项：

- 最终交付不是只看代码，截图、prompt、简历、Git 历史都会影响提交完整性。
- 打包前必须确认没有 `node_modules` 和 `.DS_Store`。

## 7. 每阶段验收清单

### Stage 0 Checklist

- [ ] 已阅读根目录 README。
- [ ] 已阅读 `question-1/README.md`。
- [ ] 已阅读 10 个 SOP HTML。
- [ ] 已确认当前没有已有应用代码。
- [ ] 已整理 Phase 1/2/3 要求。
- [ ] 已整理风险点。
- [ ] 未修改任何文件。

### Stage 1 Checklist

- [ ] `package.json` 存在。
- [ ] `tsconfig.json` 存在。
- [ ] `.gitignore` 存在并排除 `node_modules`、`dist`、`.DS_Store`。
- [ ] `src/app.ts` 存在并导出 app。
- [ ] `src/server.ts` 存在并能启动服务。
- [ ] `/health` 返回 `{ ok: true }`。
- [ ] `npm install` 成功。
- [ ] `npm run build` 成功。
- [ ] `npm test` 成功或至少无失败测试。

### Stage 2 Checklist

- [ ] 能加载 `data/` 下 10 个 SOP HTML。
- [ ] 每个文档有 `id`、`filename`、`title`、`text`、`html`。
- [ ] `script` 内容不会进入 `text`。
- [ ] `style` 内容不会进入 `text`。
- [ ] `noscript/template` 内容不会进入 `text`。
- [ ] HTML 实体能解码。
- [ ] `sop-004.html` 坏 HTML 解析不报错。
- [ ] `sop-005.html` 深层嵌套正文能提取。
- [ ] `sop-002` 的解析正文不包含 `replicationLag`。
- [ ] `npm test -- htmlParser` 通过。
- [ ] `npm run build` 通过。

### Stage 3 Checklist

- [ ] `/v1` 页面可以打开。
- [ ] `POST /v1/documents` 可以新增或更新文档。
- [ ] `/v1/search?q=OOM` 返回 `sop-001`。
- [ ] `/v1/search?q=故障` 返回多个文档。
- [ ] `/v1/search?q=replication` 返回空。
- [ ] `/v1/search?q=CDN` 返回 `sop-003` 和 `sop-010`。
- [ ] `/v1/search?q=%26` 能搜索正文中的 `&`。
- [ ] `q=&` 按题目要求被特殊处理。
- [ ] 搜索大小写不敏感。
- [ ] snippet 来自可见正文。
- [ ] script/style 内容不会进入索引。
- [ ] `npm test -- v1` 通过。
- [ ] `npm run build` 通过。

### Stage 4 Checklist

- [ ] `/v2` 页面可以打开。
- [ ] `/v2/search?q=服务器挂了` 返回结果靠前包含 `sop-001` 和 `sop-004`。
- [ ] `/v2/search?q=黑客攻击` 返回 `sop-005` 靠前。
- [ ] `/v2/search?q=机器学习模型出问题` 返回 `sop-008` 靠前。
- [ ] Phase 2 不只是 `includes(query)`。
- [ ] 有可解释的离线语义扩展或相似度计算。
- [ ] 不依赖外部 API 才能通过。
- [ ] v1 测试仍通过。
- [ ] `npm test -- v2` 通过。
- [ ] `npm run build` 通过。

### Stage 5 Checklist

- [ ] `/v3` 页面可以打开。
- [ ] `POST /v3/chat` 可用。
- [ ] Agent 工具只有 `readFile(fname)`。
- [ ] Agent 首先读取 `sop-index.md`。
- [ ] Agent 根据问题读取对应 SOP。
- [ ] `readFile` 禁止路径穿越。
- [ ] `readFile` 禁止绝对路径。
- [ ] `readFile` 禁止 glob。
- [ ] `readFile` 禁止目录读取。
- [ ] Agent 不直接绕过 `readFile` 使用文档库回答。
- [ ] 前端展示工具调用过程。
- [ ] “数据库主从延迟超过30秒怎么处理？”读取 `sop-002.html`。
- [ ] “服务 OOM 了怎么办？”读取 `sop-001.html`。
- [ ] “P0 故障的响应流程是什么？”读取多个 SOP。
- [ ] “怀疑有人入侵了系统”读取 `sop-005.html`。
- [ ] “推荐结果质量下降了”读取 `sop-008.html`。
- [ ] `npm test -- v3` 通过。
- [ ] `npm run build` 通过。

### Stage 6 Checklist

- [ ] `/v1`、`/v2`、`/v3` 页面风格统一。
- [ ] 搜索结果展示 `id`、`title`、`snippet`、`score`。
- [ ] Agent 页面展示用户问题。
- [ ] Agent 页面展示回答。
- [ ] Agent 页面展示工具名。
- [ ] Agent 页面展示工具参数。
- [ ] Agent 页面展示 observation 摘要。
- [ ] Agent 页面展示 sources。
- [ ] 页面无明显文字重叠。
- [ ] 页面适合截图。
- [ ] `npm test` 通过。
- [ ] `npm run build` 通过。

### Stage 7 Checklist

- [ ] parser 测试覆盖 HTML 实体、坏 HTML、script/style 剔除。
- [ ] v1 测试覆盖 README 的所有 Phase 1 用例。
- [ ] v2 测试覆盖 README 的所有 Phase 2 用例。
- [ ] Agent 测试覆盖 README 的所有 Phase 3 典型问题。
- [ ] Agent 测试覆盖非法文件名。
- [ ] `scripts/smoke.sh` 存在。
- [ ] `scripts/smoke.sh` 能对运行中的服务做 curl 验收。
- [ ] `npm test` 通过。
- [ ] `npm run build` 通过。
- [ ] `bash scripts/smoke.sh` 通过。

### Stage 8 Checklist

- [ ] `README_RUN.md` 存在。
- [ ] README 说明安装、启动、测试。
- [ ] README 说明 Phase 1/2/3 实现。
- [ ] README 说明 Agent 工具限制。
- [ ] `prompt/` 存在。
- [ ] `prompt/` 中有提示词截图。
- [ ] `screenshot/` 存在。
- [ ] `screenshot/` 中有 `/v1`、`/v2`、`/v3` 效果截图。
- [ ] 根目录已准备个人简历。
- [ ] Git log 有多个阶段性 commit。
- [ ] `node_modules` 未提交。
- [ ] `.DS_Store` 未提交。
- [ ] 最终 zip 包包含 `.git` 目录。

## 8. 关键风险点和规避方案

### 风险 1：script 标签误入搜索索引

- 风险描述：`sop-002.html` 的脚本中有 `replicationLag`，如果搜索 raw HTML 或未移除 script，`/v1/search?q=replication` 会误返回 `sop-002`。
- 为什么影响评分：README 明确要求该查询返回空。
- 推荐规避方式：Stage 2 parser 中先删除 `script`，所有搜索只基于 `DocumentRecord.text`。
- 应测试阶段：Stage 2、Stage 3。

### 风险 2：HTML 实体未解码

- 风险描述：多个 SOP 使用 `&amp;`、`&#38;`、`&period;` 等实体。
- 为什么影响评分：`CDN`、`&`、标题和 snippet 可能显示或匹配错误。
- 推荐规避方式：使用 Cheerio/htmlparser2 的 text 提取能力，确保 entities decode；添加实体测试。
- 应测试阶段：Stage 2、Stage 3。

### 风险 3：`q=&` 被解析为空

- 风险描述：标准 query parser 会把 `/v1/search?q=&` 解析为空字符串。
- 为什么影响评分：README 明确给出 `q=&` 验收用例。
- 推荐规避方式：支持 `q=%26`，并对 raw URL 为 `q=&` 的情况特殊解释为查询 `&`。
- 应测试阶段：Stage 3、Stage 7。

### 风险 4：Phase 2 做成普通关键词搜索

- 风险描述：如果只用 `includes(query)`，自然语言查询无法命中。
- 为什么影响评分：Phase 2 要求“查询词不需要在文档中精确出现”。
- 推荐规避方式：实现领域概念词典、同义词扩展、标题/领域加权、TF-IDF 或 n-gram 相似度。
- 应测试阶段：Stage 4、Stage 7。

### 风险 5：Agent 越权读取文件

- 风险描述：`readFile("../../README.md")`、绝对路径或 glob 可能读取 `data/` 外文件。
- 为什么影响评分：题目明确限制 Agent 只能通过工具读取 `data/` 内文件，不能列目录、不能 glob、不能任意路径。
- 推荐规避方式：`safeReadFile` 只接受 basename，并用 `path.resolve` 校验路径仍在 data 目录内。
- 应测试阶段：Stage 5、Stage 7。

### 风险 6：Agent 没有展示工具调用过程

- 风险描述：后端虽然调用工具，但前端不展示 toolCalls。
- 为什么影响评分：题目明确要求展示 Agent 工具调用过程。
- 推荐规避方式：`POST /v3/chat` 返回 `toolCalls`，`/v3` 页面逐条渲染工具名、参数和 observation 摘要。
- 应测试阶段：Stage 5、Stage 6。

### 风险 7：Agent 回答脱离 SOP 内容

- 风险描述：Agent 根据通用常识回答，而不是依据 SOP。
- 为什么影响评分：On-call 助手的核心是基于 SOP 文档回答。
- 推荐规避方式：Agent 回答生成时只使用 `readFile` 得到的内容，并在响应中返回 `sources`。
- 应测试阶段：Stage 5、Stage 7。

### 风险 8：P0 故障需要综合多个 SOP

- 风险描述：只读取一个文件会遗漏不同团队的 P0 响应要求。
- 为什么影响评分：README 明确要求 P0 故障响应流程“综合多个 SOP”。
- 推荐规避方式：P0/升级流程类问题读取多个含升级流程的 SOP，例如 `sop-001`、`sop-002`、`sop-004`、`sop-005`、`sop-010`。
- 应测试阶段：Stage 5、Stage 7。

### 风险 9：prompt、screenshot、Git 历史等交付要求被忽略

- 风险描述：代码完成但缺少截图、提示词记录、简历或 Git 历史。
- 为什么影响评分：根 README 的提交方式明确要求这些内容。
- 推荐规避方式：Stage 8 专门处理提交资产，最终检查 zip 内容。
- 应测试阶段：Stage 8。

### 风险 10：过度设计导致无法按时完成

- 风险描述：一开始引入复杂前端框架、数据库、外部 LLM/embedding 服务，增加调试成本。
- 为什么影响评分：题目按功能完整度评分，每阶段完整实现才得分。
- 推荐规避方式：先用 Express + 内存索引 + 静态页面完成评分点，再考虑优化。
- 应测试阶段：全阶段。

## 9. 推荐执行顺序

后续 AI 或工程师应按以下方式执行：

- 每次只做一个阶段。
- 每个阶段完成后先运行该阶段测试。
- 测试通过后再 commit。
- 不要跨阶段大改，避免 Phase 1 尚未稳定就同时改 Phase 2/3。
- 遇到失败时优先最小修复，不要重写整个架构。
- 不要一开始引入复杂前端框架。
- 不要默认依赖不可用的外部服务。
- 先保证 README 明确验收用例通过，再优化 UI 和代码结构。

推荐顺序：

1. Stage 1：初始化项目结构，确认服务能启动。
2. Stage 2：完成 HTML 解析和文档库，这是所有后续阶段的基础。
3. Stage 3：完成 Phase 1，先拿到关键词搜索分。
4. Stage 4：完成 Phase 2，补语义排序。
5. Stage 5：完成 Phase 3，重点保证工具限制和 trace 展示。
6. Stage 6：统一页面风格，准备截图。
7. Stage 7：补齐自动化测试和 smoke 脚本。
8. Stage 8：补运行说明、prompt、screenshot 和最终提交资产。

每阶段提交建议：

- Stage 1 通过 `npm run build` 后 commit。
- Stage 2 parser 测试通过后 commit。
- Stage 3 v1 README 验收用例通过后 commit。
- Stage 4 v2 语义验收用例通过后 commit。
- Stage 5 Agent 典型问题和安全测试通过后 commit。
- Stage 6 页面手工确认可截图后 commit。
- Stage 7 `npm test` 和 smoke 全通过后 commit。
- Stage 8 最终资产齐全后 commit。

## 10. 给后续 AI 的工作约束

后续 AI 必须遵守以下约束：

- 不要跳过测试。
- 不要一次性完成所有阶段。
- 不要把 Phase 2 写成硬编码答案。
- 不要让 Agent 绕过 `readFile`。
- 不要使用目录遍历、glob 或任意文件读取。
- 不要把 `node_modules`、`dist`、`.DS_Store` 打包或提交。
- 每阶段必须保留清晰 commit。
- 页面必须能真实运行和截图。
- 修改时优先保持已有 API 输出格式稳定。
- 搜索和 Agent 回答必须基于可见 SOP 正文，而不是 raw HTML 脚本内容。
- 所有阶段都要围绕 README 中的验收用例实现，不做无关复杂功能。

## 11. 最终交付前检查清单

- [ ] `npm install` 成功。
- [ ] `npm run build` 成功。
- [ ] `npm test` 成功。
- [ ] `npm run smoke` 或 `bash scripts/smoke.sh` 成功。
- [ ] `/v1` 页面可访问。
- [ ] `/v2` 页面可访问。
- [ ] `/v3` 页面可访问。
- [ ] `/v1/search?q=OOM` 返回 `sop-001`。
- [ ] `/v1/search?q=故障` 返回多个文档。
- [ ] `/v1/search?q=replication` 返回空。
- [ ] `/v1/search?q=CDN` 返回 `sop-003` 和 `sop-010`。
- [ ] `/v1/search?q=%26` 能搜索正文中的 `&`。
- [ ] `/v2/search?q=服务器挂了` 返回 `sop-001` 和 `sop-004` 靠前。
- [ ] `/v2/search?q=黑客攻击` 返回 `sop-005` 靠前。
- [ ] `/v2/search?q=机器学习模型出问题` 返回 `sop-008` 靠前。
- [ ] `/v3/chat` 对 DBA、OOM、P0、安全入侵、推荐质量下降问题均能正确调用工具并回答。
- [ ] Agent 工具调用过程在 `/v3` 页面可见。
- [ ] Agent 不能读取 `data/` 外文件。
- [ ] `README_RUN.md` 存在。
- [ ] `prompt/` 存在并放入提示词截图。
- [ ] `screenshot/` 存在并放入效果截图。
- [ ] 根目录已放入个人简历。
- [ ] Git log 有多个阶段性 commit。
- [ ] `node_modules` 没有被提交或打包。
- [ ] `.DS_Store` 没有被提交或打包。
- [ ] 最终 zip 包包含完整 Git 仓库，包括 `.git` 目录。
- [ ] 最终 zip 包排除了 `node_modules/*`。

