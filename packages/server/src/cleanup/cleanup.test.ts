import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile as fsWriteFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { inArray, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { FastifyBaseLogger } from "fastify";
import { createDbClient } from "../db/client.js";
import { pastes, files } from "../db/schema.js";
import { runCleanup } from "./cleanup.js";

const silentLog = {
  info() {},
  warn() {},
  error() {},
  debug() {},
} as unknown as FastifyBaseLogger;

const DAY = 86_400_000;
const NOW = new Date("2026-06-23T12:00:00.000Z");

describe("runCleanup", () => {
  let db: ReturnType<typeof createDbClient>["db"];
  let sql: ReturnType<typeof createDbClient>["sql"];
  let uploadDir: string;

  // Distinct ids so the suite never collides with other data.
  const expiredPaste = nanoid();
  const freshPaste = nanoid();
  const expiredFile = nanoid();
  const freshFile = nanoid();

  beforeAll(async () => {
    ({ db, sql } = createDbClient(process.env.DATABASE_URL!));
    uploadDir = await mkdtemp(path.join(tmpdir(), "pastebin-cleanup-"));

    await db.insert(pastes).values([
      { id: expiredPaste, content: Buffer.from("x"), updatedAt: new Date(NOW.getTime() - 31 * DAY) },
      { id: freshPaste, content: Buffer.from("x"), updatedAt: new Date(NOW.getTime() - 1 * DAY) },
    ]);

    await db.insert(files).values([
      { id: expiredFile, filename: "old.bin", mimeType: "application/octet-stream", size: 3, updatedAt: new Date(NOW.getTime() - 8 * DAY) },
      { id: freshFile, filename: "new.bin", mimeType: "application/octet-stream", size: 3, updatedAt: new Date(NOW.getTime() - 1 * DAY) },
    ]);

    await fsWriteFile(path.join(uploadDir, expiredFile), "old");
    await fsWriteFile(path.join(uploadDir, freshFile), "new");
  });

  afterAll(async () => {
    await db.delete(pastes).where(inArray(pastes.id, [expiredPaste, freshPaste]));
    await db.delete(files).where(inArray(files.id, [expiredFile, freshFile]));
    await rm(uploadDir, { recursive: true, force: true });
    await sql.end();
  });

  it("deletes content past its TTL and keeps fresh content", async () => {
    const result = await runCleanup(
      db,
      { pasteTtlDays: 30, fileTtlDays: 7, uploadDir },
      silentLog,
      NOW,
    );

    expect(result.pastesDeleted).toBeGreaterThanOrEqual(1);
    expect(result.filesDeleted).toBeGreaterThanOrEqual(1);

    const remainingPastes = await db
      .select({ id: pastes.id })
      .from(pastes)
      .where(inArray(pastes.id, [expiredPaste, freshPaste]));
    expect(remainingPastes.map((p) => p.id)).toEqual([freshPaste]);

    const remainingFiles = await db
      .select({ id: files.id })
      .from(files)
      .where(inArray(files.id, [expiredFile, freshFile]));
    expect(remainingFiles.map((f) => f.id)).toEqual([freshFile]);

    // Expired blob removed from disk; fresh blob untouched.
    await expect(readFile(path.join(uploadDir, expiredFile))).rejects.toThrow();
    expect(await readFile(path.join(uploadDir, freshFile), "utf-8")).toBe("new");
  });

  it("is a no-op when nothing has expired", async () => {
    // freshFile/freshPaste only; expired ones already gone from the prior test.
    const result = await runCleanup(
      db,
      { pasteTtlDays: 30, fileTtlDays: 7, uploadDir },
      silentLog,
      NOW,
    );

    const fresh = await db
      .select({ id: pastes.id })
      .from(pastes)
      .where(eq(pastes.id, freshPaste));
    expect(fresh).toHaveLength(1);
    expect(result.pastesDeleted).toBe(0);
    expect(result.filesDeleted).toBe(0);
  });
});
