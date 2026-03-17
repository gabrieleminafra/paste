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

  it("cleans up awareness state on disconnect so new clients do not see stale presence", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("awareness cleanup broadcast test");

    // Client A connects and sends awareness update
    const collectorA = createMessageCollector();
    const wsA = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collectorA.onMessage); },
    });
    await drainInitialMessages(collectorA);

    const awarenessDoc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(awarenessDoc);
    awareness.setLocalStateField("user", { color: "#8B5CF6", name: "User A" });

    const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
      awareness,
      [awarenessDoc.clientID],
    );

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, awarenessUpdate);
    wsA.send(encoding.toUint8Array(encoder));

    await new Promise((r) => setTimeout(r, 100));

    // Client A disconnects — server removes awareness state
    wsA.terminate();
    await new Promise((r) => setTimeout(r, 200));

    // Client B connects — should NOT receive stale awareness from disconnected A
    const collectorB = createMessageCollector();
    const wsB = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collectorB.onMessage); },
    });

    // Drain sync messages
    const syncMsg1 = await collectorB.nextMessage();
    expect(decoding.readVarUint(decoding.createDecoder(new Uint8Array(syncMsg1)))).toBe(MESSAGE_SYNC);
    const syncMsg2 = await collectorB.nextMessage();
    expect(decoding.readVarUint(decoding.createDecoder(new Uint8Array(syncMsg2)))).toBe(MESSAGE_SYNC);

    // The awareness message should have no client states (A's was cleaned up)
    const awarenessMsg = await collectorB.nextMessage();
    const awarenessDecoder = decoding.createDecoder(new Uint8Array(awarenessMsg));
    expect(decoding.readVarUint(awarenessDecoder)).toBe(MESSAGE_AWARENESS);
    const awarenessData = decoding.readVarUint8Array(awarenessDecoder);

    // Apply to a fresh awareness instance and verify no stale states
    const clientDoc = new Y.Doc();
    const clientAwareness = new awarenessProtocol.Awareness(clientDoc);
    awarenessProtocol.applyAwarenessUpdate(clientAwareness, awarenessData, null);

    // No stale User A presence should exist
    const states = clientAwareness.getStates();
    for (const [, state] of states) {
      expect(state.user?.name).not.toBe("User A");
    }
    // Verify no unexpected client states were received (only the local client's empty state)
    const nonLocalStates = Array.from(states.entries()).filter(
      ([id]) => id !== clientDoc.clientID,
    );
    expect(nonLocalStates).toHaveLength(0);

    awareness.destroy();
    awarenessDoc.destroy();
    clientAwareness.destroy();
    clientDoc.destroy();
    wsB.terminate();
  });

  it("client reconnects after server restart and receives persisted state", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("restart test");

    // Client connects and sends edits
    const collector1 = createMessageCollector();
    const ws1 = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collector1.onMessage); },
    });
    await drainInitialMessages(collector1);

    const clientDoc1 = new Y.Doc();
    clientDoc1.getText("content").insert(0, "persisted content");
    const update = Y.encodeStateAsUpdate(clientDoc1);

    const encoder1 = encoding.createEncoder();
    encoding.writeVarUint(encoder1, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder1, update);
    ws1.send(encoding.toUint8Array(encoder1));

    await new Promise((r) => setTimeout(r, 100));

    // Client disconnects — server persists and cleans up in-memory doc
    ws1.terminate();
    await new Promise((r) => setTimeout(r, 200));

    // Client "reconnects" (simulating after server restart — doc must be loaded from DB)
    const collector2 = createMessageCollector();
    const ws2 = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collector2.onMessage); },
    });

    // Drain sync step 1
    const msg1 = await collector2.nextMessage();
    expect(decoding.readVarUint(decoding.createDecoder(new Uint8Array(msg1)))).toBe(MESSAGE_SYNC);

    // Sync step 2 should contain the persisted content
    const msg2 = await collector2.nextMessage();
    const decoder2 = decoding.createDecoder(new Uint8Array(msg2));
    expect(decoding.readVarUint(decoder2)).toBe(MESSAGE_SYNC);

    // Apply to a fresh doc
    const reconnectedDoc = new Y.Doc();
    const respEncoder = encoding.createEncoder();
    encoding.writeVarUint(respEncoder, MESSAGE_SYNC);
    syncProtocol.readSyncMessage(decoder2, respEncoder, reconnectedDoc, null);

    // Complete sync by sending sync step 1
    const syncEncoder = encoding.createEncoder();
    encoding.writeVarUint(syncEncoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(syncEncoder, reconnectedDoc);
    ws2.send(encoding.toUint8Array(syncEncoder));

    try {
      const msg3 = await collector2.nextMessage(1000);
      const decoder3 = decoding.createDecoder(new Uint8Array(msg3));
      const msgType = decoding.readVarUint(decoder3);
      if (msgType === MESSAGE_SYNC) {
        const respEncoder3 = encoding.createEncoder();
        encoding.writeVarUint(respEncoder3, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder3, respEncoder3, reconnectedDoc, null);
      }
    } catch {
      // Timeout is fine
    }

    const content = reconnectedDoc.getText("content").toString();
    expect(content).toContain("persisted content");

    clientDoc1.destroy();
    reconnectedDoc.destroy();
    ws2.terminate();
  });

  it("reconnecting client receives missed edits from other clients", async () => {
    app = await buildApp({ logger: false });
    const pasteId = await createPaste("reconnect test");

    // Client A connects and sends edits
    const collectorA = createMessageCollector();
    const wsA = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collectorA.onMessage); },
    });
    await drainInitialMessages(collectorA);

    const clientDocA = new Y.Doc();
    clientDocA.getText("content").insert(0, "from A");
    const updateA = Y.encodeStateAsUpdate(clientDocA);

    const encoderA = encoding.createEncoder();
    encoding.writeVarUint(encoderA, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoderA, updateA);
    wsA.send(encoding.toUint8Array(encoderA));

    await new Promise((r) => setTimeout(r, 100));

    // Client A disconnects
    wsA.terminate();
    await new Promise((r) => setTimeout(r, 100));

    // Client B connects and sends more edits
    const collectorB = createMessageCollector();
    const wsB = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collectorB.onMessage); },
    });
    await drainInitialMessages(collectorB);

    const clientDocB = new Y.Doc();
    // Apply A's edits first so B has the full state
    Y.applyUpdate(clientDocB, updateA);
    clientDocB.getText("content").insert(6, " and B");
    const updateB = Y.encodeStateAsUpdate(clientDocB);

    const encoderB = encoding.createEncoder();
    encoding.writeVarUint(encoderB, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoderB, updateB);
    wsB.send(encoding.toUint8Array(encoderB));

    await new Promise((r) => setTimeout(r, 100));

    // Client A "reconnects" — new WS connection, same paste
    const collectorA2 = createMessageCollector();
    const wsA2 = await app.injectWS("/ws/" + pasteId, undefined, {
      onOpen: (socket) => { socket.on("message", collectorA2.onMessage); },
    });

    // Drain sync step 1
    const msg1 = await collectorA2.nextMessage();
    expect(decoding.readVarUint(decoding.createDecoder(new Uint8Array(msg1)))).toBe(MESSAGE_SYNC);

    // Sync step 2 contains the full server state including both A's and B's edits
    const msg2 = await collectorA2.nextMessage();
    const decoder2 = decoding.createDecoder(new Uint8Array(msg2));
    expect(decoding.readVarUint(decoder2)).toBe(MESSAGE_SYNC);

    // Apply sync step 2 to a fresh client doc to verify it contains all edits
    const reconnectedDoc = new Y.Doc();
    const respEncoder = encoding.createEncoder();
    encoding.writeVarUint(respEncoder, MESSAGE_SYNC);
    syncProtocol.readSyncMessage(decoder2, respEncoder, reconnectedDoc, null);

    // Send sync step 1 from reconnected client to get any remaining updates
    const syncEncoder = encoding.createEncoder();
    encoding.writeVarUint(syncEncoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(syncEncoder, reconnectedDoc);
    wsA2.send(encoding.toUint8Array(syncEncoder));

    // Receive sync response
    try {
      const msg3 = await collectorA2.nextMessage(1000);
      const decoder3 = decoding.createDecoder(new Uint8Array(msg3));
      const msgType = decoding.readVarUint(decoder3);
      if (msgType === MESSAGE_SYNC) {
        const respEncoder3 = encoding.createEncoder();
        encoding.writeVarUint(respEncoder3, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder3, respEncoder3, reconnectedDoc, null);
      }
    } catch {
      // Timeout is fine — all data may have been in step 2
    }

    const content = reconnectedDoc.getText("content").toString();
    expect(content).toContain("from A");
    expect(content).toContain("and B");

    clientDocA.destroy();
    clientDocB.destroy();
    reconnectedDoc.destroy();
    wsB.terminate();
    wsA2.terminate();
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
