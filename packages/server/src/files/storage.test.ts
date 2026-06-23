import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import {
  ensureUploadDir,
  getFilePath,
  writeTempFile,
  commitFile,
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
    const { size } = await writeTempFile(nested, Readable.from(["hi"]));
    expect(size).toBe(2);
  });

  it("getFilePath joins the id onto the upload dir", () => {
    expect(getFilePath(dir, "moon-cat-river-fox")).toBe(
      path.join(dir, "moon-cat-river-fox"),
    );
  });

  it("writeTempFile streams to a temp file and reports byte count", async () => {
    const content = "hello world";
    const { tempName, size } = await writeTempFile(
      dir,
      Readable.from([content]),
    );
    expect(size).toBe(Buffer.byteLength(content));
    expect(tempName.startsWith(".tmp-")).toBe(true);
    const written = await readFile(path.join(dir, tempName), "utf-8");
    expect(written).toBe(content);
  });

  it("commitFile moves a temp file to its id-keyed location", async () => {
    const { tempName } = await writeTempFile(dir, Readable.from(["payload"]));
    await commitFile(dir, tempName, "moon-cat-river-fox");

    const stored = await readFile(
      getFilePath(dir, "moon-cat-river-fox"),
      "utf-8",
    );
    expect(stored).toBe("payload");
    // Temp file no longer exists after the move.
    await expect(readFile(path.join(dir, tempName))).rejects.toThrow();
  });

  it("deleteFile removes a stored file and ignores missing files", async () => {
    const { tempName } = await writeTempFile(dir, Readable.from(["data"]));
    await commitFile(dir, tempName, "gone-gone-gone-gone");
    await deleteFile(dir, "gone-gone-gone-gone");
    await expect(
      readFile(getFilePath(dir, "gone-gone-gone-gone")),
    ).rejects.toThrow();
    // Deleting again does not throw.
    await expect(deleteFile(dir, "gone-gone-gone-gone")).resolves.toBeUndefined();
  });

  it("writeTempFile cleans up the partial file when the source errors", async () => {
    const failing = new Readable({
      read() {
        this.destroy(new Error("boom"));
      },
    });
    await expect(writeTempFile(dir, failing)).rejects.toThrow();
    // No temp files left behind.
    const { readdir } = await import("node:fs/promises");
    expect(await readdir(dir)).toHaveLength(0);
  });
});
