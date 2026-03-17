import * as Y from "yjs";

/**
 * Check if stored content looks like a Yjs update by inspecting the first byte.
 * Yjs updates start with a variable-length encoded struct count, which for
 * typical documents begins with a byte > 0. Legacy plain-text UTF-8 content
 * from Epic 1 will not match valid Yjs update structure.
 */
function isLikelyYjsUpdate(data: Uint8Array): boolean {
  if (data.length === 0) return false;
  try {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, data);
    // A valid Yjs update that decodes without error is considered Yjs data,
    // even if the text content happens to be empty (intentionally empty doc).
    doc.destroy();
    return true;
  } catch {
    return false;
  }
}

/**
 * Load a Yjs document from stored content, handling both Yjs binary state
 * and legacy plain-text content from Epic 1.
 */
export function loadYjsDoc(storedContent: Uint8Array): Y.Doc {
  const doc = new Y.Doc();

  if (storedContent.length === 0) {
    return doc;
  }

  if (isLikelyYjsUpdate(storedContent)) {
    Y.applyUpdate(doc, storedContent);
  } else {
    // Legacy plain-text content from Epic 1
    doc.getText("content").insert(
      0,
      Buffer.from(storedContent).toString("utf-8"),
    );
  }

  return doc;
}
