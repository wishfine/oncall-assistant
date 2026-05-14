import { Router, Request, Response } from "express";
import { semanticSearch } from "../services/semanticSearch";

const router = Router();

// GET /v2 — semantic search page
router.get("/", (_req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Phase 2 — 语义搜索</title>
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Phase 2 · 语义搜索</h1>
    <p>输入自然语言查询，无需精确匹配关键词即可找到相关 SOP</p>
  </div>
  <div class="search-box">
    <input type="text" id="query" placeholder="例如：服务器挂了、黑客攻击、机器学习模型出问题…" autofocus>
    <button id="search-btn">搜索</button>
  </div>
  <div id="status"></div>
  <div id="results"></div>
</div>
<script src="/v2.js"></script>
</body>
</html>
  `.trim());
});

// GET /v2/search — semantic search
router.get("/search", (req: Request, res: Response) => {
  const query = (req.query.q as string) || "";
  if (!query) {
    res.json({ query: "", results: [] });
    return;
  }
  const results = semanticSearch(query);
  res.json({ query, results });
});

export default router;
