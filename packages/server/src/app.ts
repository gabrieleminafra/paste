import { fileURLToPath } from "node:url";
import path from "node:path";
import Fastify, { type FastifyError } from "fastify";
import fastifyEnv from "@fastify/env";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import type { ApiResponse, ErrorCode } from "shared";
import { envSchema } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { pasteRoutes } from "./routes/pastes.js";
import { fileRoutes, MAX_FILE_SIZE } from "./routes/files.js";
import { yjsHandler } from "./ws/yjs-handler.js";
import { cleanupPlugin } from "./cleanup/cleanup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function errorCodeFromStatus(statusCode: number): ErrorCode {
  if (statusCode === 404) return "NOT_FOUND";
  if (statusCode === 429) return "RATE_LIMITED";
  if (statusCode === 400) return "VALIDATION_ERROR";
  if (statusCode === 413) return "FILE_TOO_LARGE";
  return "INTERNAL_ERROR";
}

export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({
    logger:
      opts.logger === false
        ? false
        : { level: process.env.LOG_LEVEL ?? "info" },
  });

  await app.register(fastifyEnv, envSchema);
  await app.register(rateLimit);
  await app.register(websocket);
  await app.register(multipart, {
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  });

  app.register(healthRoutes);
  app.register(pasteRoutes);
  app.register(fileRoutes);
  app.register(yjsHandler);
  app.register(cleanupPlugin);

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

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const code = errorCodeFromStatus(statusCode);

    // Client errors (4xx) are expected operational events, not server faults —
    // log them at warn without a stack. Only 5xx are true errors worth a stack.
    if (statusCode >= 500) {
      request.log.error(
        { event: "request.failed", statusCode, code, err: error },
        error.message,
      );
    } else {
      request.log.warn(
        { event: "request.failed", statusCode, code },
        error.message,
      );
    }

    const response: ApiResponse<never> = {
      data: null,
      error: {
        message:
          statusCode >= 500 ? "Internal server error" : error.message,
        code,
      },
    };

    reply.status(statusCode).send(response);
  });

  return app;
}
