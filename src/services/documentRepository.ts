import * as fs from "fs";
import * as path from "path";
import { parseHtmlDocument } from "./htmlParser";
import type { DocumentRecord } from "../types";

const dataDir = path.resolve(__dirname, "..", "..", "data");

let documents = new Map<string, DocumentRecord>();

export function getDataDir(): string {
  return dataDir;
}

export function loadDocuments(): void {
  const files = fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith(".html"))
    .sort();

  for (const filename of files) {
    const filepath = path.join(dataDir, filename);
    const html = fs.readFileSync(filepath, "utf-8");
    const id = filename.replace(/\.html$/, "");
    const record = parseHtmlDocument(id, filename, html);
    documents.set(id, record);
  }
}

export function listDocuments(): DocumentRecord[] {
  return Array.from(documents.values());
}

export function getDocument(id: string): DocumentRecord | undefined {
  return documents.get(id);
}

export function upsertDocument(id: string, html: string): DocumentRecord {
  const filename = `${id}.html`;
  const record = parseHtmlDocument(id, filename, html);
  documents.set(id, record);
  return record;
}

export function resetDocuments(): void {
  documents.clear();
}
