import type { FastifyPluginAsync } from "fastify";
import type { ApiResponse } from "shared";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/health", async () => {
    const response: ApiResponse<{ status: "ok" }> = {
      data: { status: "ok" },
      error: null,
    };
    return response;
  });
};
