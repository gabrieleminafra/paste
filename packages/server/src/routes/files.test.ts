import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

describe("file routes", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  describe("POST /api/files", () => {
    it("returns 400 when no file is provided", async () => {
      app = await buildApp({ logger: false });

      const response = await app.inject({
        method: "POST",
        url: "/api/files",
        headers: { "content-type": "application/json" },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.data).toBeNull();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/files/:id", () => {
    it("returns 404 for an id with an invalid format", async () => {
      app = await buildApp({ logger: false });

      const response = await app.inject({
        method: "GET",
        url: "/api/files/short", // not 4 hyphen-joined words
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.data).toBeNull();
      expect(body.error.code).toBe("FILE_NOT_FOUND");
    });
  });

  describe("GET /api/files/:id/download", () => {
    it("returns 404 for an id with an invalid format", async () => {
      app = await buildApp({ logger: false });

      const response = await app.inject({
        method: "GET",
        url: "/api/files/short/download",
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.data).toBeNull();
      expect(body.error.code).toBe("FILE_NOT_FOUND");
    });
  });
});
