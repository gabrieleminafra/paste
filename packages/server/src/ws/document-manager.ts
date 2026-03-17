import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { pastes } from "../db/schema.js";
import { loadYjsDoc } from "./yjs-utils.js";

interface DocEntry {
  doc: Y.Doc;
  connections: Set<WebSocket>;
  saveTimeout: ReturnType<typeof setTimeout> | null;
  awareness: awarenessProtocol.Awareness;
}

export class DocumentManager {
  private docs = new Map<string, DocEntry>();
  private pending = new Map<string, Promise<{ doc: Y.Doc; awareness: awarenessProtocol.Awareness }>>();
  private PERSIST_DEBOUNCE_MS = 5000;

  constructor(private db: Database) {}

  async getOrCreateDoc(
    pasteId: string,
  ): Promise<{ doc: Y.Doc; awareness: awarenessProtocol.Awareness }> {
    const existing = this.docs.get(pasteId);
    if (existing) return { doc: existing.doc, awareness: existing.awareness };

    // Guard against concurrent loads for the same pasteId
    const inflight = this.pending.get(pasteId);
    if (inflight) return inflight;

    const promise = this.loadDoc(pasteId);
    this.pending.set(pasteId, promise);
    try {
      return await promise;
    } finally {
      this.pending.delete(pasteId);
    }
  }

  private async loadDoc(
    pasteId: string,
  ): Promise<{ doc: Y.Doc; awareness: awarenessProtocol.Awareness }> {
    // Re-check cache after awaiting (another caller may have populated it)
    const existing = this.docs.get(pasteId);
    if (existing) return { doc: existing.doc, awareness: existing.awareness };

    const result = await this.db
      .select()
      .from(pastes)
      .where(eq(pastes.id, pasteId))
      .limit(1);

    if (result.length === 0) {
      throw new Error("Paste not found");
    }

    const doc =
      result[0].content.length > 0
        ? loadYjsDoc(result[0].content)
        : new Y.Doc();

    const awareness = new awarenessProtocol.Awareness(doc);

    const entry: DocEntry = {
      doc,
      connections: new Set(),
      saveTimeout: null,
      awareness,
    };
    this.docs.set(pasteId, entry);

    doc.on("update", () => this.schedulePersist(pasteId));

    return { doc, awareness };
  }

  addConnection(pasteId: string, ws: WebSocket): void {
    const entry = this.docs.get(pasteId);
    if (entry) {
      entry.connections.add(ws);
    }
  }

  removeConnection(pasteId: string, ws: WebSocket): void {
    const entry = this.docs.get(pasteId);
    if (!entry) return;

    entry.connections.delete(ws);

    if (entry.connections.size === 0) {
      // Last connection — persist immediately and clean up
      if (entry.saveTimeout) {
        clearTimeout(entry.saveTimeout);
        entry.saveTimeout = null;
      }
      this.persistDoc(pasteId)
        .catch(() => {
          // Persist failed — still clean up to avoid memory leak
        })
        .finally(() => {
          entry.awareness.destroy();
          entry.doc.destroy();
          this.docs.delete(pasteId);
        });
    }
  }

  getConnections(pasteId: string): Set<WebSocket> | undefined {
    return this.docs.get(pasteId)?.connections;
  }

  private schedulePersist(pasteId: string): void {
    const entry = this.docs.get(pasteId);
    if (!entry) return;

    if (entry.saveTimeout) {
      clearTimeout(entry.saveTimeout);
    }

    entry.saveTimeout = setTimeout(() => {
      entry.saveTimeout = null;
      this.persistDoc(pasteId);
    }, this.PERSIST_DEBOUNCE_MS);
  }

  private async persistDoc(pasteId: string): Promise<void> {
    const entry = this.docs.get(pasteId);
    if (!entry) return;

    const content = Buffer.from(Y.encodeStateAsUpdate(entry.doc));
    await this.db
      .update(pastes)
      .set({ content, updatedAt: new Date() })
      .where(eq(pastes.id, pasteId));
  }

  async persistAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [pasteId, entry] of this.docs) {
      if (entry.saveTimeout) {
        clearTimeout(entry.saveTimeout);
        entry.saveTimeout = null;
      }
      promises.push(this.persistDoc(pasteId));
    }
    await Promise.all(promises);
  }
}
