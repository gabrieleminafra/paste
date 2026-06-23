// WebSocket / Yjs collab load tester for the pastebin server.
//
// Targets a *deployed* instance. Opens many concurrent /ws/:pasteId
// connections spread across a few pastes, performs the real Yjs sync
// handshake, optionally drives edits, and reports connection health +
// message throughput so you can find where a small box falls over.
//
// Run from the repo root so the hoisted node_modules (ws, yjs, y-protocols,
// lib0) resolve:
//
//   TARGET=https://paste.example.com CONNS=300 node loadtest/ws-stress.mjs
//
// See loadtest/README.md for all options.

import WebSocket from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

// ---- config -------------------------------------------------------------

function int(name, def) {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number, got "${v}"`);
  return n;
}
function bool(name, def) {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

const TARGET = (process.env.TARGET || "http://localhost:3000").replace(/\/$/, "");
// Derive ws base from TARGET unless WS_URL is given explicitly.
const WS_BASE = (process.env.WS_URL || TARGET.replace(/^http/, "ws")).replace(/\/$/, "");

const PASTE_IDS = (process.env.PASTE_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const PASTES = int("PASTES", 3); // how many pastes to create if PASTE_IDS not given
const CONNS = int("CONNS", 200); // total concurrent connections
const RAMP_MS = int("RAMP_MS", 10_000); // spread connection opens over this window
const DURATION_MS = int("DURATION_MS", 60_000); // hold + drive load for this long
const EDIT_FRACTION = Number(process.env.EDIT_FRACTION ?? "0.2"); // share of conns that edit
const EDIT_INTERVAL_MS = int("EDIT_INTERVAL_MS", 1000); // per-editor edit cadence
const INSECURE_TLS = bool("INSECURE_TLS", false); // accept self-signed certs
const REPORT_MS = int("REPORT_MS", 2000);

const wsOpts = INSECURE_TLS ? { rejectUnauthorized: false } : {};

// ---- metrics ------------------------------------------------------------

const m = {
  attempted: 0,
  opened: 0,
  synced: 0, // received first sync step from server
  closed: 0,
  rejected: 0, // server closed with 44xx (invalid/not-found)
  errored: 0,
  msgIn: 0,
  bytesIn: 0,
  editsSent: 0,
  syncLatencies: [], // ms from open -> first sync message
};
const closeCodes = new Map();

function recordClose(code) {
  closeCodes.set(code, (closeCodes.get(code) || 0) + 1);
}
function pct(arr, p) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

// ---- paste creation -----------------------------------------------------

async function createPaste(i) {
  const res = await fetch(`${TARGET}/api/pastes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: `loadtest paste ${i} @ start` }),
    // Node's fetch honors NODE_TLS_REJECT_UNAUTHORIZED for https; INSECURE_TLS
    // sets it below.
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.data?.id) {
    const reason = json?.error?.code || res.status;
    const err = new Error(`create paste failed: ${reason}`);
    err.status = res.status;
    throw err;
  }
  return json.data.id;
}

async function ensurePastes() {
  if (PASTE_IDS.length > 0) {
    console.log(`Using ${PASTE_IDS.length} provided paste id(s): ${PASTE_IDS.join(", ")}`);
    return PASTE_IDS;
  }
  if (PASTES > 10) {
    console.warn(
      `! POST /api/pastes is rate-limited to 10/min/IP. Creating ${PASTES} ` +
        `pastes will hit 429s. Pass PASTE_IDS=... to reuse existing pastes instead.`,
    );
  }
  const ids = [];
  for (let i = 0; i < PASTES; i++) {
    try {
      ids.push(await createPaste(i));
    } catch (err) {
      if (err.status === 429) {
        console.warn(`  create #${i} rate-limited (429); stopping with ${ids.length} paste(s).`);
        break;
      }
      throw err;
    }
  }
  if (ids.length === 0) throw new Error("could not create any pastes to target");
  console.log(`Created ${ids.length} paste(s): ${ids.join(", ")}`);
  return ids;
}

// ---- a single Yjs-aware client ------------------------------------------

function spawnClient(pasteId, isEditor) {
  m.attempted++;
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  const url = `${WS_BASE}/ws/${pasteId}`;
  const ws = new WebSocket(url, wsOpts);
  ws.binaryType = "arraybuffer";

  let openedAt = 0;
  let gotSync = false;
  let editTimer = null;

  // Mirror y-websocket: when our local doc changes, push the update to server.
  const onUpdate = (update, origin) => {
    if (origin === "remote") return; // don't echo server-applied updates back
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_SYNC);
    syncProtocol.writeUpdate(enc, update);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(encoding.toUint8Array(enc));
      m.editsSent++;
    }
  };
  doc.on("update", onUpdate);

  ws.on("open", () => {
    m.opened++;
    openedAt = performance.now();
  });

  ws.on("message", (data) => {
    m.msgIn++;
    const buf = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data);
    m.bytesIn += buf.byteLength;
    const decoder = decoding.createDecoder(buf);
    const type = decoding.readVarUint(decoder);
    if (type === MESSAGE_SYNC) {
      if (!gotSync) {
        gotSync = true;
        m.synced++;
        m.syncLatencies.push(performance.now() - openedAt);
        // Start editing only after we're synced, if this client is an editor.
        if (isEditor && EDIT_INTERVAL_MS > 0) {
          editTimer = setInterval(() => {
            const t = doc.getText("content");
            // Small bounded insert so the doc doesn't grow without limit.
            if (t.length > 5000) t.delete(0, t.length);
            t.insert(t.length, "x");
          }, EDIT_INTERVAL_MS);
        }
      }
      const respEnc = encoding.createEncoder();
      encoding.writeVarUint(respEnc, MESSAGE_SYNC);
      // origin "remote" so onUpdate doesn't bounce server updates back.
      syncProtocol.readSyncMessage(decoder, respEnc, doc, "remote");
      if (encoding.length(respEnc) > 1 && ws.readyState === WebSocket.OPEN) {
        ws.send(encoding.toUint8Array(respEnc));
      }
    } else if (type === MESSAGE_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), "remote");
    }
  });

  ws.on("close", (code) => {
    m.closed++;
    recordClose(code);
    if (code >= 4400 && code <= 4499) m.rejected++;
    if (editTimer) clearInterval(editTimer);
    doc.off("update", onUpdate);
  });

  ws.on("error", () => {
    m.errored++;
  });

  return ws;
}

// ---- orchestration ------------------------------------------------------

const sockets = [];
let reporter = null;
let lastMsgIn = 0;

function report(tag = "") {
  const synced = m.syncLatencies;
  const rate = ((m.msgIn - lastMsgIn) / (REPORT_MS / 1000)).toFixed(0);
  lastMsgIn = m.msgIn;
  console.log(
    `[${tag || "tick"}] open=${m.opened - m.closed}/${m.opened} ` +
      `synced=${m.synced} rejected=${m.rejected} err=${m.errored} ` +
      `| msgIn=${m.msgIn} (${rate}/s) editsOut=${m.editsSent} ` +
      `| syncLat p50=${pct(synced, 50).toFixed(0)}ms p95=${pct(synced, 95).toFixed(0)}ms`,
  );
}

function finalSummary() {
  console.log("\n==== summary ====");
  report("final");
  console.log(`attempted:   ${m.attempted}`);
  console.log(`opened:      ${m.opened}`);
  console.log(`synced:      ${m.synced}`);
  console.log(`closed:      ${m.closed}`);
  console.log(`rejected:    ${m.rejected} (server 44xx close)`);
  console.log(`errored:     ${m.errored}`);
  console.log(`msgs in:     ${m.msgIn} (${(m.bytesIn / 1e6).toFixed(2)} MB)`);
  console.log(`edits out:   ${m.editsSent}`);
  console.log(
    `sync latency: p50=${pct(m.syncLatencies, 50).toFixed(0)}ms ` +
      `p95=${pct(m.syncLatencies, 95).toFixed(0)}ms ` +
      `max=${Math.max(0, ...m.syncLatencies).toFixed(0)}ms`,
  );
  const codes = [...closeCodes.entries()].map(([c, n]) => `${c}:${n}`).join(" ");
  console.log(`close codes: ${codes || "(none)"}`);
}

async function main() {
  if (INSECURE_TLS) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  console.log("WebSocket/Yjs load test");
  console.log(`  target:   ${TARGET}`);
  console.log(`  ws base:  ${WS_BASE}`);
  console.log(
    `  conns=${CONNS} ramp=${RAMP_MS}ms duration=${DURATION_MS}ms ` +
      `editFraction=${EDIT_FRACTION} editEvery=${EDIT_INTERVAL_MS}ms`,
  );
  console.log("");

  const ids = await ensurePastes();

  reporter = setInterval(() => report(), REPORT_MS);

  // Ramp connections in evenly over RAMP_MS, round-robin across pastes.
  const gap = CONNS > 1 ? RAMP_MS / CONNS : 0;
  for (let i = 0; i < CONNS; i++) {
    const pasteId = ids[i % ids.length];
    const isEditor = i / CONNS < EDIT_FRACTION;
    sockets.push(spawnClient(pasteId, isEditor));
    if (gap > 0) await new Promise((r) => setTimeout(r, gap));
  }
  console.log(`-- ramp complete: ${m.opened} open, holding for ${DURATION_MS}ms --`);

  await new Promise((r) => setTimeout(r, DURATION_MS));
  shutdown(0);
}

function shutdown(code) {
  if (reporter) clearInterval(reporter);
  for (const ws of sockets) {
    try {
      ws.close(1000);
    } catch {}
  }
  // Give close frames a moment to flush before summarizing.
  setTimeout(() => {
    finalSummary();
    process.exit(code);
  }, 500);
}

process.on("SIGINT", () => {
  console.log("\n^C — shutting down");
  shutdown(0);
});

main().catch((err) => {
  console.error("fatal:", err.message);
  process.exit(1);
});
