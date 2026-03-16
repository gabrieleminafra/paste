import Fastify, { type FastifyError } from "fastify";
import fastifyEnv from "@fastify/env";
import type { ApiResponse, ErrorCode } from "shared";
import { envSchema } from "./config.js";
import { healthRoutes } from "./routes/health.js";

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

  app.register(healthRoutes);

  app.setNotFoundHandler((_request, reply) => {
    const response: ApiResponse<never> = {
      data: null,
      error: {
        message: "Not found",
        code: "NOT_FOUND",
      },
    };
    reply.status(404).send(response);
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
