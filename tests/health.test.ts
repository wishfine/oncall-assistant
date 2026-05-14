import { describe, it, expect } from "vitest";
import app from "../src/app";
import type { Request, Response } from "express";

describe("GET /health", () => {
  it("returns { ok: true } with 200", async () => {
    // Call the Express app handler directly without listening on a port
    const result = await new Promise<{ status: number; body: unknown }>(
      (resolve) => {
        const req = {
          method: "GET",
          url: "/health",
          headers: {},
        } as unknown as Request;

        const res = {
          statusCode: 200,
          _headers: {} as Record<string, string>,
          json(data: unknown) {
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
      },
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
  });
});
