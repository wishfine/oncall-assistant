import type { DocumentRecord, SearchResult } from "../types";
import { listDocuments } from "./documentRepository";

export function keywordSearch(query: string): SearchResult[] {
  if (!query) return [];

  const docs = listDocuments();
  const results: SearchResult[] = [];

  for (const doc of docs) {
    const score = computeScore(query, doc);
    if (score <= 0) continue;

    const snippet = makeSnippet(query, doc.text);
    results.push({
      id: doc.id,
      title: doc.title,
      snippet,
      score: Math.round(score * 100) / 100,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

function computeScore(query: string, doc: DocumentRecord): number {
  const qLower = query.toLowerCase();
  const titleLower = doc.title.toLowerCase();
  const textLower = doc.text.toLowerCase();

  let score = 0;

  // Count matches in text
  let idx = 0;
  while ((idx = textLower.indexOf(qLower, idx)) !== -1) {
    score += 1;
    idx += qLower.length || 1;
  }

  // Title match bonus: +2 so title-only hits still produce results
  if (titleLower.includes(qLower)) {
    score += 2;
  }

  return score;
}

function makeSnippet(query: string, text: string, maxLen = 150): string {
  const qLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const idx = textLower.indexOf(qLower);

  // Cut a window around the first match
  const half = Math.floor(maxLen / 2);
  let start: number;
  let end: number;

  if (idx >= 0) {
    start = Math.max(0, idx - half);
    end = Math.min(text.length, idx + qLower.length + half);
  } else {
    // Query not in text — show beginning of text
    start = 0;
    end = Math.min(text.length, maxLen);
  }

  let snippet = text.slice(start, end).replace(/\s+/g, " ").trim();

  // Add ellipsis
  if (start > 0) snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";

  return snippet;
}
