import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import { eq } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import type { Database } from "../db/client.js";
import { pastes } from "../db/schema.js";
import { loadYjsDoc } from "./yjs-utils.js";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

// A no-op logger so the manager can be constructed without one in tests.
const noopLogger = {
  debug() {},
  error() {},
} as unknown as FastifyBaseLogger;

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

  constructor(
    private db: Database,
    private log: FastifyBaseLogger = noopLogger,
  ) {}

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

    // Broadcast doc updates to every connection except the one that produced
    // them. Registered ONCE per doc — not per connection — so a single edit
    // fans out O(N) times, not O(N^2). The originating socket is passed as the
    // Yjs transaction origin (see yjs-handler) so we can skip it here; it has
    // already applied the change locally.
    doc.on("update", (update: Uint8Array, origin: unknown) => {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_SYNC);
      syncProtocol.writeUpdate(enc, update);
      this.broadcast(entry, encoding.toUint8Array(enc), origin);
    });

    awareness.on(
      "change",
      (
        {
          added,
          updated,
          removed,
        }: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
      ) => {
        const changed = added.concat(updated, removed);
        if (changed.length === 0) return;
        const enc = encoding.createEncoder();
        encoding.writeVarUint(enc, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(
          enc,
          awarenessProtocol.encodeAwarenessUpdate(awareness, changed),
        );
        this.broadcast(entry, encoding.toUint8Array(enc), origin);
      },
    );

    return { doc, awareness };
  }

  /** Sends a binary message to every live connection except `origin`. */
  private broadcast(entry: DocEntry, message: Uint8Array, origin: unknown): void {
    for (const conn of entry.connections) {
      if (conn === origin) continue;
      // readyState 1 === OPEN
      if ((conn as { readyState: number }).readyState === 1) {
        (conn as { send: (data: Uint8Array) => void }).send(message);
      }
    }
  }

  /** Adds a connection and returns the live connection count for the doc. */
  addConnection(pasteId: string, ws: WebSocket): number {
    const entry = this.docs.get(pasteId);
    if (!entry) return 0;
    entry.connections.add(ws);
    return entry.connections.size;
  }

  /** Removes a connection and returns the remaining connection count. */
  removeConnection(pasteId: string, ws: WebSocket): number {
    const entry = this.docs.get(pasteId);
    if (!entry) return 0;

    entry.connections.delete(ws);
    const remaining = entry.connections.size;

    if (remaining === 0) {
      // Last connection — persist immediately and clean up
      if (entry.saveTimeout) {
        clearTimeout(entry.saveTimeout);
        entry.saveTimeout = null;
      }
      // persistDoc logs its own failures; still clean up either way to avoid
      // leaking the in-memory doc.
      this.persistDoc(pasteId).finally(() => {
        entry.awareness.destroy();
        entry.doc.destroy();
        this.docs.delete(pasteId);
      });
    }

    return remaining;
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
    try {
      await this.db
        .update(pastes)
        .set({ content, updatedAt: new Date() })
        .where(eq(pastes.id, pasteId));
      this.log.debug(
        { event: "doc.persisted", pasteId, bytes: content.length },
        "Document persisted",
      );
    } catch (err) {
      this.log.error(
        { event: "doc.persist_failed", pasteId, err },
        "Failed to persist document",
      );
    }
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
