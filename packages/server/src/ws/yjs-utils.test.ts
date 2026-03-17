import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { loadYjsDoc } from "./yjs-utils.js";

describe("loadYjsDoc", () => {
  it("loads valid Yjs binary state", () => {
    const sourceDoc = new Y.Doc();
    sourceDoc.getText("content").insert(0, "Hello Yjs");
    const encoded = Y.encodeStateAsUpdate(sourceDoc);
    sourceDoc.destroy();

    const doc = loadYjsDoc(encoded);
    expect(doc.getText("content").toString()).toBe("Hello Yjs");
    doc.destroy();
  });

  it("falls back to plain text for legacy content", () => {
    const legacy = Buffer.from("Plain text content", "utf-8");
    const doc = loadYjsDoc(legacy);
    expect(doc.getText("content").toString()).toBe("Plain text content");
    doc.destroy();
  });

  it("returns empty doc for empty input", () => {
    const doc = loadYjsDoc(new Uint8Array(0));
    expect(doc.getText("content").toString()).toBe("");
    doc.destroy();
  });

  it("preserves intentionally empty Yjs doc without false-positive fallback", () => {
    // Create a valid Yjs doc with empty text content
    const sourceDoc = new Y.Doc();
    sourceDoc.getText("content"); // access but don't insert
    const encoded = Y.encodeStateAsUpdate(sourceDoc);
    sourceDoc.destroy();

    const doc = loadYjsDoc(encoded);
    // Should remain empty — NOT treat Yjs binary as UTF-8 text
    expect(doc.getText("content").toString()).toBe("");
    doc.destroy();
  });
});
