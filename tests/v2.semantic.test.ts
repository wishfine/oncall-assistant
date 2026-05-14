import { describe, it, expect, beforeAll } from "vitest";
import app from "../src/app";
import { loadDocuments, resetDocuments } from "../src/services/documentRepository";
import type { Request, Response } from "express";

function appRequest(
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve) => {
    const req = {
      method,
      url,
      headers: { "content-type": body ? "application/json" : undefined },
      body,
      originalUrl: url,
      query: parseQuery(url),
    } as unknown as Request;

    const res = {
      statusCode: 200,
      json(data: unknown) {
        resolve({ status: this.statusCode, body: data });
        return this;
      },
      send(data: string) {
        resolve({ status: this.statusCode, body: data });
        return this;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader() {
        return this;
      },
    } as unknown as Response;

    app(req, res);
  });
}

function parseQuery(url: string): Record<string, string> {
  const q: Record<string, string> = {};
  const idx = url.indexOf("?");
  if (idx === -1) return q;
  const search = url.slice(idx + 1);
  for (const part of search.split("&")) {
    const [k, v] = part.split("=");
    q[decodeURIComponent(k)] = v !== undefined ? decodeURIComponent(v || "") : "";
  }
  return q;
}

type Result = { id: string; title: string; snippet: string; score: number };

describe("v2 semantic search", () => {
  beforeAll(() => {
    resetDocuments();
    loadDocuments();
  });

  it("服务器挂了 returns sop-001 and sop-004 near top", async () => {
    const { body } = await appRequest("GET", "/v2/search?q=服务器挂了");
    const data = body as { results: Result[] };
    const top5 = data.results.slice(0, 5).map((r) => r.id);
    expect(top5).toContain("sop-001");
    expect(top5).toContain("sop-004");
  });

  it("黑客攻击 returns sop-005 at top", async () => {
    const { body } = await appRequest("GET", "/v2/search?q=黑客攻击");
    const data = body as { results: Result[] };
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results[0].id).toBe("sop-005");
  });

  it("机器学习模型出问题 returns sop-008 at top", async () => {
    const { body } = await appRequest("GET", "/v2/search?q=机器学习模型出问题");
    const data = body as { results: Result[] };
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results[0].id).toBe("sop-008");
  });

  it("returns empty for completely unrelated query", async () => {
    const { body } = await appRequest("GET", "/v2/search?q=xyzzy_nonexistent_12345");
    const data = body as { results: Result[] };
    expect(data.results).toHaveLength(0);
  });

  it("results have id, title, snippet, score", async () => {
    const { body } = await appRequest("GET", "/v2/search?q=服务器");
    const data = body as { results: Result[] };
    expect(data.results.length).toBeGreaterThan(0);
    for (const r of data.results) {
      expect(r.id).toBeTruthy();
      expect(r.title).toBeTruthy();
      expect(r.snippet).toBeTruthy();
      expect(typeof r.score).toBe("number");
    }
  });
});
