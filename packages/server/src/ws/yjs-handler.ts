import type { FastifyPluginAsync } from "fastify";
import type { WebSocket as WsWebSocket } from "@fastify/websocket";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { createDbClient } from "../db/client.js";
import { NANOID_PATTERN } from "../routes/pastes.js";
import { DocumentManager } from "./document-manager.js";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

export const yjsHandler: FastifyPluginAsync = async (app) => {
  const { db, sql } = createDbClient(app.config.DATABASE_URL);
  const docManager = new DocumentManager(db, app.log);

  app.addHook("onClose", async () => {
    await docManager.persistAll();
    await sql.end();
  });

  app.get(
    "/ws/:pasteId",
    { websocket: true },
    async (socket: WsWebSocket, request) => {
      const { pasteId } = request.params as { pasteId: string };

      if (!NANOID_PATTERN.test(pasteId)) {
        request.log.warn(
          { event: "ws.rejected", pasteId, reason: "invalid_id" },
          "WebSocket rejected: invalid paste ID",
        );
        socket.close(4400, "Invalid paste ID");
        return;
      }

      let docEntry: { doc: Y.Doc; awareness: awarenessProtocol.Awareness };
      try {
        docEntry = await docManager.getOrCreateDoc(pasteId);
      } catch {
        request.log.warn(
          { event: "ws.rejected", pasteId, reason: "not_found" },
          "WebSocket rejected: paste not found",
        );
        socket.close(4404, "Paste not found");
        return;
      }

      const { doc, awareness } = docEntry;
      const connectionCount = docManager.addConnection(
        pasteId,
        socket as unknown as WebSocket,
      );
      request.log.info(
        { event: "ws.connected", pasteId, connections: connectionCount },
        "WebSocket connected",
      );

      // Send sync step 1 to the connecting client
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeSyncStep1(encoder, doc);
      socket.send(encoding.toUint8Array(encoder));

      // Send sync step 2 (full document state) to the connecting client
      const encoder2 = encoding.createEncoder();
      encoding.writeVarUint(encoder2, MESSAGE_SYNC);
      syncProtocol.writeSyncStep2(encoder2, doc);
      socket.send(encoding.toUint8Array(encoder2));

      // Send current awareness state
      const awarenessStates = awarenessProtocol.encodeAwarenessUpdate(
        awareness,
        Array.from(awareness.getStates().keys()),
      );
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(awarenessEncoder, awarenessStates);
      socket.send(encoding.toUint8Array(awarenessEncoder));

      // Handle awareness updates — broadcast to other clients
      const awarenessChangeHandler = (
        { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
      ) => {
        const changedClients = added.concat(updated, removed);
        if (changedClients.length > 0) {
          const encoderA = encoding.createEncoder();
          encoding.writeVarUint(encoderA, MESSAGE_AWARENESS);
          encoding.writeVarUint8Array(
            encoderA,
            awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients),
          );
          const message = encoding.toUint8Array(encoderA);
          const connections = docManager.getConnections(pasteId);
          if (connections) {
            for (const conn of connections) {
              const wsConn = conn as unknown as WsWebSocket;
              if (wsConn !== socket && wsConn.readyState === 1) {
                wsConn.send(message);
              }
            }
          }
        }
      };
      awareness.on("change", awarenessChangeHandler);

      // Handle doc updates — broadcast to other clients
      const updateHandler = (update: Uint8Array, origin: unknown) => {
        const updateEncoder = encoding.createEncoder();
        encoding.writeVarUint(updateEncoder, MESSAGE_SYNC);
        syncProtocol.writeUpdate(updateEncoder, update);
        const message = encoding.toUint8Array(updateEncoder);

        const connections = docManager.getConnections(pasteId);
        if (connections) {
          for (const conn of connections) {
            const wsConn = conn as unknown as WsWebSocket;
            if (wsConn !== socket && wsConn.readyState === 1) {
              wsConn.send(message);
            }
          }
        }
      };
      doc.on("update", updateHandler);

      socket.on("message", (data: ArrayBuffer | Buffer) => {
        try {
          const message = new Uint8Array(
            data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
          );
          const decoder = decoding.createDecoder(message);
          const messageType = decoding.readVarUint(decoder);

          if (messageType === MESSAGE_SYNC) {
            const responseEncoder = encoding.createEncoder();
            encoding.writeVarUint(responseEncoder, MESSAGE_SYNC);
            syncProtocol.readSyncMessage(decoder, responseEncoder, doc, null);
            if (encoding.length(responseEncoder) > 1) {
              socket.send(encoding.toUint8Array(responseEncoder));
            }
          } else if (messageType === MESSAGE_AWARENESS) {
            awarenessProtocol.applyAwarenessUpdate(
              awareness,
              decoding.readVarUint8Array(decoder),
              socket as unknown as WebSocket,
            );
          }
        } catch (err) {
          app.log.error(err, "Error processing WebSocket message");
        }
      });

      socket.on("close", () => {
        doc.off("update", updateHandler);
        awareness.off("change", awarenessChangeHandler);
        awarenessProtocol.removeAwarenessStates(
          awareness,
          [doc.clientID],
          null,
        );
        const remaining = docManager.removeConnection(
          pasteId,
          socket as unknown as WebSocket,
        );
        request.log.info(
          { event: "ws.disconnected", pasteId, connections: remaining },
          "WebSocket disconnected",
        );
      });
    },
  );
};
