import * as fs from "fs";
import * as path from "path";
import { getDataDir } from "./documentRepository";

const FORBIDDEN_CHARS = /[\/\\\*\?]/;
const ALLOWED_EXTENSIONS = [".html", ".md", ".txt"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function safeReadFile(fname: string): string {
  // Reject empty
  if (!fname || fname.trim().length === 0) {
    throw new Error("readFile: fname must not be empty");
  }

  // Reject path traversal
  if (fname.includes("..")) {
    throw new Error("readFile: path traversal not allowed");
  }

  // Reject forbidden characters
  if (FORBIDDEN_CHARS.test(fname)) {
    throw new Error("readFile: only basename allowed, no path separators or glob");
  }

  // Reject disallowed extensions
  const ext = fname.slice(fname.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`readFile: extension not allowed: ${ext}`);
  }

  const dataDir = getDataDir();
  const resolved = path.resolve(dataDir, fname);

  // Must still be within dataDir
  if (!resolved.startsWith(dataDir + path.sep)) {
    throw new Error("readFile: access outside data/ not allowed");
  }

  // Must be a file, not a directory
  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolved);
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`readFile: file not found: ${fname}`);
    }
    throw e;
  }

  if (stat.isDirectory()) {
    throw new Error("readFile: cannot read a directory");
  }

  if (stat.size > MAX_FILE_SIZE) {
    throw new Error("readFile: file too large");
  }

  return fs.readFileSync(resolved, "utf-8");
}
