# WebSocket / Yjs collab load test

Stress-tests the unthrottled `/ws/:pasteId` collaboration path of a **deployed**
pastebin instance. This is the path most likely to topple a small box: the
server holds a live `Y.Doc` in memory per active paste and broadcasts every edit
to all connected peers in a loop, so cost scales with _connections per paste_,
not just total connections.

> The HTTP routes are rate-limited per IP (creates 10/min, reads 60/min), so a
> single-host HTTP flood mostly measures the rate limiter. The WebSocket route
> has no rate limit — that's what this tool targets.

## Run

From the **repo root** (so the hoisted `node_modules` resolve):

```bash
TARGET=https://paste.example.com CONNS=300 node loadtest/ws-stress.mjs
```

Because creating pastes is rate-limited to 10/min/IP, the realistic collab test
is **many connections on a few pastes**. To avoid spending your create budget,
make one paste in the UI and reuse it:

```bash
TARGET=https://paste.example.com \
PASTE_IDS=happy-blue-otter \
CONNS=500 RAMP_MS=20000 DURATION_MS=120000 \
EDIT_FRACTION=0.25 EDIT_INTERVAL_MS=500 \
node loadtest/ws-stress.mjs
```

Ctrl-C at any time prints the summary.

## Options (env vars)

| Var                | Default                 | Meaning                                                       |
| ------------------ | ----------------------- | ------------------------------------------------------------- |
| `TARGET`           | `http://localhost:3000` | Base HTTP(S) URL. `ws`/`wss` is derived from it.              |
| `WS_URL`           | derived from `TARGET`   | Override the ws base explicitly (e.g. behind a proxy).        |
| `PASTE_IDS`        | _(empty)_               | Comma-separated existing paste ids to target (skips create).  |
| `PASTES`           | `3`                     | How many pastes to create if `PASTE_IDS` not given.           |
| `CONNS`            | `200`                   | Total concurrent connections, round-robined across pastes.    |
| `RAMP_MS`          | `10000`                 | Open all connections evenly over this window.                 |
| `DURATION_MS`      | `60000`                 | Hold + drive load for this long after ramp.                   |
| `EDIT_FRACTION`    | `0.2`                   | Share of connections that actively edit (rest are viewers).   |
| `EDIT_INTERVAL_MS` | `1000`                  | Per-editor edit cadence. `0` = hold connections, no edits.    |
| `INSECURE_TLS`     | `false`                 | Set `1` to accept self-signed certs (`wss://` + `https://`).  |
| `REPORT_MS`        | `2000`                  | Progress line interval.                                       |

## Reading the output

Each tick and the final summary report:

- `open=active/total` — live connections vs total opened. A growing gap means
  the server is dropping connections under load.
- `synced` — connections that completed the Yjs sync handshake.
- `rejected` — server closed with a 44xx code (`4400` invalid id, `4404` paste
  not found). Non-zero usually means a bad `PASTE_IDS`.
- `msgIn (.../s)` — broadcast fan-out you're receiving. With N editors on one
  paste, expect roughly N×(connections-1) messages/s — this is the quadratic
  term that hurts a small box.
- `syncLat p50/p95` — time from socket open to first sync frame. Climbing p95 is
  the earliest sign the event loop is saturating.

Pair this with server-side observation (`docker stats`, `htop`) to see where RAM
(one Y.Doc per paste + buffers), CPU (broadcast loops), or the event loop gives.

## Suggested ramp to find the ceiling

1. `CONNS=100 EDIT_FRACTION=0` — baseline, connections only.
2. Step `CONNS` up (200 → 500 → 1000) until `synced < opened` or p95 spikes.
3. Re-run at a stable `CONNS` and raise `EDIT_FRACTION` / lower
   `EDIT_INTERVAL_MS` to stress broadcast CPU rather than connection count.
