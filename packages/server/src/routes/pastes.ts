import type { FastifyPluginAsync } from "fastify";
import type { ApiResponse } from "shared";
import * as Y from "yjs";
import { eq } from "drizzle-orm";
import { createDbClient } from "../db/client.js";
import { pastes } from "../db/schema.js";
import { loadYjsDoc } from "../ws/yjs-utils.js";
import { ID_PATTERN, withUniqueId } from "../ids/generate.js";

const MAX_CONTENT_SIZE = 1_048_576; // 1MB

export const pasteRoutes: FastifyPluginAsync = async (app) => {
  const { db, sql } = createDbClient(app.config.DATABASE_URL);

  app.addHook("onClose", async () => {
    await sql.end();
  });

  app.post<{ Body: { content?: string } }>(
    "/api/pastes",
    {
      bodyLimit: 2_097_152, // 2MB to allow our validation to handle >1MB content
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const { content } = request.body ?? {};

      if (typeof content !== "string" || !content.trim()) {
        const response: ApiResponse<never> = {
          data: null,
          error: { message: "Content is required", code: "VALIDATION_ERROR" },
        };
        return reply.status(400).send(response);
      }

      const contentBytes = Buffer.from(content, "utf-8");

      if (contentBytes.length > MAX_CONTENT_SIZE) {
        request.log.warn(
          { event: "paste.rejected", reason: "too_large", size: contentBytes.length },
          "Paste rejected: content exceeds 1MB limit",
        );
        const response: ApiResponse<never> = {
          data: null,
          error: {
            message: "Content exceeds 1MB limit",
            code: "VALIDATION_ERROR",
          },
        };
        return reply.status(400).send(response);
      }

      // Store as Yjs binary state so document-manager can load it
      const doc = new Y.Doc();
      doc.getText("content").insert(0, content);
      const yState = Y.encodeStateAsUpdate(doc);
      doc.destroy();

      const id = await withUniqueId((candidate) =>
        db.insert(pastes).values({
          id: candidate,
          content: Buffer.from(yState),
        }),
      );

      request.log.info(
        { event: "paste.created", pasteId: id, size: contentBytes.length },
        "Paste created",
      );

      const response: ApiResponse<{ id: string }> = {
        data: { id },
        error: null,
      };
      return reply.status(201).send(response);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/pastes/:id",
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      if (!ID_PATTERN.test(id)) {
        const response: ApiResponse<never> = {
          data: null,
          error: { message: "Paste not found", code: "PASTE_NOT_FOUND" },
        };
        return reply.status(404).send(response);
      }

      const result = await db
        .select()
        .from(pastes)
        .where(eq(pastes.id, id))
        .limit(1);

      if (result.length === 0) {
        const response: ApiResponse<never> = {
          data: null,
          error: { message: "Paste not found", code: "PASTE_NOT_FOUND" },
        };
        return reply.status(404).send(response);
      }

      const paste = result[0];

      // Decode Yjs binary state; falls back to legacy plain text
      const doc = loadYjsDoc(paste.content);
      const textContent = doc.getText("content").toString();
      doc.destroy();

      request.log.debug({ event: "paste.viewed", pasteId: id }, "Paste viewed");

      const response: ApiResponse<{
        id: string;
        content: string;
        createdAt: string;
        updatedAt: string;
      }> = {
        data: {
          id: paste.id,
          content: textContent,
          createdAt: paste.createdAt.toISOString(),
          updatedAt: paste.updatedAt.toISOString(),
        },
        error: null,
      };
      return reply.status(200).send(response);
    },
  );
};
