import * as fs from "fs";
import * as path from "path";
import { getDataDir } from "./documentRepository";

const FORBIDDEN_CHARS = /[\/\\\*\?]/;

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

  const dataDir = getDataDir();
  const resolved = path.resolve(dataDir, fname);

  // Must still be within dataDir
  if (!resolved.startsWith(dataDir + path.sep)) {
    throw new Error("readFile: access outside data/ not allowed");
  }

  // Must be a file, not a directory
  try {
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      throw new Error("readFile: cannot read a directory");
    }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`readFile: file not found: ${fname}`);
    }
    throw e;
  }

  return fs.readFileSync(resolved, "utf-8");
}
