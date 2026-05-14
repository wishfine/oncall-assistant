import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { loadDocuments, resetDocuments, getDataDir } from "../src/services/documentRepository";
import { appRequest } from "./helpers";

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

  it("POST /v1/documents creates and makes doc searchable", async () => {
    const uniqueWord = "flurbozax_test_" + Date.now();
    const { status, body } = await appRequest("POST", "/v1/documents", {
      id: "test-sop-upload",
      html: `<html><head><title>Test SOP</title></head><body><p>${uniqueWord} in body text</p></body></html>`,
    });
    expect(status).toBe(201);
    const data = body as { id: string; title: string };
    expect(data.id).toBe("test-sop-upload");
    expect(data.title).toContain("Test");

    // Verify the document is now searchable
    const search = await appRequest("GET", `/v1/search?q=${uniqueWord}`);
    const sdata = search.body as { results: { id: string }[] };
    const ids = sdata.results.map((r) => r.id);
    expect(ids).toContain("test-sop-upload");
  });

  it("POST /v1/documents rejects missing fields", async () => {
    const { status } = await appRequest("POST", "/v1/documents", {});
    expect(status).toBe(400);
  });
});

// Clean up any test artifacts written to data/
afterAll(() => {
  const testFile = path.join(getDataDir(), "test-sop-upload.html");
  try { fs.unlinkSync(testFile); } catch { /* ok */ }
});
