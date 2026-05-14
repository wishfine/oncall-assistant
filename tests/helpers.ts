import type { Request, Response } from "express";
import app from "../src/app";

/**
 * Call the Express app handler directly (no listen() to avoid sandbox issues).
 */
export function appRequest(
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

export function parseQuery(url: string): Record<string, string> {
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
