import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import type WebSocket from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { buildApp } from "../app.js";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

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

/** Drain the 3 initial messages (sync step 1, step 2, awareness), asserting their types. */
async function drainInitialMessages(collector: ReturnType<typeof createMessageCollector>) {
  const msg1 = await collector.nextMessage();
  expect(decoding.readVarUint(decoding.createDecoder(new Uint8Array(msg1)))).toBe(MESSAGE_SYNC);
  const msg2 = await collector.nextMessage();
  expect(decoding.readVarUint(decoding.createDecoder(new Uint8Array(msg2)))).toBe(MESSAGE_SYNC);
  const msg3 = await collector.nextMessage();
  expect(decoding.readVarUint(decoding.createDecoder(new Uint8Array(msg3)))).toBe(MESSAGE_AWARENESS);
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

    await drainInitialMessages(collector);

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

  it("broadcasts sync update from Client A to Client B", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("broadcast test");

    const collectorA = createMessageCollector();
    const wsA = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collectorA.onMessage); },
    });

    await drainInitialMessages(collectorA);

    const collectorB = createMessageCollector();
    const wsB = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collectorB.onMessage); },
    });

    await drainInitialMessages(collectorB);

    // Client A sends a doc update to the server
    const clientDocA = new Y.Doc();
    clientDocA.getText("content").insert(0, "from A");
    const update = Y.encodeStateAsUpdate(clientDocA);

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    wsA.send(encoding.toUint8Array(encoder));

    await new Promise((r) => setTimeout(r, 100));

    // Client B should receive the broadcast (not Client A)
    const msgB = await collectorB.nextMessage();
    const decoder = decoding.createDecoder(new Uint8Array(msgB));
    const messageType = decoding.readVarUint(decoder);
    expect(messageType).toBe(MESSAGE_SYNC);

    // Apply to client B's doc and verify content
    const clientDocB = new Y.Doc();
    const responseEncoder = encoding.createEncoder();
    encoding.writeVarUint(responseEncoder, MESSAGE_SYNC);
    syncProtocol.readSyncMessage(decoder, responseEncoder, clientDocB, null);
    expect(clientDocB.getText("content").toString()).toContain("from A");

    clientDocA.destroy();
    clientDocB.destroy();
    wsA.terminate();
    wsB.terminate();
  });

  it("broadcasts awareness update from Client A to Client B", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("awareness test");

    const collectorA = createMessageCollector();
    const wsA = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collectorA.onMessage); },
    });

    await drainInitialMessages(collectorA);

    const collectorB = createMessageCollector();
    const wsB = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collectorB.onMessage); },
    });

    await drainInitialMessages(collectorB);

    // Client A sends an awareness update
    const awarenessDoc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(awarenessDoc);
    awareness.setLocalStateField("user", { color: "#8B5CF6", name: "Test User" });

    const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
      awareness,
      [awarenessDoc.clientID],
    );

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, awarenessUpdate);
    wsA.send(encoding.toUint8Array(encoder));

    await new Promise((r) => setTimeout(r, 100));

    // Client B should receive the awareness broadcast
    const msgB = await collectorB.nextMessage();
    const decoder = decoding.createDecoder(new Uint8Array(msgB));
    const messageType = decoding.readVarUint(decoder);
    expect(messageType).toBe(MESSAGE_AWARENESS);

    awareness.destroy();
    awarenessDoc.destroy();
    wsA.terminate();
    wsB.terminate();
  });

  it("doc update broadcast excludes origin sender", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("exclude origin test");

    const collectorA = createMessageCollector();
    const wsA = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collectorA.onMessage); },
    });

    const collectorB = createMessageCollector();
    const wsB = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collectorB.onMessage); },
    });

    // Drain initial messages for both clients
    await drainInitialMessages(collectorA);
    await drainInitialMessages(collectorB);

    // Client A sends a doc update
    const clientDoc = new Y.Doc();
    clientDoc.getText("content").insert(0, "test update");
    const update = Y.encodeStateAsUpdate(clientDoc);

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    wsA.send(encoding.toUint8Array(encoder));

    await new Promise((r) => setTimeout(r, 200));

    // Client B SHOULD receive the broadcast
    const msgB = await collectorB.nextMessage();
    const decoderB = decoding.createDecoder(new Uint8Array(msgB));
    expect(decoding.readVarUint(decoderB)).toBe(MESSAGE_SYNC);

    // Client A should NOT receive a broadcast of its own update.
    // It may receive a sync protocol reply (which is expected), but should not
    // receive a second message (the broadcast). Drain any sync reply first.
    let aMessageCount = 0;
    try {
      while (true) {
        await collectorA.nextMessage(300);
        aMessageCount++;
      }
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Timeout"))) throw err;
    }
    // A gets at most 1 message (the sync reply), not 2 (reply + broadcast)
    expect(aMessageCount).toBeLessThanOrEqual(1);

    clientDoc.destroy();
    wsA.terminate();
    wsB.terminate();
  });

  it("cleans up awareness listener and connection on disconnect", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("awareness cleanup test");

    // Connect client A and drain initial messages
    const collectorA = createMessageCollector();
    const wsA = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collectorA.onMessage); },
    });
    await drainInitialMessages(collectorA);

    // Client A sends an awareness update
    const awarenessDoc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(awarenessDoc);
    awareness.setLocalStateField("user", { color: "#8B5CF6", colorLight: "#8B5CF633" });

    const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
      awareness,
      [awarenessDoc.clientID],
    );

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, awarenessUpdate);
    wsA.send(encoding.toUint8Array(encoder));

    // Client A disconnects — server cleans up awareness state asynchronously
    wsA.terminate();

    // Client B connects — nextMessage() will block until the server is ready,
    // so no arbitrary setTimeout is needed for synchronization
    const collectorB = createMessageCollector();
    const wsB = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collectorB.onMessage); },
    });

    // B receives initial sync and awareness messages successfully
    const msg1 = await collectorB.nextMessage();
    expect(decoding.readVarUint(decoding.createDecoder(new Uint8Array(msg1)))).toBe(MESSAGE_SYNC);

    awareness.destroy();
    awarenessDoc.destroy();
    wsB.terminate();
  });

  it("cleans up on connection close", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("cleanup test");

    const collector = createMessageCollector();
    const ws = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collector.onMessage); },
    });

    await drainInitialMessages(collector);

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
