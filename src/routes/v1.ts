import { Router, Request, Response } from "express";
import { upsertDocument } from "../services/documentRepository";
import { keywordSearch } from "../services/keywordSearch";

const router = Router();

// GET /v1 — search page
router.get("/", (_req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Phase 1 — 关键词搜索</title>
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<div class="container">
  <nav class="phase-nav">
    <a href="/v1" class="active">Phase 1 · 关键词搜索</a>
    <a href="/v2">Phase 2 · 语义搜索</a>
    <a href="/v3">Phase 3 · Agent 助手</a>
  </nav>
  <div class="header">
    <h1>Phase 1 · 关键词搜索</h1>
    <p>输入关键词在 SOP 文档中检索，支持中英文混合查询</p>
  </div>
  <div class="search-box">
    <input type="text" id="query" placeholder="例如：OOM、故障、CDN…" autofocus>
    <button id="search-btn">搜索</button>
  </div>
  <div id="status"></div>
  <div id="results"></div>
</div>
<script src="/v1.js"></script>
</body>
</html>
  `.trim());
});

// POST /v1/documents — upload / update a document
router.post("/documents", (req: Request, res: Response) => {
  const { id, html } = req.body;
  if (!id || !html) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "id and html are required" } });
    return;
  }
  const doc = upsertDocument(id, html);
  res.status(201).json({ id: doc.id, title: doc.title });
});

// GET /v1/search — keyword search
router.get("/search", (req: Request, res: Response) => {
  let query = (req.query.q as string) || "";

  // Handle q=& — Express parses this as empty string
  // Detect via raw URL to distinguish "no q" from "q=&"
  if (!query && req.originalUrl.includes("q=&")) {
    query = "&";
  }
  // q=%26 is parsed as "&" by Express automatically

  if (!query) {
    res.json({ query: "", results: [] });
    return;
  }

  const results = keywordSearch(query);
  res.json({ query, results });
});

export default router;
