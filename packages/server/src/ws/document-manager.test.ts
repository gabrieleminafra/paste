import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Y from "yjs";
import { DocumentManager } from "./document-manager.js";

// Mock db
function createMockDb(rows: Array<{ id: string; content: Uint8Array }> = []) {
  const mockUpdate = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };

  const mockSelect = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };

  const db = {
    select: vi.fn().mockReturnValue(mockSelect),
    update: vi.fn().mockReturnValue(mockUpdate),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    _mockSelect: mockSelect,
    _mockUpdate: mockUpdate,
  };

  return db as unknown as ReturnType<typeof createMockDb>;
}

type MockDb = ReturnType<typeof createMockDb>;

describe("DocumentManager", () => {
  let manager: DocumentManager;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.useFakeTimers();
    mockDb = createMockDb();
    manager = new DocumentManager(mockDb as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws when paste does not exist in database", async () => {
    await expect(manager.getOrCreateDoc("paste-1")).rejects.toThrow(
      "Paste not found",
    );
  });

  it("creates empty doc when paste has empty stored content", async () => {
    const dbWithEmpty = createMockDb([
      { id: "paste-1e", content: new Uint8Array(0) },
    ]);
    const mgr = new DocumentManager(dbWithEmpty as never);

    const { doc } = await mgr.getOrCreateDoc("paste-1e");
    expect(doc).toBeInstanceOf(Y.Doc);
    expect(doc.getText("content").toString()).toBe("");
  });

  it("loads existing Yjs state from database", async () => {
    // Create a Yjs doc with content and encode it
    const sourceDoc = new Y.Doc();
    sourceDoc.getText("content").insert(0, "Hello Yjs");
    const encoded = Y.encodeStateAsUpdate(sourceDoc);
    sourceDoc.destroy();

    const dbWithContent = createMockDb([{ id: "paste-2", content: encoded }]);
    const mgr = new DocumentManager(dbWithContent as never);

    const { doc } = await mgr.getOrCreateDoc("paste-2");
    expect(doc.getText("content").toString()).toBe("Hello Yjs");
  });

  it("handles legacy plain-text content (backward compat)", async () => {
    const legacyContent = Buffer.from("Legacy plain text", "utf-8");
    const dbWithLegacy = createMockDb([
      { id: "paste-3", content: legacyContent },
    ]);
    const mgr = new DocumentManager(dbWithLegacy as never);

    const { doc } = await mgr.getOrCreateDoc("paste-3");
    expect(doc.getText("content").toString()).toBe("Legacy plain text");
  });

  it("returns cached doc on second call for same pasteId", async () => {
    const dbWithContent = createMockDb([
      { id: "paste-4", content: new Uint8Array(0) },
    ]);
    const mgr = new DocumentManager(dbWithContent as never);

    const { doc: doc1 } = await mgr.getOrCreateDoc("paste-4");
    const { doc: doc2 } = await mgr.getOrCreateDoc("paste-4");

    expect(doc1).toBe(doc2);
  });

  it("deduplicates concurrent getOrCreateDoc calls for the same pasteId", async () => {
    const sourceDoc = new Y.Doc();
    sourceDoc.getText("content").insert(0, "concurrent");
    const encoded = Y.encodeStateAsUpdate(sourceDoc);
    sourceDoc.destroy();

    const dbWithContent = createMockDb([
      { id: "paste-4c", content: encoded },
    ]);
    const mgr = new DocumentManager(dbWithContent as never);

    const [result1, result2] = await Promise.all([
      mgr.getOrCreateDoc("paste-4c"),
      mgr.getOrCreateDoc("paste-4c"),
    ]);

    expect(result1.doc).toBe(result2.doc);
    // DB should only have been queried once
    expect(dbWithContent.select).toHaveBeenCalledTimes(1);
  });

  it("triggers debounced persistence after 5s of inactivity", async () => {
    const dbWith5 = createMockDb([{ id: "paste-5", content: new Uint8Array(0) }]);
    const mgr5 = new DocumentManager(dbWith5 as never);
    const { doc } = await mgr5.getOrCreateDoc("paste-5");

    // Trigger an update
    doc.getText("content").insert(0, "change");

    // Should NOT have persisted yet
    expect((dbWith5 as any)._mockUpdate.set).not.toHaveBeenCalled();

    // Advance timers by 5 seconds
    await vi.advanceTimersByTimeAsync(5000);

    // Should have persisted
    expect((dbWith5 as any).update).toHaveBeenCalled();
  });

  it("resets debounce timer on subsequent updates", async () => {
    const dbWith6 = createMockDb([{ id: "paste-6", content: new Uint8Array(0) }]);
    const mgr6 = new DocumentManager(dbWith6 as never);
    const { doc } = await mgr6.getOrCreateDoc("paste-6");

    doc.getText("content").insert(0, "first");
    await vi.advanceTimersByTimeAsync(3000);

    // Another edit resets the timer
    doc.getText("content").insert(5, " second");
    await vi.advanceTimersByTimeAsync(3000);

    // Only 3s since last edit — should not have persisted yet
    expect((dbWith6 as any)._mockUpdate.set).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000);

    // Now 5s since last edit — should have persisted
    expect((dbWith6 as any).update).toHaveBeenCalled();
  });

  it("persists immediately on last client disconnect and cleans up", async () => {
    const dbWith7 = createMockDb([{ id: "paste-7", content: new Uint8Array(0) }]);
    const mgr7 = new DocumentManager(dbWith7 as never);
    const { doc } = await mgr7.getOrCreateDoc("paste-7");
    const mockWs = {} as WebSocket;
    mgr7.addConnection("paste-7", mockWs);

    doc.getText("content").insert(0, "some content");

    mgr7.removeConnection("paste-7", mockWs);

    // Should have persisted immediately (no debounce timer)
    // Use a microtask tick for the promise to resolve
    await vi.advanceTimersByTimeAsync(0);

    expect((dbWith7 as any).update).toHaveBeenCalled();

    // In-memory doc should be cleaned up (subsequent call creates new doc)
    const connections = mgr7.getConnections("paste-7");
    expect(connections).toBeUndefined();
  });

  it("does not clean up when other connections remain", async () => {
    const dbWith8 = createMockDb([{ id: "paste-8", content: new Uint8Array(0) }]);
    const mgr8 = new DocumentManager(dbWith8 as never);
    await mgr8.getOrCreateDoc("paste-8");
    const ws1 = {} as WebSocket;
    const ws2 = {} as WebSocket;
    mgr8.addConnection("paste-8", ws1);
    mgr8.addConnection("paste-8", ws2);

    mgr8.removeConnection("paste-8", ws1);

    const connections = mgr8.getConnections("paste-8");
    expect(connections).toBeDefined();
    expect(connections!.size).toBe(1);
  });

  it("persistAll persists all in-memory docs", async () => {
    const dbWithAB = createMockDb([
      { id: "paste-a", content: new Uint8Array(0) },
    ]);
    // Override limit to return different rows per call
    let callCount = 0;
    (dbWithAB as any)._mockSelect.limit.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return [{ id: "paste-a", content: new Uint8Array(0) }];
      return [{ id: "paste-b", content: new Uint8Array(0) }];
    });
    const mgrAB = new DocumentManager(dbWithAB as never);

    await mgrAB.getOrCreateDoc("paste-a");
    await mgrAB.getOrCreateDoc("paste-b");

    await mgrAB.persistAll();

    // update should have been called twice
    expect((dbWithAB as any).update).toHaveBeenCalledTimes(2);
  });
});
