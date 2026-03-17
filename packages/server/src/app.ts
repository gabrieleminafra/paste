import { fileURLToPath } from "node:url";
import path from "node:path";
import Fastify, { type FastifyError } from "fastify";
import fastifyEnv from "@fastify/env";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import type { ApiResponse, ErrorCode } from "shared";
import { envSchema } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { pasteRoutes } from "./routes/pastes.js";
import { yjsHandler } from "./ws/yjs-handler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function errorCodeFromStatus(statusCode: number): ErrorCode {
  if (statusCode === 404) return "NOT_FOUND";
  if (statusCode === 429) return "RATE_LIMITED";
  if (statusCode === 400) return "VALIDATION_ERROR";
  return "INTERNAL_ERROR";
}

export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({
    logger: opts.logger ?? true,
  });

  await app.register(fastifyEnv, envSchema);
  await app.register(rateLimit);
  await app.register(websocket);

  app.register(healthRoutes);
  app.register(pasteRoutes);
  app.register(yjsHandler);

  const serveStatic = process.env.NODE_ENV === "production";

  if (serveStatic) {
    await app.register(fastifyStatic, {
      root: path.join(__dirname, "../../client/dist"),
      prefix: "/",
      wildcard: false,
    });
  }

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/") || request.url.startsWith("/ws/")) {
      const response: ApiResponse<never> = {
        data: null,
        error: {
          message: "Not found",
          code: "NOT_FOUND",
        },
      };
      return reply.status(404).send(response);
    }
    if (serveStatic) {
      return reply.sendFile("index.html");
    }
    const response: ApiResponse<never> = {
      data: null,
      error: {
        message: "Not found",
        code: "NOT_FOUND",
      },
    };
    return reply.status(404).send(response);
  });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    app.log.error(error);

    const statusCode = error.statusCode ?? 500;
    const response: ApiResponse<never> = {
      data: null,
      error: {
        message:
          statusCode >= 500 ? "Internal server error" : error.message,
        code: errorCodeFromStatus(statusCode),
      },
    };

    reply.status(statusCode).send(response);
  });

  return app;
}
