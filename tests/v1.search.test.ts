import { describe, it, expect, beforeAll } from "vitest";
import app from "../src/app";
import { loadDocuments, resetDocuments } from "../src/services/documentRepository";
import type { Request, Response } from "express";

/**
 * Call the Express app handler directly (no listen() to avoid sandbox issues)
 */
function appRequest(
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  return new Promise((resolve) => {
    const headers: Record<string, string> = {};
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
      _headers: {} as Record<string, string>,
      json(data: unknown) {
        resolve({ status: this.statusCode, body: data, headers });
        return this;
      },
      send(data: string) {
        resolve({ status: this.statusCode, body: data, headers });
        return this;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader(name: string, value: string) {
        headers[name] = value;
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
    // decode %26 -> &, but keep empty string for q=&
    q[decodeURIComponent(k)] = v !== undefined ? decodeURIComponent(v || "") : "";
  }
  return q;
}

describe("v1 search", () => {
  beforeAll(() => {
    resetDocuments();
    loadDocuments();
  });

  it("returns sop-001 for OOM query", async () => {
    const { body } = await appRequest("GET", "/v1/search?q=OOM");
    const data = body as { results: { id: string }[] };
    const ids = data.results.map((r) => r.id);
    expect(ids).toContain("sop-001");
  });

  it("returns multiple docs for 故障", async () => {
    const { body } = await appRequest("GET", "/v1/search?q=故障");
    const data = body as { results: { id: string }[] };
    expect(data.results.length).toBeGreaterThan(1);
  });

  it("returns empty for replication (only in script)", async () => {
    const { body } = await appRequest("GET", "/v1/search?q=replication");
    const data = body as { results: unknown[] };
    expect(data.results).toHaveLength(0);
  });

  it("returns sop-003 and sop-010 for CDN", async () => {
    const { body } = await appRequest("GET", "/v1/search?q=CDN");
    const data = body as { results: { id: string }[] };
    const ids = data.results.map((r) => r.id);
    expect(ids).toContain("sop-003");
    expect(ids).toContain("sop-010");
  });

  it("searches & via %26", async () => {
    const { body } = await appRequest("GET", "/v1/search?q=%26");
    const data = body as { results: unknown[] };
    expect(data.results.length).toBeGreaterThan(0);
  });

  it("handles q=& as query for &", async () => {
    const { body } = await appRequest("GET", "/v1/search?q=&");
    const data = body as { results: unknown[] };
    expect(data.results.length).toBeGreaterThan(0);
  });

  it("case-insensitive: oom matches OOM", async () => {
    const { body } = await appRequest("GET", "/v1/search?q=oom");
    const data = body as { results: { id: string }[] };
    const ids = data.results.map((r) => r.id);
    expect(ids).toContain("sop-001");
  });

  it("snippet comes from visible text, not script", async () => {
    const { body } = await appRequest("GET", "/v1/search?q=OOM");
    const data = body as { results: { snippet: string }[] };
    for (const r of data.results) {
      expect(r.snippet).not.toMatch(/replicationLag/);
    }
  });

  it("returns empty for completely unmatched query", async () => {
    const { body } = await appRequest("GET", "/v1/search?q=xyzzy_nonexistent");
    const data = body as { results: unknown[] };
    expect(data.results).toHaveLength(0);
  });

  it("POST /v1/documents creates a document", async () => {
    const { status, body } = await appRequest("POST", "/v1/documents", {
      id: "test-sop",
      html: "<html><head><title>Test SOP</title></head><body><p>OOM test content</p></body></html>",
    });
    expect(status).toBe(201);
    const data = body as { id: string; title: string };
    expect(data.id).toBe("test-sop");
    expect(data.title).toContain("Test");
  });

  it("POST /v1/documents rejects missing fields", async () => {
    const { status } = await appRequest("POST", "/v1/documents", {});
    expect(status).toBe(400);
  });
});
