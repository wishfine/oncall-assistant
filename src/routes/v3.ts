import { Router, Request, Response } from "express";
import { runAgent } from "../services/agent";

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
  const { message } = req.body;
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  try {
    const result = await runAgent(message);
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
