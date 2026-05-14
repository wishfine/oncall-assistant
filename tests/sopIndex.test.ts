import { describe, it, expect } from "vitest";
import { parseIndexKeywords } from "../src/services/agent";

/**
 * Build a mock sop-index.md with N SOP entries.
 */
function buildIndex(count: number): string {
  const lines: string[] = [];
  lines.push("# SOP Index");
  lines.push("");
  for (let i = 1; i <= count; i++) {
    const id = `sop-${String(i).padStart(3, "0")}`;
    lines.push(`## ${id}.html`);
    lines.push("");
    lines.push(`- **标题**：SOP ${i} 文档`);
    lines.push(`- **关键词**：关键词${i}A、关键词${i}B、kword${i}`);
    lines.push(`- **典型问题**：典型问题${i}、常见故障${i}`);
    lines.push("");
  }
  return lines.join("\n");
}

describe("parseIndexKeywords", () => {
  it("parses 10 SOP entries", () => {
    const content = buildIndex(10);
    const map = parseIndexKeywords(content);
    expect(map.size).toBe(10);
    expect(map.get("sop-001.html")?.length).toBeGreaterThan(0);
    expect(map.get("sop-010.html")?.length).toBeGreaterThan(0);
  });

  it("parses 100 SOP entries", () => {
    const content = buildIndex(100);
    const map = parseIndexKeywords(content);
    expect(map.size).toBe(100);
    // Spot check first, middle, last
    expect(map.get("sop-001.html")?.length).toBeGreaterThan(0);
    expect(map.get("sop-050.html")?.length).toBeGreaterThan(0);
    expect(map.get("sop-100.html")?.length).toBeGreaterThan(0);
  });

  it("parses 500 SOP entries", () => {
    const content = buildIndex(500);
    const map = parseIndexKeywords(content);
    expect(map.size).toBe(500);
  });

  it("extracts keywords and typical questions", () => {
    const content = buildIndex(1);
    const map = parseIndexKeywords(content);
    const keywords = map.get("sop-001.html")!;
    expect(keywords).toContain("关键词1A");
    expect(keywords).toContain("关键词1B");
    expect(keywords).toContain("kword1");
    expect(keywords).toContain("典型问题1");
    expect(keywords).toContain("常见故障1");
  });

  it("handles empty index gracefully", () => {
    const map = parseIndexKeywords("# Empty Index\n\nNo SOPs here.");
    expect(map.size).toBe(0);
  });
});
