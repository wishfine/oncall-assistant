import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { parseHtmlDocument } from "../src/services/htmlParser";
import {
  loadDocuments,
  listDocuments,
  getDocument,
  resetDocuments,
} from "../src/services/documentRepository";

const dataDir = path.resolve(__dirname, "..", "data");

function readSop(filename: string): { id: string; filename: string; html: string } {
  const html = fs.readFileSync(path.join(dataDir, filename), "utf-8");
  return { id: filename.replace(/\.html$/, ""), filename, html };
}

describe("parseHtmlDocument", () => {
  it("extracts title from <title> tag", () => {
    const { id, filename, html } = readSop("sop-001.html");
    const doc = parseHtmlDocument(id, filename, html);
    expect(doc.title).toContain("后端服务");
    expect(doc.title).toBeTruthy();
  });

  it("removes script content from text", () => {
    const { id, filename, html } = readSop("sop-002.html");
    const doc = parseHtmlDocument(id, filename, html);
    expect(doc.text).not.toMatch(/replicationLag/);
  });

  it("removes style content from text", () => {
    const { id, filename, html } = readSop("sop-002.html");
    const doc = parseHtmlDocument(id, filename, html);
    expect(doc.text).not.toMatch(/sop-header/);
    expect(doc.text).not.toMatch(/background: linear-gradient/);
  });

  it("decodes HTML entities (sop-010: &amp; -> &)", () => {
    const { id, filename, html } = readSop("sop-010.html");
    const doc = parseHtmlDocument(id, filename, html);

    expect(doc.title).toBe("网络&CDN On-Call SOP");

    expect(doc.text).toContain("网络&CDN");
    expect(doc.text).not.toContain("&amp;");
    expect(doc.text).not.toContain("&comma;");
    expect(doc.text).not.toContain("&period;");
    expect(doc.text).not.toContain("&colon;");
  });

  it("handles bad HTML (sop-004: unclosed tags)", () => {
    const { id, filename, html } = readSop("sop-004.html");
    expect(() => parseHtmlDocument(id, filename, html)).not.toThrow();
    const doc = parseHtmlDocument(id, filename, html);
    expect(doc.title).toBeTruthy();
    expect(doc.text.length).toBeGreaterThan(100);
  });

  it("extracts text from deeply nested SOP (sop-005)", () => {
    const { id, filename, html } = readSop("sop-005.html");
    const doc = parseHtmlDocument(id, filename, html);
    expect(doc.title).toBeTruthy();
    expect(doc.text).toContain("安全");
    expect(doc.text.length).toBeGreaterThan(100);
  });

  it("extracts id, title, text fields", () => {
    const { id, filename, html } = readSop("sop-001.html");
    const doc = parseHtmlDocument(id, filename, html);
    expect(doc.id).toBe("sop-001");
    expect(doc.filename).toBe("sop-001.html");
    expect(doc.title).toBeTruthy();
    expect(doc.text).toBeTruthy();
  });
});

describe("documentRepository", () => {
  beforeAll(() => {
    resetDocuments();
    loadDocuments();
  });

  it("loads all 10 SOP documents", () => {
    const docs = listDocuments();
    expect(docs).toHaveLength(10);
  });

  it("each document has id, filename, title, text", () => {
    for (const doc of listDocuments()) {
      expect(doc.id).toBeTruthy();
      expect(doc.filename).toBeTruthy();
      expect(doc.title).toBeTruthy();
      expect(doc.text).toBeTruthy();
    }
  });

  it("getDocument returns correct document", () => {
    const doc = getDocument("sop-001");
    expect(doc).toBeDefined();
    expect(doc!.title).toContain("后端");
  });

  it("sop-002 text does not contain replicationLag", () => {
    const doc = getDocument("sop-002");
    expect(doc).toBeDefined();
    expect(doc!.text).not.toMatch(/replicationLag/);
  });

  it("sop-010 text contains decoded &", () => {
    const doc = getDocument("sop-010");
    expect(doc).toBeDefined();
    expect(doc!.text).toContain("网络&CDN");
  });

  it("sop-004 parsed without errors", () => {
    const doc = getDocument("sop-004");
    expect(doc).toBeDefined();
    expect(doc!.text.length).toBeGreaterThan(100);
  });

  it("upsertDocument adds or updates a document", () => {
    const html = "<html><head><title>Test</title></head><body><p>Hello world</p></body></html>";
    const doc = upsertDocument("test-doc", html);
    expect(doc.id).toBe("test-doc");
    expect(doc.title).toBe("Test");
    expect(doc.text).toContain("Hello world");

    const retrieved = getDocument("test-doc");
    expect(retrieved).toBeDefined();
    expect(retrieved!.title).toBe("Test");
  });
});
