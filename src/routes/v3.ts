import { Router, Request, Response } from "express";
import { runAgent, ChatMessage } from "../services/agent";

const router = Router();

// GET /v3 — agent chat page
router.get("/", (_req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Phase 3 — On-Call Agent</title>
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<div class="container">
  <nav class="phase-nav">
    <a href="/v1">Phase 1 · 关键词搜索</a>
    <a href="/v2">Phase 2 · 语义搜索</a>
    <a href="/v3" class="active">Phase 3 · Agent 助手</a>
  </nav>
  <div class="header">
    <h1>Phase 3 · On-Call Agent 助手</h1>
    <p>向 Agent 描述你的问题，Agent 会通过 readFile 工具读取 SOP 文档并给出建议</p>
  </div>
  <div id="chat-history" class="chat-history"></div>
  <div class="search-box">
    <input type="text" id="query" placeholder="例如：服务 OOM 了怎么办？" autofocus>
    <button id="send-btn">发送</button>
  </div>
  <div id="status"></div>
</div>
<script src="/v3.js"></script>
</body>
</html>
  `.trim());
});

// POST /v3/chat — agent chat endpoint
router.post("/chat", async (req: Request, res: Response) => {
  const { message, history } = req.body;
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "message is required" } });
    return;
  }

  // Validate history if provided
  let chatHistory: ChatMessage[] | undefined;
  if (Array.isArray(history)) {
    chatHistory = history.filter(
      (m: ChatMessage) =>
        m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    );
  }

  try {
    const result = await runAgent(message, chatHistory);
    res.json(result);
  } catch (e) {
    res.status(500).json({
      answer: `Agent 处理出错: ${(e as Error).message}`,
      toolCalls: [],
      sources: [],
    });
  }
});

export default router;
