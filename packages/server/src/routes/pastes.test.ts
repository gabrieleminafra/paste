import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

describe("paste routes", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  describe("POST /api/pastes", () => {
    it("creates a paste and returns 201 with id", async () => {
      app = await buildApp({ logger: false });

      const response = await app.inject({
        method: "POST",
        url: "/api/pastes",
        payload: { content: "Hello, world!" },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.error).toBeNull();
      expect(body.data).toBeDefined();
      expect(body.data.id).toBeDefined();
      expect(typeof body.data.id).toBe("string");
      // Human-readable id: 4 lowercase words joined by hyphens.
      expect(body.data.id).toMatch(/^[a-z]+(-[a-z]+){3}$/);
    });

    it("returns 400 when content is missing", async () => {
      app = await buildApp({ logger: false });

      const response = await app.inject({
        method: "POST",
        url: "/api/pastes",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.data).toBeNull();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBe("Content is required");
    });

    it("returns 400 when content is empty string", async () => {
      app = await buildApp({ logger: false });

      const response = await app.inject({
        method: "POST",
        url: "/api/pastes",
        payload: { content: "" },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.data).toBeNull();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when content exceeds 1MB", async () => {
      app = await buildApp({ logger: false });

      const largeContent = "a".repeat(1_048_577);
      const response = await app.inject({
        method: "POST",
        url: "/api/pastes",
        payload: { content: largeContent },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.data).toBeNull();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBe("Content exceeds 1MB limit");
    });

    it("returns 400 when content is whitespace only", async () => {
      app = await buildApp({ logger: false });

      const response = await app.inject({
        method: "POST",
        url: "/api/pastes",
        payload: { content: "   \n\t  " },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.data).toBeNull();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when content is non-string type", async () => {
      app = await buildApp({ logger: false });

      const response = await app.inject({
        method: "POST",
        url: "/api/pastes",
        payload: { content: 12345 },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.data).toBeNull();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/pastes/:id", () => {
    it("retrieves a created paste", async () => {
      app = await buildApp({ logger: false });

      const createResponse = await app.inject({
        method: "POST",
        url: "/api/pastes",
        payload: { content: "Test paste content" },
      });

      const { id } = createResponse.json().data;

      const getResponse = await app.inject({
        method: "GET",
        url: `/api/pastes/${id}`,
      });

      expect(getResponse.statusCode).toBe(200);
      const body = getResponse.json();
      expect(body.error).toBeNull();
      expect(body.data.id).toBe(id);
      expect(body.data.content).toBe("Test paste content");
      expect(body.data.createdAt).toBeDefined();
      expect(body.data.updatedAt).toBeDefined();
    });

    it("returns 404 for non-existent paste", async () => {
      app = await buildApp({ logger: false });

      const response = await app.inject({
        method: "GET",
        url: "/api/pastes/moon-cat-river-fox", // valid word-id format, but not in DB
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.data).toBeNull();
      expect(body.error.code).toBe("PASTE_NOT_FOUND");
      expect(body.error.message).toBe("Paste not found");
    });

    it("returns 404 for invalid paste ID format", async () => {
      app = await buildApp({ logger: false });

      const response = await app.inject({
        method: "GET",
        url: "/api/pastes/invalid!",
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.data).toBeNull();
      expect(body.error.code).toBe("PASTE_NOT_FOUND");
    });
  });

  describe("rate limiting", () => {
    it("returns 429 in ApiResponse envelope when rate limit is exceeded", async () => {
      app = await buildApp({ logger: false });

      // Send requests sequentially to ensure deterministic rate limiting
      let rateLimitedResponse = null;
      for (let i = 0; i <= 10; i++) {
        const response = await app.inject({
          method: "POST",
          url: "/api/pastes",
          payload: { content: `Paste ${i}` },
        });
        if (response.statusCode === 429) {
          rateLimitedResponse = response;
          break;
        }
      }

      expect(rateLimitedResponse).not.toBeNull();
      const body = rateLimitedResponse!.json();
      expect(body.data).toBeNull();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("RATE_LIMITED");
    });
  });
});
