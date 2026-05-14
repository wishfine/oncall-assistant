import * as fs from "fs";
import * as path from "path";
import { listDocuments, getDataDir } from "./documentRepository";
import type { DocumentRecord } from "../types";

// Common English tool/tech names that are poor search keywords
const EN_STOPWORDS = new Set([
  "api", "call", "on", "the", "and", "for", "use", "all", "get", "set",
  "com", "org", "net", "http", "https", "html", "css", "js", "url",
  "v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8",
]);

/**
 * Extract keywords from a document's title and text.
 * Balances Chinese bigrams/trigrams with significant English domain terms.
 */
function extractKeywords(doc: DocumentRecord): string[] {
  const combined = `${doc.title} ${doc.text.slice(0, 3000)}`.toLowerCase();

  // Collect English words with stopword filtering
  const enWords = new Set<string>();
  const enRe = /[a-z]{2,}[a-z0-9]*/g;
  let m: RegExpExecArray | null;
  while ((m = enRe.exec(combined)) !== null) {
    const word = m[0];
    if (!EN_STOPWORDS.has(word) && word.length >= 2) {
      enWords.add(word);
    }
  }

  // Collect CJK bigrams
  const zhBigrams = new Set<string>();
  for (let i = 0; i < combined.length - 1; i++) {
    const pair = combined.slice(i, i + 2);
    if (/^[一-鿿]{2}$/.test(pair) &&
        !/^[的了在是]/.test(pair) &&
        !/[的了在是]$/.test(pair)) {
      zhBigrams.add(pair);
    }
  }

  // Collect CJK trigrams
  const zhTrigrams = new Set<string>();
  for (let i = 0; i < combined.length - 2; i++) {
    const triple = combined.slice(i, i + 3);
    if (/^[一-鿿]{3}$/.test(triple)) {
      zhTrigrams.add(triple);
    }
  }

  // Also extract bigrams/trigrams from title separately (higher priority)
  const titleLower = doc.title.toLowerCase();
  const titleZh: string[] = [];
  for (let i = 0; i < titleLower.length - 1; i++) {
    const pair = titleLower.slice(i, i + 2);
    if (/^[一-鿿]{2}$/.test(pair)) titleZh.push(pair);
  }
  for (let i = 0; i < titleLower.length - 2; i++) {
    const triple = titleLower.slice(i, i + 3);
    if (/^[一-鿿]{3}$/.test(triple)) titleZh.push(triple);
  }

  // Title words as domain anchors (highest priority)
  const domainAnchors = new Set<string>();
  for (const anchor of titleZh) {
    domainAnchors.add(anchor);
  }

  // Compose: Chinese first, then English, with title anchors leading
  const result: string[] = [];
  for (const a of domainAnchors) result.push(a);
  for (const z of zhTrigrams) { if (!domainAnchors.has(z)) result.push(z); }
  for (const z of zhBigrams) { if (!domainAnchors.has(z)) result.push(z); }
  for (const e of enWords) result.push(e);

  return result.slice(0, 30);
}

/**
 * Derive a short summary from the document's first meaningful paragraph.
 */
function deriveSummary(doc: DocumentRecord): string {
  const sentences = doc.text.split(/[。；\n]/);
  for (const s of sentences) {
    const cleaned = s.trim();
    if (cleaned.length > 30 && cleaned.length < 200) {
      return cleaned;
    }
  }
  return doc.text.slice(0, 150).trim();
}

/**
 * Auto-generate sop-index.md from the current document repository.
 * This index is read by the Agent on its first tool call.
 */
export function generateSopIndex(): string {
  const docs = listDocuments();
  if (docs.length === 0) return "# SOP Index\n\n（暂无文档）\n";

  // Sort by id
  docs.sort((a, b) => a.id.localeCompare(b.id));

  const lines: string[] = [];
  lines.push("# SOP Index");
  lines.push("");
  lines.push("此文件由系统自动生成，供 Agent 使用 `readFile(\"sop-index.md\")` 定位相关 SOP。");
  lines.push("");

  for (const doc of docs) {
    const keywords = extractKeywords(doc);
    const summary = deriveSummary(doc);

    lines.push(`## ${doc.filename}`);
    lines.push("");
    lines.push(`- **标题**：${doc.title}`);
    lines.push(`- **关键词**：${keywords.join("、")}`);
    lines.push(`- **摘要**：${summary}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Ensure sop-index.md exists and is up to date.
 * Regenerates if the index is missing or older than any SOP file.
 */
export function ensureSopIndex(): void {
  const dataDir = getDataDir();
  const indexPath = path.join(dataDir, "sop-index.md");

  let needsRegen = false;

  try {
    const indexStat = fs.statSync(indexPath);
    const docs = listDocuments();

    // Check if any SOP is newer than the index
    for (const doc of docs) {
      const sopPath = path.join(dataDir, doc.filename);
      try {
        const sopStat = fs.statSync(sopPath);
        if (sopStat.mtimeMs > indexStat.mtimeMs) {
          needsRegen = true;
          break;
        }
      } catch {
        // SOP file missing, skip
      }
    }

    // Check if doc count changed
    if (!needsRegen) {
      const existing = fs.readFileSync(indexPath, "utf-8");
      const headingCount = (existing.match(/^## sop-/gm) || []).length;
      if (headingCount !== docs.length) {
        needsRegen = true;
      }
    }
  } catch {
    needsRegen = true;
  }

  if (needsRegen) {
    const content = generateSopIndex();
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(indexPath, content, "utf-8");
  }
}
