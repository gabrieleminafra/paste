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

describe("load test — 10 concurrent connections", () => {
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

    await new Promise((r) => setTimeout(r, 100));

    return { ws, doc };
  }

  it("10 clients each insert unique text — all 10 inserts present in final state", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("load-test");

    const CLIENT_COUNT = 10;
    const clients: { ws: { terminate: () => void }; doc: Y.Doc }[] = [];

    // Connect all 10 clients
    for (let i = 0; i < CLIENT_COUNT; i++) {
      clients.push(await connectClient(pasteId));
    }

    // Each client inserts a unique string
    const startTime = Date.now();
    for (let i = 0; i < CLIENT_COUNT; i++) {
      const text = clients[i].doc.getText("content");
      text.insert(text.length, `[user-${i}]`);
    }

    // Poll until all clients converge or timeout at 1 second (NFR3)
    const expected = CLIENT_COUNT;
    let converged = false;
    while (Date.now() - startTime < 1000) {
      await new Promise((r) => setTimeout(r, 50));
      const ref = clients[0].doc.getText("content").toString();
      const allMatch = clients.every((c) => c.doc.getText("content").toString() === ref);
      const allPresent = Array.from({ length: expected }, (_, i) => `[user-${i}]`).every((tag) => ref.includes(tag));
      if (allMatch && allPresent) {
        converged = true;
        break;
      }
    }

    const elapsed = Date.now() - startTime;

    // Verify all clients converge to identical state
    const states = clients.map((c) => c.doc.getText("content").toString());
    for (let i = 1; i < CLIENT_COUNT; i++) {
      expect(states[i]).toBe(states[0]);
    }

    // Verify all 10 inserts are present
    for (let i = 0; i < CLIENT_COUNT; i++) {
      expect(states[0]).toContain(`[user-${i}]`);
    }

    // Propagation must complete within 1 second (NFR3)
    expect(converged).toBe(true);
    expect(elapsed).toBeLessThan(1000);

    // Clean disconnect all clients
    for (const client of clients) {
      client.ws.terminate();
      client.doc.destroy();
    }
  });

  it("all 10 connections can cleanly disconnect without errors", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("disconnect test");

    const CLIENT_COUNT = 10;
    const clients: { ws: { terminate: () => void }; doc: Y.Doc }[] = [];

    for (let i = 0; i < CLIENT_COUNT; i++) {
      clients.push(await connectClient(pasteId));
    }

    // All clients disconnect
    for (const client of clients) {
      client.ws.terminate();
    }

    await new Promise((r) => setTimeout(r, 200));

    // Reconnecting should still work (doc manager cleaned up properly)
    const newClient = await connectClient(pasteId);
    expect(newClient.doc.getText("content").toString()).toBe("disconnect test");

    newClient.ws.terminate();
    newClient.doc.destroy();
    for (const client of clients) {
      client.doc.destroy();
    }
  });
});
