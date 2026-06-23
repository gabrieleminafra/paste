import type { FastifyPluginAsync } from "fastify";
import type { ApiResponse, AppConfig } from "shared";

/**
 * Exposes the runtime-configured values the client needs to display, so UI copy
 * (e.g. retention windows) stays in sync with the server env rather than being
 * hardcoded in the bundle.
 */
export const configRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/config", async () => {
    const response: ApiResponse<AppConfig> = {
      data: {
        pasteTtlDays: app.config.PASTE_TTL_DAYS,
        fileTtlDays: app.config.FILE_TTL_DAYS,
      },
      error: null,
    };
    return response;
  });
};
