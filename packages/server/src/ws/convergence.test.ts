import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { buildApp } from "../app.js";

const MESSAGE_SYNC = 0;

function applySyncMessage(data: Buffer | Uint8Array, doc: Y.Doc, ws?: { send: (data: Uint8Array) => void }) {
  const message = new Uint8Array(
    data instanceof ArrayBuffer ? data : (data as Buffer).buffer
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : data,
  );
  const decoder = decoding.createDecoder(message);
  const messageType = decoding.readVarUint(decoder);
  if (messageType === MESSAGE_SYNC) {
    const responseEncoder = encoding.createEncoder();
    encoding.writeVarUint(responseEncoder, MESSAGE_SYNC);
    syncProtocol.readSyncMessage(decoder, responseEncoder, doc, "remote");
    if (encoding.length(responseEncoder) > 1 && ws) {
      ws.send(encoding.toUint8Array(responseEncoder));
    }
  }
}

describe("end-to-end convergence", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  async function createPaste(content: string): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/pastes",
      payload: { content },
    });
    return res.json().data.id;
  }

  async function connectClient(pasteId: string) {
    const doc = new Y.Doc();
    let wsRef: { send: (data: Uint8Array) => void; terminate: () => void };

    const ws = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => {
        socket.on("message", (data: Buffer) => {
          applySyncMessage(data, doc, wsRef);
        });
      },
    });
    wsRef = ws;

    doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === "remote") return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      ws.send(encoding.toUint8Array(encoder));
    });

    await new Promise((r) => setTimeout(r, 150));

    return { ws, doc };
  }

  it("realistic editing session — two clients edit, merge, and converge", async () => {
    app = await buildApp({ logger: false });

    // Client A creates a paste via POST
    const pasteId = await createPaste("initial content");

    // Both clients connect via WS
    const clientA = await connectClient(pasteId);
    const clientB = await connectClient(pasteId);

    // Both should see initial content
    expect(clientA.doc.getText("content").toString()).toBe("initial content");
    expect(clientB.doc.getText("content").toString()).toBe("initial content");

    // Client A types "Hello " at start
    clientA.doc.getText("content").insert(0, "Hello ");

    // Client B types " World" at end (simultaneously)
    const textB = clientB.doc.getText("content");
    textB.insert(textB.length, " World");

    // Wait for sync
    await new Promise((r) => setTimeout(r, 300));

    // Verify both clients converge
    const stateA = clientA.doc.getText("content").toString();
    const stateB = clientB.doc.getText("content").toString();
    expect(stateA).toBe(stateB);
    expect(stateA).toContain("Hello ");
    expect(stateA).toContain(" World");
    expect(stateA).toContain("initial content");

    // Client A deletes "Hello " (first 6 chars)
    clientA.doc.getText("content").delete(0, 6);

    // Client B appends "!"
    const textB2 = clientB.doc.getText("content");
    textB2.insert(textB2.length, "!");

    await new Promise((r) => setTimeout(r, 300));

    // Verify convergence after second round
    const finalA = clientA.doc.getText("content").toString();
    const finalB = clientB.doc.getText("content").toString();
    expect(finalA).toBe(finalB);
    expect(finalA).toContain("!");
    // "Hello " should be deleted
    expect(finalA).not.toMatch(/^Hello /);

    clientA.ws.terminate();
    clientB.ws.terminate();
    clientA.doc.destroy();
    clientB.doc.destroy();
  });

  it("persistence after disconnect — new client sees latest state", async () => {
    app = await buildApp({ logger: false });

    const pasteId = await createPaste("persist me");

    const clientA = await connectClient(pasteId);
    const clientB = await connectClient(pasteId);

    // Both make edits
    clientA.doc.getText("content").insert(0, "AAA ");
    const textB = clientB.doc.getText("content");
    textB.insert(textB.length, " BBB");

    await new Promise((r) => setTimeout(r, 300));

    // Both should converge
    const stateA = clientA.doc.getText("content").toString();
    const stateB = clientB.doc.getText("content").toString();
    expect(stateA).toBe(stateB);

    // Both disconnect
    clientA.ws.terminate();
    clientB.ws.terminate();

    // Wait for persistence (DocumentManager debounce triggers on last disconnect)
    await new Promise((r) => setTimeout(r, 300));

    // A new client connects and should see the persisted state
    const clientC = await connectClient(pasteId);
    const stateC = clientC.doc.getText("content").toString();

    // Should contain edits from both A and B
    expect(stateC).toContain("AAA ");
    expect(stateC).toContain(" BBB");
    expect(stateC).toContain("persist me");

    clientC.ws.terminate();
    clientA.doc.destroy();
    clientB.doc.destroy();
    clientC.doc.destroy();
  });
});
