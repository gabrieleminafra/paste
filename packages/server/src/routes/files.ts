import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { FastifyPluginAsync } from "fastify";
import type { ApiResponse, FileMeta } from "shared";
import { eq } from "drizzle-orm";
import { createDbClient } from "../db/client.js";
import { files } from "../db/schema.js";
import {
  commitFile,
  deleteFile,
  ensureUploadDir,
  getFilePath,
  writeTempFile,
} from "../files/storage.js";
import { ID_PATTERN, withUniqueId } from "../ids/generate.js";

export const MAX_FILE_SIZE = 52_428_800; // 50MB
const MAX_FILENAME_LENGTH = 255;

/**
 * Builds an RFC 5987 Content-Disposition header that survives non-ASCII
 * filenames. The plain `filename` is a sanitized ASCII fallback; `filename*`
 * carries the full UTF-8 name.
 */
function contentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export const fileRoutes: FastifyPluginAsync = async (app) => {
  const { db, sql } = createDbClient(app.config.DATABASE_URL);
  const uploadDir = app.config.UPLOAD_DIR;

  await ensureUploadDir(uploadDir);

  app.addHook("onClose", async () => {
    await sql.end();
  });

  app.post(
    "/api/files",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const missingFile: ApiResponse<never> = {
        data: null,
        error: { message: "File is required", code: "VALIDATION_ERROR" },
      };

      // request.file() throws when the request is not multipart/form-data.
      let data;
      try {
        data = await request.file();
      } catch {
        request.log.warn(
          { event: "file.rejected", reason: "invalid_content_type" },
          "File upload rejected: not multipart/form-data",
        );
        return reply.status(400).send(missingFile);
      }

      if (!data) {
        request.log.warn(
          { event: "file.rejected", reason: "missing" },
          "File upload rejected: no file part",
        );
        return reply.status(400).send(missingFile);
      }

      // Stream to a temp file first; the id is reserved in the DB before the
      // blob is committed to its final name (see writeTempFile).
      const { tempName, size } = await writeTempFile(uploadDir, data.file);

      // @fastify/multipart flags the stream as truncated when it exceeds the
      // configured fileSize limit; the partial write is discarded.
      if (data.file.truncated) {
        await deleteFile(uploadDir, tempName);
        request.log.warn(
          { event: "file.rejected", reason: "too_large" },
          "File upload rejected: exceeds 50MB limit",
        );
        const response: ApiResponse<never> = {
          data: null,
          error: {
            message: "File exceeds 50MB limit",
            code: "FILE_TOO_LARGE",
          },
        };
        return reply.status(413).send(response);
      }

      const filename = (data.filename || "file").slice(0, MAX_FILENAME_LENGTH);
      const mimeType = data.mimetype || "application/octet-stream";

      let id: string;
      try {
        id = await withUniqueId((candidate) =>
          db.insert(files).values({ id: candidate, filename, mimeType, size }),
        );
        await commitFile(uploadDir, tempName, id);
      } catch (err) {
        await deleteFile(uploadDir, tempName);
        throw err;
      }

      request.log.info(
        { event: "file.uploaded", fileId: id, filename, mimeType, size },
        "File uploaded",
      );

      const response: ApiResponse<{ id: string }> = {
        data: { id },
        error: null,
      };
      return reply.status(201).send(response);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/files/:id",
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
          error: { message: "File not found", code: "FILE_NOT_FOUND" },
        };
        return reply.status(404).send(response);
      }

      const result = await db
        .select()
        .from(files)
        .where(eq(files.id, id))
        .limit(1);

      if (result.length === 0) {
        const response: ApiResponse<never> = {
          data: null,
          error: { message: "File not found", code: "FILE_NOT_FOUND" },
        };
        return reply.status(404).send(response);
      }

      const file = result[0];
      const response: ApiResponse<FileMeta> = {
        data: {
          id: file.id,
          filename: file.filename,
          mimeType: file.mimeType,
          size: file.size,
          createdAt: file.createdAt.toISOString(),
          updatedAt: file.updatedAt.toISOString(),
        },
        error: null,
      };
      return reply.status(200).send(response);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/files/:id/download",
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

      const notFound: ApiResponse<never> = {
        data: null,
        error: { message: "File not found", code: "FILE_NOT_FOUND" },
      };

      if (!ID_PATTERN.test(id)) {
        return reply.status(404).send(notFound);
      }

      const result = await db
        .select()
        .from(files)
        .where(eq(files.id, id))
        .limit(1);

      if (result.length === 0) {
        return reply.status(404).send(notFound);
      }

      const file = result[0];
      const filePath = getFilePath(uploadDir, id);

      try {
        await stat(filePath);
      } catch {
        return reply.status(404).send(notFound);
      }

      request.log.info(
        { event: "file.downloaded", fileId: id, size: file.size },
        "File downloaded",
      );

      reply
        .header("Content-Type", file.mimeType)
        .header("Content-Length", file.size)
        .header("Content-Disposition", contentDisposition(file.filename));

      return reply.send(createReadStream(filePath));
    },
  );
};
