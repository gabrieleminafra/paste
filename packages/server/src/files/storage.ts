import { createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
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
 * Absolute path on disk for a given file id. The id is a nanoid (validated by
 * the route layer) so it is always a safe, flat filename with no separators.
 */
export function getFilePath(uploadDir: string, id: string): string {
  return path.join(uploadDir, id);
}

/**
 * Streams an uploaded file part to disk. Returns the number of bytes written.
 * On any failure the partial file is removed so the directory never retains
 * truncated uploads.
 */
export async function writeFile(
  uploadDir: string,
  id: string,
  source: Readable,
): Promise<number> {
  const destPath = getFilePath(uploadDir, id);
  try {
    await pipeline(source, createWriteStream(destPath));
    const { size } = await stat(destPath);
    return size;
  } catch (err) {
    await deleteFile(uploadDir, id);
    throw err;
  }
}

/**
 * Removes a stored file. Missing files are ignored so callers can use this for
 * best-effort cleanup.
 */
export async function deleteFile(uploadDir: string, id: string): Promise<void> {
  await rm(getFilePath(uploadDir, id), { force: true });
}
