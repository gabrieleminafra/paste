import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

describe("config route", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it("returns the configured TTL values", async () => {
    app = await buildApp({ logger: false });

    const response = await app.inject({ method: "GET", url: "/api/config" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.error).toBeNull();
    expect(typeof body.data.pasteTtlDays).toBe("number");
    expect(typeof body.data.fileTtlDays).toBe("number");
    // Defaults from config.ts when unset in the environment.
    expect(body.data.pasteTtlDays).toBe(30);
    expect(body.data.fileTtlDays).toBe(7);
  });
});
