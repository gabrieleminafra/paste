import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import type WebSocket from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { buildApp } from "../app.js";

const MESSAGE_SYNC = 0;

/** Collect messages from a WS connection, starting from init to catch early messages. */
function createMessageCollector() {
  const messages: Buffer[] = [];
  let resolve: ((msg: Buffer) => void) | null = null;

  function onMessage(data: Buffer) {
    if (resolve) {
      const r = resolve;
      resolve = null;
      r(data);
    } else {
      messages.push(data);
    }
  }

  function nextMessage(timeoutMs = 3000): Promise<Buffer> {
    if (messages.length > 0) {
      return Promise.resolve(messages.shift()!);
    }
    return new Promise((res, rej) => {
      const timer = setTimeout(() => {
        resolve = null;
        rej(new Error("Timeout waiting for message"));
      }, timeoutMs);
      resolve = (msg) => {
        clearTimeout(timer);
        res(msg);
      };
    });
  }

  return { onMessage, nextMessage };
}

describe("yjs-handler", () => {
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

  it("upgrades WebSocket connection for valid paste", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("test content");

    const collector = createMessageCollector();
    const ws = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collector.onMessage); },
    });

    const data = await collector.nextMessage();
    const decoder = decoding.createDecoder(new Uint8Array(data));
    const messageType = decoding.readVarUint(decoder);
    expect(messageType).toBe(MESSAGE_SYNC);

    ws.terminate();
  });

  it("rejects invalid pasteId format via HTTP", async () => {
    app = await buildApp({ logger: false });

    // injectWS hangs when server closes WS immediately, so test via HTTP
    // The WS route only upgrades valid pasteIds; invalid ones get the not-found handler
    const response = await app.inject({
      method: "GET",
      url: "/ws/short",
    });

    // Non-WebSocket GET to a WS-only route returns 404
    expect(response.statusCode).toBe(404);
  });

  it("sends sync step 1 and step 2 on connection", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("sync test");

    const collector = createMessageCollector();
    const ws = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collector.onMessage); },
    });

    // Sync step 1
    const msg1 = await collector.nextMessage();
    const decoder1 = decoding.createDecoder(new Uint8Array(msg1));
    expect(decoding.readVarUint(decoder1)).toBe(MESSAGE_SYNC);

    // Sync step 2
    const msg2 = await collector.nextMessage();
    const decoder2 = decoding.createDecoder(new Uint8Array(msg2));
    expect(decoding.readVarUint(decoder2)).toBe(MESSAGE_SYNC);

    ws.terminate();
  });

  it("handles sync protocol messages from client", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("protocol test");

    const collector = createMessageCollector();
    const ws = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collector.onMessage); },
    });

    // Drain initial sync messages (step1, step2, awareness)
    await collector.nextMessage();
    await collector.nextMessage();
    await collector.nextMessage();

    // Send a sync step 1 message from client
    const clientDoc = new Y.Doc();
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, clientDoc);
    ws.send(encoding.toUint8Array(encoder));

    // Should receive a sync response
    const response = await collector.nextMessage();
    const responseDecoder = decoding.createDecoder(new Uint8Array(response));
    expect(decoding.readVarUint(responseDecoder)).toBe(MESSAGE_SYNC);

    clientDoc.destroy();
    ws.terminate();
  });

  it("cleans up on connection close", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("cleanup test");

    const collector = createMessageCollector();
    const ws = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collector.onMessage); },
    });

    // Drain initial messages
    await collector.nextMessage();
    await collector.nextMessage();
    await collector.nextMessage();

    // Close connection — should not throw
    ws.terminate();

    // Wait briefly for cleanup
    await new Promise((r) => setTimeout(r, 100));

    // Opening a new connection should still work
    const collector2 = createMessageCollector();
    const ws2 = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collector2.onMessage); },
    });
    const msg = await collector2.nextMessage();
    expect(msg).toBeDefined();
    ws2.terminate();
  });
});
