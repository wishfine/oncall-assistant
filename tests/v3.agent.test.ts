import { describe, it, expect, beforeAll } from "vitest";
import { loadDocuments, resetDocuments } from "../src/services/documentRepository";
import { safeReadFile } from "../src/services/safeReadFile";
import { runAgent } from "../src/services/agent";
import type { AgentResponse } from "../src/types";
import { appRequest } from "./helpers";

describe("safeReadFile", () => {
  it("reads a valid SOP file", () => {
    const content = safeReadFile("sop-001.html");
    expect(content).toContain("<!DOCTYPE html>");
  });

  it("rejects empty fname", () => {
    expect(() => safeReadFile("")).toThrow();
    expect(() => safeReadFile("   ")).toThrow();
  });

  it("rejects path traversal", () => {
    expect(() => safeReadFile("../README.md")).toThrow();
    expect(() => safeReadFile("../../etc/passwd")).toThrow();
  });

  it("rejects absolute paths", () => {
    expect(() => safeReadFile("/etc/passwd")).toThrow();
  });

  it("rejects glob patterns", () => {
    expect(() => safeReadFile("*.html")).toThrow();
  });

  it("rejects directory access", () => {
    expect(() => safeReadFile(".")).toThrow();
  });

  it("rejects file not found", () => {
    expect(() => safeReadFile("nonexistent.html")).toThrow();
  });
});

describe("agent", () => {
  beforeAll(() => {
    resetDocuments();
    loadDocuments();
  });

  it("数据库主从延迟 routes to sop-002 as primary source", async () => {
    const result = await runAgent("数据库主从延迟超过30秒怎么处理？");
    expect(result.sources[0]).toBe("sop-002.html");
    expect(result.toolCalls.find((tc) => tc.args.fname === "sop-index.md")).toBeDefined();
    expect(result.answer).not.toMatch(/未找到/);
    expect(result.answer.length).toBeGreaterThan(100);
    const answer = result.answer.toLowerCase();
    const hasDbTerms =
      answer.includes("复制") ||
      answer.includes("延迟") ||
      answer.includes("主从") ||
      answer.includes("binlog") ||
      answer.includes("数据库");
    expect(hasDbTerms).toBe(true);
  });

  it("服务OOM routes to sop-001 as primary source", async () => {
    const result = await runAgent("服务 OOM 了怎么办？");
    expect(result.sources[0]).toBe("sop-001.html");
    expect(result.answer).not.toMatch(/未找到/);
    expect(result.answer.length).toBeGreaterThan(100);
  });

  it("P0故障 reads all core SOPs including network", async () => {
    const result = await runAgent("P0 故障的响应流程是什么？");
    expect(result.sources.length).toBeGreaterThanOrEqual(4);
    expect(result.sources).toContain("sop-001.html");
    expect(result.sources).toContain("sop-004.html");
    expect(result.sources).toContain("sop-010.html");
    expect(result.answer.length).toBeGreaterThan(100);
    const answer = result.answer;
    expect(answer.includes("升级") || answer.includes("P0") || answer.includes("响应")).toBe(true);
  });

  it("入侵 detection routes to sop-005 as primary source", async () => {
    const result = await runAgent("怀疑有人入侵了系统");
    expect(result.sources[0]).toBe("sop-005.html");
    expect(result.answer).not.toMatch(/未找到/);
    expect(result.answer.length).toBeGreaterThan(100);
    const answer = result.answer.toLowerCase();
    const hasSecTerms =
      answer.includes("安全") ||
      answer.includes("入侵") ||
      answer.includes("隔离") ||
      answer.includes("ddos") ||
      answer.includes("waf") ||
      answer.includes("siem");
    expect(hasSecTerms).toBe(true);
  });

  it("推荐质量下降 routes to sop-008 as primary source", async () => {
    const result = await runAgent("推荐结果质量下降了");
    expect(result.sources[0]).toBe("sop-008.html");
    expect(result.answer).not.toMatch(/未找到/);
    expect(result.answer.length).toBeGreaterThan(100);
    const answer = result.answer.toLowerCase();
    const hasModelTerms =
      answer.includes("模型") ||
      answer.includes("推荐") ||
      answer.includes("特征") ||
      answer.includes("ab实验") ||
      answer.includes("效果");
    expect(hasModelTerms).toBe(true);
  });

  it("generic intent fallback matches sop-index keywords", async () => {
    // A question that doesn't match any fixed intent but has keywords in sop-index
    const result = await runAgent("zookeeper集群故障怎么排查？");
    // "zookeeper" alone won't match any intent, but "集群" and "故障" appear
    // in sop-index sections (SRE/sop-004 and others)
    expect(result.toolCalls.length).toBeGreaterThan(0);
    expect(result.toolCalls[0].args.fname).toBe("sop-index.md");
    // Should at least have found some SOPs via sop-index keyword matching
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("toolCalls always start with readFile(sop-index.md)", async () => {
    const result = await runAgent("OOM");
    expect(result.toolCalls.length).toBeGreaterThan(0);
    expect(result.toolCalls[0].tool).toBe("readFile");
    expect(result.toolCalls[0].args.fname).toBe("sop-index.md");
  });

  it("answer is a non-empty string", async () => {
    const result = await runAgent("OOM");
    expect(result.answer).toBeTruthy();
    expect(typeof result.answer).toBe("string");
    expect(result.answer.length).toBeGreaterThan(20);
  });
});

describe("v3 API", () => {
  it("POST /v3/chat requires message", async () => {
    const { status } = await appRequest("POST", "/v3/chat", {});
    expect(status).toBe(400);
  });

  it("POST /v3/chat returns AgentResponse structure", async () => {
    const { status, body } = await appRequest("POST", "/v3/chat", {
      message: "OOM",
    });
    expect(status).toBe(200);
    const data = body as AgentResponse;
    expect(typeof data.answer).toBe("string");
    expect(Array.isArray(data.toolCalls)).toBe(true);
    expect(Array.isArray(data.sources)).toBe(true);
  });
});
