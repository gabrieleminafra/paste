import { lt, inArray } from "drizzle-orm";
import type { FastifyPluginAsync, FastifyBaseLogger } from "fastify";
import { createDbClient, type Database } from "../db/client.js";
import { pastes, files } from "../db/schema.js";
import { deleteFile } from "../files/storage.js";

const DAY_MS = 86_400_000;

// How often the background sweep runs. TTLs are day-granular, so an hourly
// sweep is plenty responsive while keeping DB load negligible.
export const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export interface CleanupConfig {
  pasteTtlDays: number;
  fileTtlDays: number;
  uploadDir: string;
}

export interface CleanupResult {
  pastesDeleted: number;
  filesDeleted: number;
}

/**
 * Deletes pastes and files whose last activity is older than their configured
 * TTL. Expiry is measured from `updated_at`: pastes get a sliding window (an
 * actively edited paste keeps a fresh timestamp via persistence), while files
 * are immutable so it equals their upload time.
 *
 * For files, the on-disk blob is removed before the row so a crash mid-sweep
 * leaves a harmless orphan row (downloads already 404 on a missing blob)
 * rather than an unreferenced file the next sweep can never find.
 */
export async function runCleanup(
  db: Database,
  config: CleanupConfig,
  log: FastifyBaseLogger,
  now: Date = new Date(),
): Promise<CleanupResult> {
  const pasteCutoff = new Date(now.getTime() - config.pasteTtlDays * DAY_MS);
  const fileCutoff = new Date(now.getTime() - config.fileTtlDays * DAY_MS);

  const expiredFiles = await db
    .select({ id: files.id })
    .from(files)
    .where(lt(files.updatedAt, fileCutoff));

  let filesDeleted = 0;
  if (expiredFiles.length > 0) {
    const ids = expiredFiles.map((f) => f.id);
    const results = await Promise.allSettled(
      ids.map((id) => deleteFile(config.uploadDir, id)),
    );
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "rejected") {
        log.warn(
          { event: "cleanup.blob_delete_failed", fileId: ids[i], err: result.reason },
          "Failed to delete expired file blob",
        );
      }
    }
    await db.delete(files).where(inArray(files.id, ids));
    filesDeleted = ids.length;
  }

  const deletedPastes = await db
    .delete(pastes)
    .where(lt(pastes.updatedAt, pasteCutoff))
    .returning({ id: pastes.id });
  const pastesDeleted = deletedPastes.length;

  log.info(
    {
      event: "cleanup.completed",
      pastesDeleted,
      filesDeleted,
      pasteTtlDays: config.pasteTtlDays,
      fileTtlDays: config.fileTtlDays,
    },
    "TTL cleanup completed",
  );

  return { pastesDeleted, filesDeleted };
}

/**
 * Registers the TTL cleanup job: decorates the app with `runCleanup()` for
 * direct/testable invocation and, outside the test environment, runs one sweep
 * at startup plus a recurring sweep on CLEANUP_INTERVAL_MS.
 */
export const cleanupPlugin: FastifyPluginAsync = async (app) => {
  const { db, sql } = createDbClient(app.config.DATABASE_URL);

  const config: CleanupConfig = {
    pasteTtlDays: app.config.PASTE_TTL_DAYS,
    fileTtlDays: app.config.FILE_TTL_DAYS,
    uploadDir: app.config.UPLOAD_DIR,
  };

  const sweep = () =>
    runCleanup(db, config, app.log).catch((err) => {
      app.log.error({ event: "cleanup.failed", err }, "TTL cleanup failed");
    });

  app.decorate("runCleanup", () => runCleanup(db, config, app.log));

  let timer: ReturnType<typeof setInterval> | null = null;

  if (app.config.NODE_ENV !== "test") {
    app.log.info(
      {
        event: "cleanup.scheduled",
        intervalMs: CLEANUP_INTERVAL_MS,
        pasteTtlDays: config.pasteTtlDays,
        fileTtlDays: config.fileTtlDays,
      },
      "TTL cleanup scheduled",
    );

    // Sweep once shortly after the server is ready, then on the interval.
    app.addHook("onReady", async () => {
      await sweep();
    });

    timer = setInterval(sweep, CLEANUP_INTERVAL_MS);
    // Don't keep the process alive solely for the cleanup timer.
    timer.unref?.();
  }

  app.addHook("onClose", async () => {
    if (timer) clearInterval(timer);
    await sql.end();
  });
};

declare module "fastify" {
  interface FastifyInstance {
    runCleanup: () => Promise<CleanupResult>;
  }
}
