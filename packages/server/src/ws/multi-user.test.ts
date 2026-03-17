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

describe("multi-user convergence", () => {
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

  /**
   * Connect a client with bidirectional sync:
   * - Server messages are applied to client doc automatically
   * - Client doc updates are forwarded to server via WS
   */
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

    // Set up client-to-server sync: when client doc changes, send update to server
    doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === "remote") return; // Don't echo back server updates
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      ws.send(encoding.toUint8Array(encoder));
    });

    // Wait for initial sync to complete
    await new Promise((r) => setTimeout(r, 150));

    return { ws, doc };
  }

  it("two clients connect and converge to identical state", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("initial");

    const client1 = await connectClient(pasteId);
    const client2 = await connectClient(pasteId);

    // Both should have initial content
    expect(client1.doc.getText("content").toString()).toBe("initial");
    expect(client2.doc.getText("content").toString()).toBe("initial");

    // Client 1 inserts text
    client1.doc.getText("content").insert(0, "Hello ");

    // Wait for propagation
    await new Promise((r) => setTimeout(r, 200));

    expect(client2.doc.getText("content").toString()).toContain("Hello ");

    // Client 2 inserts text
    const text2 = client2.doc.getText("content");
    text2.insert(text2.length, " World");

    await new Promise((r) => setTimeout(r, 200));

    // Both should converge to identical state
    const state1 = client1.doc.getText("content").toString();
    const state2 = client2.doc.getText("content").toString();
    expect(state1).toBe(state2);
    expect(state1).toContain("Hello ");
    expect(state1).toContain(" World");

    client1.ws.terminate();
    client2.ws.terminate();
    client1.doc.destroy();
    client2.doc.destroy();
  });

  it("client A inserts at position 0, client B inserts at end — both preserved", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("middle");

    const client1 = await connectClient(pasteId);
    const client2 = await connectClient(pasteId);

    expect(client1.doc.getText("content").toString()).toBe("middle");
    expect(client2.doc.getText("content").toString()).toBe("middle");

    // Client A inserts at position 0, Client B inserts at end (simultaneously)
    client1.doc.getText("content").insert(0, "start-");
    const text2 = client2.doc.getText("content");
    text2.insert(text2.length, "-end");

    // Wait for propagation
    await new Promise((r) => setTimeout(r, 300));

    const state1 = client1.doc.getText("content").toString();
    const state2 = client2.doc.getText("content").toString();

    // Both must converge
    expect(state1).toBe(state2);

    // Both insertions preserved
    expect(state1).toContain("start-");
    expect(state1).toContain("-end");
    expect(state1).toContain("middle");

    client1.ws.terminate();
    client2.ws.terminate();
    client1.doc.destroy();
    client2.doc.destroy();
  });

  it("two clients edit the same line — both edits present, deterministic order", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("line");

    const client1 = await connectClient(pasteId);
    const client2 = await connectClient(pasteId);

    // Both insert at position 0 (concurrent)
    client1.doc.getText("content").insert(0, "AAA");
    client2.doc.getText("content").insert(0, "BBB");

    await new Promise((r) => setTimeout(r, 300));

    const state1 = client1.doc.getText("content").toString();
    const state2 = client2.doc.getText("content").toString();

    // Both must converge to identical state
    expect(state1).toBe(state2);

    // Both edits must be present
    expect(state1).toContain("AAA");
    expect(state1).toContain("BBB");
    expect(state1).toContain("line");

    client1.ws.terminate();
    client2.ws.terminate();
    client1.doc.destroy();
    client2.doc.destroy();
  });

  it("rapid sequential edits from multiple clients converge", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("base");

    const client1 = await connectClient(pasteId);
    const client2 = await connectClient(pasteId);

    // Rapid edits from client 1
    for (let i = 0; i < 5; i++) {
      const text = client1.doc.getText("content");
      text.insert(text.length, ` A${i}`);
    }

    // Rapid edits from client 2
    for (let i = 0; i < 5; i++) {
      const text = client2.doc.getText("content");
      text.insert(text.length, ` B${i}`);
    }

    // Allow all messages to propagate
    await new Promise((r) => setTimeout(r, 500));

    const state1 = client1.doc.getText("content").toString();
    const state2 = client2.doc.getText("content").toString();

    // Both must converge
    expect(state1).toBe(state2);

    // All edits from both clients must be present
    for (let i = 0; i < 5; i++) {
      expect(state1).toContain(`A${i}`);
      expect(state1).toContain(`B${i}`);
    }

    client1.ws.terminate();
    client2.ws.terminate();
    client1.doc.destroy();
    client2.doc.destroy();
  });
});
