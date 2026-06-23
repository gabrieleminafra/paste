import { createWriteStream } from "node:fs";
import { mkdir, rm, stat, rename } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

/**
 * Ensures the upload directory exists. Called once at startup.
 */
export async function ensureUploadDir(uploadDir: string): Promise<void> {
  await mkdir(uploadDir, { recursive: true });
}

/**
 * Absolute path on disk for a given file id. The id is validated by the route
 * layer (hyphen-joined words) so it is always a safe, flat filename.
 */
export function getFilePath(uploadDir: string, id: string): string {
  return path.join(uploadDir, id);
}

/**
 * Streams an uploaded file part to a randomly named temp file and returns its
 * name and byte size. Writing to a temp name (rather than straight to the id)
 * lets the caller reserve a unique id in the database before committing the
 * blob — so a colliding id can never clobber an existing file. On failure the
 * partial temp file is removed.
 */
export async function writeTempFile(
  uploadDir: string,
  source: Readable,
): Promise<{ tempName: string; size: number }> {
  const tempName = `.tmp-${randomBytes(12).toString("hex")}`;
  const destPath = path.join(uploadDir, tempName);
  try {
    await pipeline(source, createWriteStream(destPath));
    const { size } = await stat(destPath);
    return { tempName, size };
  } catch (err) {
    await rm(destPath, { force: true });
    throw err;
  }
}

/**
 * Atomically moves a temp file to its final id-keyed location.
 */
export async function commitFile(
  uploadDir: string,
  tempName: string,
  id: string,
): Promise<void> {
  await rename(path.join(uploadDir, tempName), getFilePath(uploadDir, id));
}

/**
 * Removes a stored file (or temp file) by name. Missing files are ignored so
 * callers can use this for best-effort cleanup.
 */
export async function deleteFile(uploadDir: string, name: string): Promise<void> {
  await rm(path.join(uploadDir, name), { force: true });
}
