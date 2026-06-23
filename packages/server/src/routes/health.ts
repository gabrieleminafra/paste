import type { FastifyPluginAsync } from "fastify";
import type { ApiResponse } from "shared";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // Uptime monitors hit this constantly; keep successful probes out of the
  // request log (errors still surface at warn).
  app.get("/api/health", { logLevel: "warn" }, async () => {
    const response: ApiResponse<{ status: "ok" }> = {
      data: { status: "ok" },
      error: null,
    };
    return response;
  });
};
