import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import {
  ensureUploadDir,
  getFilePath,
  writeFile,
  deleteFile,
} from "./storage.js";

describe("file storage", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "pastebin-storage-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("ensureUploadDir creates the directory", async () => {
    const nested = path.join(dir, "a", "b");
    await ensureUploadDir(nested);
    // Writing into it should now succeed.
    const size = await writeFile(nested, "id123", Readable.from(["hi"]));
    expect(size).toBe(2);
  });

  it("getFilePath joins the id onto the upload dir", () => {
    expect(getFilePath(dir, "abc")).toBe(path.join(dir, "abc"));
  });

  it("writeFile streams content to disk and returns byte count", async () => {
    const content = "hello world";
    const size = await writeFile(dir, "myfile", Readable.from([content]));
    expect(size).toBe(Buffer.byteLength(content));
    const written = await readFile(getFilePath(dir, "myfile"), "utf-8");
    expect(written).toBe(content);
  });

  it("deleteFile removes a stored file and ignores missing files", async () => {
    await writeFile(dir, "gone", Readable.from(["data"]));
    await deleteFile(dir, "gone");
    await expect(readFile(getFilePath(dir, "gone"))).rejects.toThrow();
    // Deleting again does not throw.
    await expect(deleteFile(dir, "gone")).resolves.toBeUndefined();
  });

  it("writeFile cleans up the partial file when the source errors", async () => {
    const failing = new Readable({
      read() {
        this.destroy(new Error("boom"));
      },
    });
    await expect(writeFile(dir, "partial", failing)).rejects.toThrow();
    await expect(readFile(getFilePath(dir, "partial"))).rejects.toThrow();
  });
});
