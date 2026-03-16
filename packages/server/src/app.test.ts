import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";

describe("buildApp", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it("creates a valid Fastify instance", async () => {
    app = await buildApp({ logger: false });

    expect(app).toBeDefined();
    expect(app.server).toBeDefined();
    expect(typeof app.inject).toBe("function");
  });

  it("has the health route registered", async () => {
    app = await buildApp({ logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
  });

  it("wraps errors in ApiResponse envelope", async () => {
    app = await buildApp({ logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/api/nonexistent",
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});