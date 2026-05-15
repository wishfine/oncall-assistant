# Session User Prompts Export

说明：本文件导出当前 session 中用户侧出现的消息。包含自动注入的环境上下文消息，以及用户手写的实质性 prompt。未包含 assistant 回复和工具输出。

## Prompt 0：环境上下文

~~~text
<environment_context>
  <cwd>/Users/wishfine/Documents/月之暗面/coding-exam/question-1</cwd>
  <shell>zsh</shell>
  <current_date>2026-05-14</current_date>
  <timezone>Asia/Shanghai</timezone>
</environment_context>
~~~

## Prompt 1：要求通读仓库并制定计划

~~~text
你是一个严谨的资深全栈工程师和代码审查者。现在我要完成 GitHub 项目：

https://github.com/oriengy/coding-exam

其中我要做的是 question-1：On-call 助手。我已经把项目clone了 就在当前项目下

请你先通读整个仓库，重点阅读：
1. 根目录 README 或说明文件；
2. question-1/README.md；
3. question-1/data/ 下的所有 SOP HTML 文件；
4. 已有的项目结构、依赖、脚本和代码，如果存在的话。

注意：本阶段你只需要理解项目和制定计划，不要开始写代码，不要修改任何文件。

请你完成以下任务：

## 1. 准确复述题目要求

请用中文说明 question-1 到底要求实现什么，包括：
- 最终要交付什么；
- 前端需要展示什么；
- 后端 API 需要实现什么；
- Phase 1、Phase 2、Phase 3 分别对应什么能力；
- 每个阶段的评分重点是什么；
- 题目中明确给出的测试用例或验收条件是什么。

## 2. 分析现有仓库状态

请检查当前仓库中 question-1 目录的状态，并说明：
- 当前是否已经有代码；
- 当前使用了什么技术栈；
- 当前有没有 package.json、server、前端页面、测试文件；
- data 目录里有哪些 SOP 文件；
- 是否已经存在 prompt/ 和 screenshot/ 目录；
- 当前项目离完成题目还有哪些缺口。

## 3. 制定完整实现 Plan

请把整个项目拆成多个阶段，每个阶段都要说明：

- 阶段名称；
- 目标；
- 需要新增或修改的文件；
- 具体要实现的功能；
- 关键技术点；
- 验收方式；
- 该阶段完成后的建议 Git commit message。

阶段划分请至少包含：

### Stage 0：项目理解与方案确认
只阅读和分析，不写代码。

### Stage 1：项目初始化或结构整理
搭建或整理 TypeScript/Node.js/Express 项目结构，保证能启动。

### Stage 2：HTML 文档解析与文档库
读取 data 目录中的 SOP HTML，解析标题和正文，去掉 script/style/noscript 内容。

### Stage 3：Phase 1 关键词搜索
实现 /v1/documents、/v1/search、/v1 页面。

### Stage 4：Phase 2 语义搜索
实现 /v2/search、/v2 页面，支持自然语言语义匹配，不依赖外部 API 也能跑通。

### Stage 5：Phase 3 On-call Agent
实现 /v3 页面和 Agent API，Agent 只能使用 readFile(fname) 工具读取 data 目录下的文件，并展示工具调用过程。

### Stage 6：前端页面优化
统一 /v1、/v2、/v3 页面风格，让截图清晰好看。

### Stage 7：测试与验收脚本
补充自动测试和手工 curl 验收脚本。

### Stage 8：README、截图、prompt 归档与最终提交
补充运行说明，准备 prompt/ 和 screenshot/，确保 node_modules 不被打包。

## 4. 识别风险点

请专门列出这个题目最容易踩坑的地方，例如：
- Phase 1 不能搜索 script 标签中的内容；
- q=& 或 q=%26 的处理；
- Phase 2 不能只是简单关键词搜索；
- Agent 不能列目录、不能 glob、不能读取任意路径；
- Agent 的回答必须基于 readFile 读取到的内容；
- 前端必须展示 Agent 工具调用过程；
- Git 提交历史、prompt 截图、效果截图等交付要求。

## 5. 输出后续执行策略

最后请给出一个建议执行顺序：

- 哪些阶段应该先做；
- 每个阶段完成后应该运行哪些命令；
- 每个阶段应该如何验证；
- 什么时候 commit；
- 什么时候截图；
- 最终打包提交前应该检查什么。

重要要求：

1. 本轮不要写代码；
2. 本轮不要修改文件；
3. 不要过度设计；
4. 优先保证题目评分点全部命中；
5. 方案要具体到文件级别；
6. 每个阶段要能独立验收；
7. 输出要清晰、结构化，方便我确认后逐阶段让你实现。

最终的要求如下：
# AI 编程面试题

## 说明

本仓库包含两道可选的编程面试题，候选人**任选其一**完成即可。

> 通过本测试即视为通过一面，后续仅需再通过一轮面试即发放 Offer。

| 题目 | 说明 |
| ---- | ---- |
| [题目一：On-Call 助手](./question-1/) | 构建一个基于 SOP 文档的 On-Call 助手，包含搜索引擎、语义搜索和 Agent 对话三个阶段 |
| [题目二：Antigravity 动画复刻](./question-2/) | 像素级复刻 antigravity.google 页面的粒子动画效果 |

## 通用规则

- 编程语言和框架不限，但好的技术栈选择也是评价的一部分
- **强烈鼓励使用任何 AI 工具辅助开发** — 无论你的技术背景是什么，两道题都可以借助 AI 来完成
- 可以使用任何外部工具和资源，但**必须独立完成**，不得在他人协助下完成题目
- 请保留完整的 Git 提交历史

## 提交方式

1. 按照对应题目 README 中的目录结构组织产物
2. 将与 AI 交互过程中的所有提示词截图放入 `prompt/` 目录
3. 将最终产物的效果截图放入 `screenshot/` 目录
4. 将你的**个人简历**放入仓库根目录
5. 打包**整个 Git 仓库**（包含 `.git` 目录）为 `.zip` 文件
6. 将 `.zip` 文件发送到指定邮箱

```bash
# 打包示例
zip -r your-name-exam.zip . -x "node_modules/*"
```
~~~

## Prompt 2：要求创建实施计划 Markdown

~~~text
你刚才已经通读并分析了 GitHub 仓库 oriengy/coding-exam 中 question-1：On-call 助手，并输出了题目要求、当前仓库状态、实现 Plan、风险点和后续执行策略。

现在请你不要写代码、不要修改项目文件。

请你基于刚才的分析，产出一份完整的 Markdown 文档，文件名建议为：

question-1-implementation-plan.md

这份文档的目标是：让后续接手这个项目的其他 AI 或工程师，能够不重新读题，也能清楚知道这个项目应该分哪些阶段完成、每个阶段要做什么、改哪些文件、怎么验收、怎么提交。

请按照下面结构输出 Markdown 内容：

# Question 1: On-call 助手实现计划

## 1. 项目目标概述

请简洁说明：
- 本项目要实现什么；
- 为什么要分成 Phase 1、Phase 2、Phase 3；
- 最终交付物包括哪些；
- 前端和后端分别需要完成什么。

## 2. 题目要求整理

请准确整理 question-1 的要求，包括：

### 2.1 Phase 1：关键词搜索

说明：
- 要实现哪些 API；
- `/v1/documents` 做什么；
- `/v1/search?q=...` 做什么；
- `/v1` 页面做什么；
- 搜索结果格式是什么；
- 必须通过哪些验收用例。

### 2.2 Phase 2：语义搜索

说明：
- 要实现哪些 API；
- `/v2/search?q=...` 做什么；
- `/v2` 页面做什么；
- 为什么不能只做关键词匹配；
- 推荐的离线语义搜索方案；
- 必须通过哪些验收用例。

### 2.3 Phase 3：On-call Agent

说明：
- `/v3` 页面做什么；
- Agent API 应该如何设计；
- Agent 只能使用什么工具；
- `readFile(fname)` 的限制是什么；
- 为什么要展示工具调用过程；
- 必须支持哪些典型问题。

## 3. 当前仓库状态

请说明：
- 当前 question-1 目录中已有文件；
- data 目录中有哪些 SOP HTML 文件；
- 每个 SOP 文件大致对应什么领域；
- 当前缺少哪些代码、依赖、脚本、页面、测试和文档；
- 当前仓库有什么隐藏坑点，例如坏 HTML、HTML 实体、script/style 内容等。

## 4. 推荐技术栈

请给出推荐技术栈，并说明理由。

建议优先考虑：
- TypeScript
- Node.js
- Express
- Cheerio 或 htmlparser2
- Vitest
- Supertest
- 原生 HTML/CSS/JS

请明确说明：
- 为什么不建议一开始使用复杂前端框架；
- 为什么不建议默认依赖外部 embedding API；
- 为什么前端静态页面已经足够。

## 5. 总体目录结构设计

请给出建议目录结构，例如：

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
    ...
    sop-010.html
    sop-index.md
  tests/
  scripts/
    smoke.sh
  prompt/
  screenshot/
````

每个关键文件请用一句话说明它的作用。

## 6. 分阶段实施计划

请把项目拆成以下阶段。每个阶段都要按照统一格式写：

* 阶段目标；
* 要新增或修改的文件；
* 具体实现任务；
* 关键实现细节；
* 验收方式；
* 建议测试命令；
* 建议 Git commit message；
* 该阶段完成后给后续 AI 的注意事项。

阶段必须包括：

### Stage 0：项目理解与方案确认

要求：

* 只读分析；
* 不写代码；
* 明确题目要求、评分点和风险点。

### Stage 1：初始化项目结构

要求：

* 初始化 TypeScript + Express 项目；
* 配置 package.json、tsconfig、.gitignore；
* 实现 `/health`；
* 保证项目能启动、能 build。

### Stage 2：HTML 解析与文档库

要求：

* 读取 data 目录下所有 SOP HTML；
* 解析 id、filename、title、text、html；
* 移除 script/style/noscript/template；
* 解码 HTML 实体；
* 兼容坏 HTML；
* 建立内存文档库。

### Stage 3：Phase 1 关键词搜索

要求：

* 实现 POST `/v1/documents`；
* 实现 GET `/v1/search?q=...`；
* 实现 GET `/v1` 页面；
* 关键词搜索只基于正文可见文本；
* 支持中英文；
* 支持大小写不敏感；
* 支持 snippet；
* 特别处理 `q=&` 和 `q=%26`。

### Stage 4：Phase 2 语义搜索

要求：

* 实现 GET `/v2/search?q=...`；
* 实现 GET `/v2` 页面；
* 默认不依赖外部 API；
* 使用语义扩展词典、领域概念词、TF-IDF 或 n-gram 等方式实现离线语义搜索；
* 确保指定语义查询结果排序正确。

### Stage 5：Phase 3 On-call Agent

要求：

* 实现 GET `/v3` 页面；
* 实现 POST `/v3/chat`；
* Agent 只能通过 `readFile(fname)` 读取 data 目录下文件；
* 防止路径穿越；
* 禁止列目录、glob、读取任意路径；
* Agent 先读 `sop-index.md`，再选择 SOP 文件；
* 回答必须基于读取到的 SOP 内容；
* 前端展示工具调用过程。

### Stage 6：前端页面优化

要求：

* `/v1`、`/v2`、`/v3` 页面统一风格；
* 搜索结果展示 id、title、snippet、score；
* Agent 页面展示用户问题、Agent 回答、工具调用参数、observation 摘要；
* 页面适合截图。

### Stage 7：测试与验收脚本

要求：

* 添加 parser 测试；
* 添加 v1 搜索测试；
* 添加 v2 语义搜索测试；
* 添加 Agent 工具调用测试；
* 添加 smoke.sh 或类似手工验收脚本；
* 覆盖 README 中明确给出的验收用例。

### Stage 8：README、prompt、screenshot 与最终提交

要求：

* 添加运行说明；
* 说明如何安装、启动、测试；
* 说明每个阶段实现了什么；
* 说明 Agent 工具限制；
* 准备 prompt/ 和 screenshot/；
* 检查 node_modules 不进入压缩包；
* 检查 Git 历史清晰。

## 7. 每阶段验收清单

请用 checklist 形式列出每个阶段完成后必须确认的事项。

例如：

```md
### Stage 3 Checklist

- [ ] `/v1` 页面可以打开
- [ ] `/v1/search?q=OOM` 返回 sop-001
- [ ] `/v1/search?q=故障` 返回多个文档
- [ ] `/v1/search?q=replication` 返回空
- [ ] `/v1/search?q=CDN` 返回 sop-003 和 sop-010
- [ ] `/v1/search?q=%26` 能搜索正文中的 &
- [ ] script/style 内容不会进入索引
- [ ] npm test 通过
- [ ] npm run build 通过
```

## 8. 关键风险点和规避方案

请专门列出风险点，每个风险点包括：

* 风险描述；
* 为什么会影响评分；
* 推荐规避方式；
* 应该在哪个阶段测试。

至少包括：

* script 标签误入搜索索引；
* HTML 实体未解码；
* `q=&` 被解析为空；
* Phase 2 做成普通关键词搜索；
* Agent 越权读取文件；
* Agent 没有展示工具调用过程；
* Agent 回答脱离 SOP 内容；
* P0 故障需要综合多个 SOP；
* prompt/、screenshot/、Git 历史等交付要求被忽略。

## 9. 推荐执行顺序

请说明后续 AI 应该如何执行：

* 每次只做一个阶段；
* 每个阶段完成后先测试；
* 测试通过后再 commit；
* 不要跨阶段大改；
* 遇到失败时优先最小修复；
* 不要一开始引入复杂架构；
* 不要依赖不可用的外部服务。

## 10. 给后续 AI 的工作约束

请写一段明确约束，后续 AI 必须遵守：

* 不要跳过测试；
* 不要一次性完成所有阶段；
* 不要把 Phase 2 写成硬编码答案；
* 不要让 Agent 绕过 readFile；
* 不要使用目录遍历、glob 或任意文件读取；
* 不要把 node_modules、dist、.DS_Store 打包；
* 每阶段必须保留清晰 commit；
* 页面必须能真实运行和截图。

## 11. 最终交付前检查清单

请给出最终提交前 checklist，包括：

* [ ] npm install 成功
* [ ] npm run build 成功
* [ ] npm test 成功
* [ ] npm run smoke 或 scripts/smoke.sh 成功
* [ ] `/v1` 页面可访问
* [ ] `/v2` 页面可访问
* [ ] `/v3` 页面可访问
* [ ] README_RUN.md 存在
* [ ] prompt/ 存在并放入提示词截图
* [ ] screenshot/ 存在并放入效果截图
* [ ] Git log 有多个阶段性 commit
* [ ] node_modules 没有被提交或打包
* [ ] 最终 zip 包包含完整 Git 仓库

输出要求：

1. 创建一个md文件并写入；
2. 不要写代码；
3. 内容要具体、可执行；
4. 每个阶段都要能让另一个 AI 直接照着做；
5. 语言使用中文；
6. 不要写空泛建议，要写到文件级、接口级、测试级；
7. Markdown 结构清晰。

```
```
~~~

## Prompt 3：其他 AI 的异议与讨论请求

~~~text
找到了，文件名是 `question-1-implementation-plan.md`。不过它在原目录下，不在 worktree 里。让我读一下。

已仔细读完。这份计划整体质量很高，结构清晰、分阶段合理。以下是我审视后的分析和意见：

---

## 整体评价：计划可行，无明显错误

技术栈合理（TypeScript + Express + Cheerio），8 个阶段的拆解粒度合适，每个阶段有明确验收清单。对题目的隐藏坑点识别到位。

---

## 我有异议或需要讨论的 3 个点：

### 1. Phase 2 语义搜索方案偏模糊

计划明确了"离线领域词典 + TF-IDF/n-gram"方向，也警告不要硬编码三条测试用例。但词典怎么映射到文档评分，算法细节没定义。比如"服务器挂了"需要通过词典扩展成 `服务`、`超时`、`不可用`、`Pod` 等词后，如何加权计算最终相关性分数？这部分需要在实现时具体设计，否则容易变成"看起来像语义搜索，实际效果不稳定"。

**建议**：实现时我会采用「同义词扩展 + TF-IDF 余弦相似度」的方案——将 query 用词典扩展后，与每篇文档计算 TF-IDF 余弦距离，同时给标题命中加权。这样通用性更好，不依赖手工调权。

### 2. Phase 3 Agent 的"回答生成"方案不明确

这是最大的问题。计划描述了 Agent 流程（读索引→选文件→读 SOP→生成回答），但**"生成回答"这一步没有具体方案**。没有 LLM 的情况下，Agent 如何把 SOP 原文变成结构化的、有针对性的回答？

目前的隐含假设似乎是：Agent 解析 HTML 后提取相关段落，然后格式化输出。但这个"提取+格式化"的智能化程度决定了 Phase 3 的成败。纯规则提取可能变成"把 SOP 原文原样返回"，缺乏针对用户具体问题的分析和建议。

**建议**：我会设计一个**模板化回答生成器**——Agent 根据用户问题类型（OOM/延迟/安全/等）选择不同的回答模板，将 SOP 中的排查步骤、升级条件、禁止操作等结构化信息填入模板。这样回答看起来是"分析过"的，而不是原文复制。同时，如果用户本地有可用的 LLM API（如 localhost 的 Ollama），可以作为可选增强。

### 3. `sop-index.md` 是聪明的捷径，但需确保它与 SOP 内容一致

计划让 Agent 先读 `sop-index.md` 来定位文件。思路正确（因为 Agent 不能列目录）。但这个索引文件需要手工编写并维护，如果它与 SOP 实际内容脱节，Agent 就会定位错文件。

**建议**：实现时自动从已加载的文档库生成 `sop-index.md`，而不是手写。这样索引始终与 SOP 同步。

---

## 没有异议的部分：

- 目录结构设计合理
- Stage 1-8 执行顺序正确，每阶段独立验收、独立 commit
- 风险点识别全面（script 标签、HTML 实体、`q=&` 解析、路径穿越等）
- 技术栈选择务实，不过度设计
- Agent 安全限制（basename only、路径校验）考虑周全

---

**总结**：计划可以直接执行，上述 3 点我会在实现时按建议方案处理。要不要我现在开始 Stage 1？

这是其他AI提出的异议 你看看怎么解决
~~~

## Prompt 4：环境上下文更新

~~~text
<environment_context>
  <current_date>2026-05-15</current_date>
  <timezone>Asia/Shanghai</timezone>
</environment_context>
~~~

## Prompt 5：导出本 session prompt

~~~text
导出在这个session中我说的所有的prompt
~~~

