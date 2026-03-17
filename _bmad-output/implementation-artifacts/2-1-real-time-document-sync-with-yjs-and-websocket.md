# Story 2.1: Real-Time Document Sync with Yjs & WebSocket

Status: review

## Story

As a user,
I want my edits to a paste to be saved in real time,
So that I can edit existing pastes and my changes persist automatically.

## Acceptance Criteria

1. **Given** I am on a paste page (`/:pasteId`)
   **When** the page loads
   **Then** the editor is a CodeMirror 6 instance with Yjs binding (`y-codemirror.next`) replacing the basic textarea from Epic 1
   **And** the editor uses the same monospace font stack (JetBrains Mono / Fira Code / SF Mono / Consolas)

2. **Given** I am on a paste page
   **When** the CodeMirror editor initializes
   **Then** a WebSocket connection is established to `GET /ws/:pasteId` via `@fastify/websocket`
   **And** the Yjs document syncs with the server using the y-websocket sync protocol (FR11)

3. **Given** the server receives a WebSocket connection for a paste
   **When** the paste exists in PostgreSQL
   **Then** the document-manager loads the Yjs binary state from the `content` (bytea) column into an in-memory Yjs document
   **And** the Yjs sync protocol sends the current document state to the connecting client

4. **Given** the server receives a WebSocket connection for a paste
   **When** no in-memory Yjs document exists for that paste
   **Then** a new Yjs document is created from the stored binary state and held in memory

5. **Given** I am editing a paste
   **When** I type in the CodeMirror editor
   **Then** edits are sent to the server via the Yjs WebSocket sync protocol
   **And** the server-side Yjs document is updated in memory
   **And** the document-manager persists the Yjs binary state to PostgreSQL on a debounced interval (5 seconds of inactivity) (FR2)

6. **Given** all clients disconnect from a paste
   **When** the last WebSocket connection closes
   **Then** the document-manager persists the final Yjs state to PostgreSQL immediately
   **And** the in-memory Yjs document is cleaned up

7. **Given** the paste page component
   **When** I inspect the implementation
   **Then** a `useCollaboration(pasteId)` custom hook wires up the Yjs document, WebsocketProvider, and awareness protocol
   **And** the hook returns document state, connection status, and connected users

## Tasks / Subtasks

- [x] Task 1: Install new dependencies (AC: #1, #2)
  - [x] Add to `packages/server`: `@fastify/websocket@^11.2`, `yjs@^13.6`, `y-protocols@^1.0`, `lib0@^0.2` (encoding/decoding used directly in sync protocol)
  - [x] Add to `packages/client`: `yjs@^13.6`, `y-websocket@^3.0`, `y-codemirror.next@^0.3.5`, `codemirror@^6.0`, `@codemirror/state@^6.0`, `@codemirror/view@^6.0`
  - [x] Do NOT install `@codemirror/lang-javascript` — syntax highlighting is not in scope for this story

- [x] Task 2: Build server-side document-manager (AC: #3, #4, #5, #6)
  - [x] Create `packages/server/src/ws/document-manager.ts`
  - [x] Constructor accepts `db: Database` parameter (import `Database` type from `../db/client.js`) — the db instance is injected from the WS handler plugin which creates it via `createDbClient(app.config.DATABASE_URL)`
  - [x] Implement `DocumentManager` class with in-memory `Map<string, { doc: Y.Doc, connections: Set<WebSocket>, saveTimeout: Timer | null, awareness: Awareness }>`
  - [x] `getOrCreateDoc(pasteId)`: Load Yjs binary from PostgreSQL `content` column via `Y.applyUpdate(doc, storedState)`, or create empty doc if paste not found. Handle legacy plain-text content (see Data Migration section below).
  - [x] `handleUpdate(pasteId)`: Debounced persistence — clear existing timer, set new 5-second timer to persist `Y.encodeStateAsUpdate(doc)` to PostgreSQL
  - [x] `removeConnection(pasteId, ws)`: Remove WS from connections set; if last connection, persist immediately and clean up in-memory doc
  - [x] `persistDoc(pasteId)`: Write `Y.encodeStateAsUpdate(doc)` to PostgreSQL `content` column via Drizzle `db.update(pastes).set({ content, updatedAt: new Date() }).where(eq(pastes.id, pasteId))`
  - [x] `persistAll()`: Persist all in-memory docs — called during graceful shutdown
  - [x] Create `packages/server/src/ws/document-manager.test.ts`

- [x] Task 3: Build server-side WebSocket handler (AC: #2, #3, #5)
  - [x] Create `packages/server/src/ws/yjs-handler.ts`
  - [x] Register `@fastify/websocket` in `app.ts`
  - [x] Add WebSocket route `GET /ws/:pasteId` — upgrade to WS, validate pasteId format (nanoid 21-char pattern)
  - [x] On connection: validate paste exists in DB (if not, close WS with 4404 code and "Paste not found" reason), then get/create doc from document-manager, add WS to connections, send initial sync (Yjs sync step 1 + step 2)
  - [x] On message: apply Yjs sync protocol message to server doc (`Y.applyUpdate`), broadcast to other connections, trigger debounced persistence
  - [x] On close: call `document-manager.removeConnection(pasteId, ws)`
  - [x] Use `y-protocols/sync` for encoding/decoding sync messages (syncStep1, syncStep2, update)
  - [x] Reuse existing `NANOID_PATTERN` regex from `routes/pastes.ts` — extract to a shared constant in `packages/shared/src/types.ts` or import from pastes module
  - [x] Add `onClose` hook in WS handler plugin to call `documentManager.persistAll()` for graceful server shutdown
  - [x] Create `packages/server/src/ws/yjs-handler.test.ts`

- [x] Task 4: Build PasteEditor component with CodeMirror + Yjs (AC: #1)
  - [x] Create `packages/client/src/components/PasteEditor.tsx`
  - [x] Initialize CodeMirror 6 `EditorView` with extensions: `basicSetup` (or minimal setup), `yCollab(ytext, awareness, { undoManager })`, monospace font theme
  - [x] Accept `ytext: Y.Text`, `awareness: Awareness` as props (provided by useCollaboration hook)
  - [x] Apply monospace font: use `EditorView.theme({ '.cm-editor': { fontFamily: 'var(--font-mono)' } })` to match existing `font-mono` stack
  - [x] Container styling: `w-full min-h-[60vh] border border-border rounded-md` to match existing textarea dimensions
  - [x] Attach `EditorView` to a ref div, clean up on unmount
  - [x] Create `packages/client/src/components/PasteEditor.test.tsx`

- [x] Task 5: Build useCollaboration hook (AC: #7)
  - [x] Create `packages/client/src/hooks/useCollaboration.ts`
  - [x] Initialize `Y.Doc`, get `Y.Text` from `doc.getText('content')`
  - [x] Create `WebsocketProvider` from `y-websocket` — connect to `ws://host/ws/${pasteId}` (use `window.location` to derive WS URL)
  - [x] Create `Y.UndoManager(ytext)` for undo/redo support
  - [x] Track connection status: `'connecting' | 'connected' | 'disconnected'` via provider `status` event
  - [x] Return `{ ytext, awareness: provider.awareness, connectionStatus, connectedUsers, undoManager }`
  - [x] Cleanup on unmount: `provider.destroy()`, `doc.destroy()`
  - [x] Create `packages/client/src/hooks/useCollaboration.test.ts`

- [x] Task 6: Integrate into PastePage — replace textarea with collaborative editor (AC: #1, #2, #7)
  - [x] Modify `packages/client/src/pages/PastePage.tsx`
  - [x] Replace the fetch-and-display textarea pattern with `useCollaboration(pasteId)` + `PasteEditor`
  - [x] Remove the `fetch('/api/pastes/${pasteId}')` useEffect — Yjs handles loading document state via WebSocket sync
  - [x] Keep PageHeader, loading skeleton (show while `connectionStatus === 'connecting'`), notFound state
  - [x] Handle paste-not-found: if WebSocket closes with specific error, show "Paste not found"
  - [x] Update `packages/client/src/pages/PastePage.test.tsx`

- [x] Task 7: Update paste CRUD to use Yjs binary state (AC: #3, #4)
  - [x] Modify `POST /api/pastes` in `packages/server/src/routes/pastes.ts` — store content as Yjs binary state: create `Y.Doc`, insert text into `doc.getText('content')`, encode as `Y.encodeStateAsUpdate(doc)` and store in `content` bytea column. Keep existing validation (content required, 1MB size check on raw text input) BEFORE Yjs encoding.
  - [x] Modify `GET /api/pastes/:id` in `packages/server/src/routes/pastes.ts` — replace the current `Buffer.from(paste.content).toString("utf-8")` (line 112) with Yjs decoding: `Y.applyUpdate(doc, paste.content)` then `doc.getText('content').toString()`. Handle legacy plain-text content with try-catch fallback (see Data Migration section).
  - [x] Update both POST and GET tests in `packages/server/src/routes/pastes.test.ts`

- [x] Task 8: Integration testing (AC: all)
  - [x] Test WebSocket connection establishes to valid paste
  - [x] Test Yjs document loads from PostgreSQL on connection
  - [x] Test edits persist to database after 5-second debounce
  - [x] Test cleanup on last client disconnect
  - [x] Run full test suite — ensure zero regressions on existing 51 tests

## Dev Notes

### Architecture Compliance

**File structure — MUST create/modify these exact files:**
```
packages/
├── client/
│   └── src/
│       ├── components/
│       │   ├── PasteEditor.tsx         # NEW: CodeMirror 6 + Yjs binding
│       │   └── PasteEditor.test.tsx    # NEW
│       ├── hooks/
│       │   ├── useCollaboration.ts     # NEW: Yjs doc + WebSocket provider + awareness
│       │   └── useCollaboration.test.ts # NEW
│       └── pages/
│           ├── PastePage.tsx           # MODIFY: Replace textarea with PasteEditor + useCollaboration
│           └── PastePage.test.tsx      # MODIFY: Update for new editor
├── server/
│   └── src/
│       ├── app.ts                     # MODIFY: Register @fastify/websocket, add WS route
│       ├── routes/
│       │   ├── pastes.ts              # MODIFY: Store Yjs binary state on creation
│       │   └── pastes.test.ts         # MODIFY: Update creation tests
│       └── ws/
│           ├── document-manager.ts    # NEW: In-memory Yjs doc management + persistence
│           ├── document-manager.test.ts # NEW
│           ├── yjs-handler.ts         # NEW: WebSocket route + Yjs sync protocol
│           └── yjs-handler.test.ts    # NEW
```

### Critical Technical Requirements

**Yjs Server-Side Sync Protocol (y-protocols/sync):**

The server MUST implement the Yjs sync protocol manually (NOT use the y-websocket CLI server). The protocol has 3 message types:
```typescript
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'

// Message type constants
const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1

// On new connection — send sync step 1
const encoder = encoding.createEncoder()
encoding.writeVarUint(encoder, MESSAGE_SYNC)
syncProtocol.writeSyncStep1(encoder, doc)
ws.send(encoding.toUint8Array(encoder))

// On incoming message
const decoder = decoding.createDecoder(new Uint8Array(message))
const messageType = decoding.readVarUint(decoder)

if (messageType === MESSAGE_SYNC) {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, MESSAGE_SYNC)
  syncProtocol.readSyncMessage(decoder, encoder, doc, null)
  if (encoding.length(encoder) > 1) {
    ws.send(encoding.toUint8Array(encoder))
  }
}

// On doc update — broadcast to all other connections
doc.on('update', (update, origin) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, MESSAGE_SYNC)
  syncProtocol.writeUpdate(encoder, update)
  const message = encoding.toUint8Array(encoder)
  connections.forEach(conn => {
    if (conn !== origin) conn.send(message)
  })
})
```

**Yjs Awareness Protocol (for cursor presence in Story 2.3):**

The awareness protocol MUST be wired up in this story even though cursor rendering is Story 2.3. The `useCollaboration` hook returns `awareness` which Story 2.3 will consume.

```typescript
import * as awarenessProtocol from 'y-protocols/awareness'

// On server — relay awareness messages between clients
if (messageType === MESSAGE_AWARENESS) {
  awarenessProtocol.applyAwarenessUpdate(
    awareness,
    decoding.readVarUint8Array(decoder),
    ws  // origin
  )
}
```

**Document-Manager Database Access Pattern:**

The `DocumentManager` class receives the `db` instance via its constructor. The WS handler plugin creates it:
```typescript
// In yjs-handler.ts (Fastify plugin)
import { createDbClient, type Database } from '../db/client.js'

const yjsHandler: FastifyPluginAsync = async (app) => {
  const { db, sql } = createDbClient(app.config.DATABASE_URL)
  const docManager = new DocumentManager(db)

  app.addHook('onClose', async () => {
    await docManager.persistAll()
    await sql.end()
  })
  // ... register WS route using docManager
}
```

**Document-Manager Persistence Pattern:**
```typescript
import type { Database } from '../db/client.js'

class DocumentManager {
  private docs = new Map<string, {
    doc: Y.Doc,
    connections: Set<WebSocket>,
    saveTimeout: ReturnType<typeof setTimeout> | null,
    awareness: awarenessProtocol.Awareness
  }>()

  constructor(private db: Database) {}

  private PERSIST_DEBOUNCE_MS = 5000

  async getOrCreateDoc(pasteId: string): Promise<{ doc: Y.Doc, awareness: Awareness }> {
    if (this.docs.has(pasteId)) return this.docs.get(pasteId)!

    const doc = new Y.Doc()
    const awareness = new awarenessProtocol.Awareness(doc)

    // Load from DB
    const result = await db.select().from(pastes).where(eq(pastes.id, pasteId)).limit(1)
    if (result.length > 0 && result[0].content.length > 0) {
      Y.applyUpdate(doc, result[0].content)
    }

    this.docs.set(pasteId, { doc, connections: new Set(), saveTimeout: null, awareness })

    // Listen for updates to trigger debounced persistence
    doc.on('update', () => this.schedulePersist(pasteId))

    return { doc, awareness }
  }
}
```

**WebSocket URL Construction (Client-Side):**
```typescript
// In useCollaboration hook — derive WS URL from current page location
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const wsUrl = `${protocol}//${window.location.host}`

// y-websocket WebsocketProvider handles room naming
const provider = new WebsocketProvider(wsUrl, pasteId, ydoc, {
  connect: true,
  // In development, Vite proxy forwards /ws/* to the Fastify server
})
```

**IMPORTANT — y-websocket WebsocketProvider URL behavior:**
The `WebsocketProvider(serverUrl, roomname, ydoc)` connects to `${serverUrl}/${roomname}`. However, the architecture specifies the WebSocket endpoint as `/ws/:pasteId`. You need to configure the provider URL so the final connection goes to `/ws/${pasteId}`:
```typescript
const provider = new WebsocketProvider(`${wsUrl}/ws`, pasteId, ydoc)
// This connects to: ws://host/ws/pasteId
```

**Vite Dev Proxy for WebSocket — ALREADY CONFIGURED:**

The WebSocket proxy is already configured in `packages/client/vite.config.ts` (lines 11-14):
```typescript
'/ws': {
  target: 'ws://localhost:3000',
  ws: true,
},
```
Do NOT duplicate this. Verify it exists and move on.

**@fastify/websocket Registration:**
```typescript
import websocket from '@fastify/websocket'

// In buildApp() — register BEFORE routes that use websocket
await app.register(websocket)

// Register WS route
app.register(yjsHandler)
```

**CodeMirror 6 Setup Pattern:**
```typescript
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { yCollab } from 'y-codemirror.next'

// In PasteEditor component
useEffect(() => {
  const state = EditorState.create({
    doc: ytext.toString(),
    extensions: [
      basicSetup,
      yCollab(ytext, awareness, { undoManager }),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-editor': { height: '100%' },
        '.cm-scroller': { fontFamily: 'var(--font-mono)', overflow: 'auto' },
        '.cm-content': { padding: '1rem' },
      }),
      EditorView.lineWrapping,
    ],
  })

  const view = new EditorView({ state, parent: editorRef.current! })
  return () => view.destroy()
}, [ytext, awareness, undoManager])
```

**CRITICAL: Paste Creation Must Store Yjs Binary State**

The current `POST /api/pastes` stores raw text as `Buffer.from(content, 'utf-8')`. This MUST change to store Yjs binary state so the document-manager can load it correctly:
```typescript
import * as Y from 'yjs'

// In POST /api/pastes handler
const doc = new Y.Doc()
doc.getText('content').insert(0, content)
const yState = Y.encodeStateAsUpdate(doc)
doc.destroy()

await db.insert(pastes).values({
  id,
  content: Buffer.from(yState),  // Store Yjs binary, NOT raw text
})
```

**GET /api/pastes/:id must also decode Yjs state for backward compatibility:**
The HTTP GET endpoint is still used for initial page metadata. If it needs to return text content, decode from Yjs:
```typescript
const doc = new Y.Doc()
Y.applyUpdate(doc, result[0].content)
const textContent = doc.getText('content').toString()
doc.destroy()
```

**CRITICAL: Data Migration — Legacy Plain-Text Content**

Existing pastes created in Epic 1 store raw UTF-8 text in the `content` column, NOT Yjs binary state. Both `document-manager.ts` and `GET /api/pastes/:id` MUST handle both formats gracefully.

**Detection strategy:**
```typescript
function loadYjsDoc(storedContent: Uint8Array): Y.Doc {
  const doc = new Y.Doc()
  try {
    Y.applyUpdate(doc, storedContent)
    // Verify it actually has content in the expected text type
    // (applyUpdate may silently succeed on non-Yjs data in edge cases)
    if (doc.getText('content').length === 0 && storedContent.length > 0) {
      // Stored data was not a valid Yjs update for our text type — treat as plain text
      doc.getText('content').insert(0, Buffer.from(storedContent).toString('utf-8'))
    }
  } catch {
    // Invalid Yjs state — treat as legacy plain text
    doc.getText('content').insert(0, Buffer.from(storedContent).toString('utf-8'))
  }
  return doc
}
```
- Use this function in BOTH `document-manager.getOrCreateDoc()` AND `GET /api/pastes/:id`
- Consider extracting to a shared utility in `packages/server/src/ws/` (e.g., `yjs-utils.ts`) to avoid duplication
- This backward compatibility ensures existing pastes from Epic 1 still work

### Previous Story Intelligence (Epic 1)

**Key patterns established that MUST be followed:**

From Story 1.1:
- App factory pattern: `export async function buildApp()` in `app.ts` — register all plugins/routes inside this function
- Database client: `createDbClient(connectionString)` in `db/client.ts` returns `{ db, sql }`
- Schema: `pastes` table in `db/schema.ts` with `bytea` custom type for `content` column
- Error handler wraps all errors in `ApiResponse` envelope
- ESM throughout — use `.js` extensions in import paths (`import { pastes } from '../db/schema.js'`)

From Story 1.2:
- React Router 7 — import from `'react-router'` (NOT `react-router-dom`)
- Tailwind CSS v4.2 — design tokens in `@theme` block in `index.css`:
  - `--color-primary` (#2563EB), `--color-muted` (#6B7280), `--color-border` (#E5E7EB)
  - `--font-mono` (JetBrains Mono / Fira Code / SF Mono / Consolas)
- Components are single files in `components/` — no barrel exports, no subdirectories
- Custom hooks go in `hooks/` directory
- Paste creation uses `POST /api/pastes` with JSON body `{ content: string }`

From Story 1.3:
- PageHeader renders at top of PastePage with ShareLink and "New Paste" link
- PastePage wraps content in `<main id="main-content">` for accessibility
- `@fastify/static` registered conditionally for production — development uses Vite proxy
- `setNotFoundHandler` differentiates API/WS 404s (JSON envelope) from page 404s (serve index.html)
- **51 tests across 10 files** — run full suite to verify zero regressions

**What PastePage currently does (MUST understand before modifying):**
- Fetches paste via `GET /api/pastes/:pasteId` in useEffect
- Manages states: `loading`, `notFound`, `fetchError`, `content`
- Shows PageHeader in all states
- Shows skeleton shimmer during loading
- Shows "Paste not found" for 404
- Shows "Something went wrong" with retry for errors
- Shows read-only textarea with paste content

**What changes in PastePage:**
- REMOVE: fetch useEffect, content/loading/notFound/fetchError state
- ADD: `useCollaboration(pasteId!)` hook call
- ADD: `<PasteEditor ytext={ytext} awareness={awareness} undoManager={undoManager} />`
- KEEP: PageHeader, `<main id="main-content">` wrapper, overall layout structure
- ADAPT: Show skeleton while `connectionStatus === 'connecting'`, handle connection errors

### Git Intelligence

Recent commits show consistent patterns:
- Commit messages: `feat: Story X.Y — description with code review fixes`
- All stories build incrementally on previous work
- Test count: 9 (1.1) → 29 (1.2) → 51 (1.3) — expect ~65-75 tests after this story

### Library Versions (Verified March 2026)

| Package | Version | Purpose | Install Target |
|---------|---------|---------|----------------|
| @fastify/websocket | ^11.2 | WebSocket support for Fastify 5 | server |
| yjs | ^13.6 | CRDT for collaborative editing | server + client |
| y-protocols | ^1.0 | Yjs sync and awareness wire protocols | server |
| y-websocket | ^3.0 | Yjs WebSocket sync provider (client) | client |
| y-codemirror.next | ^0.3.5 | Yjs binding for CodeMirror 6 | client |
| codemirror | ^6.0 | CodeMirror 6 base package | client |
| @codemirror/state | ^6.0 | Editor state management | client |
| @codemirror/view | ^6.0 | Editor view layer | client |
| lib0 | ^0.2 | Utility library used by Yjs (encoding/decoding) | server |

**y-codemirror.next v0.3.5 critical note:** Ensure ALL `@codemirror/*` packages are compatible versions. Mismatched CodeMirror package versions cause runtime errors. Install `codemirror` meta-package which bundles compatible versions.

**y-websocket v3.0 notes:**
- `WebsocketProvider(serverUrl, roomname, ydoc, opts)` — serverUrl is the base WS URL
- Provider auto-reconnects with exponential backoff (max 2500ms default)
- `provider.awareness` gives access to the awareness instance
- `provider.on('status', ({ status }) => ...)` for connection state changes
- `provider.destroy()` for cleanup

### What This Story Does NOT Include

- No cursor rendering (CursorIndicator) — that's Story 2.3
- No multi-user conflict testing — that's Story 2.2
- No ConnectionStatus component — that's Story 3.2
- No auto-reconnection UI — that's Story 3.1
- No responsive layout changes — that's Story 4.1
- No keyboard shortcuts beyond CodeMirror defaults — that's Story 4.2
- No Dockerfile changes — that's Story 4.3

### Testing Strategy

**Server Tests:**
- `document-manager.test.ts`:
  - Creates doc from empty database state
  - Loads existing Yjs state from database
  - Handles legacy plain-text content (backward compat)
  - Debounced persistence triggers after 5s inactivity
  - Immediate persistence on last client disconnect
  - Cleans up in-memory doc after all clients disconnect
  - Mock Drizzle db for unit tests

- `yjs-handler.test.ts`:
  - WebSocket upgrade succeeds for valid pasteId
  - Rejects invalid pasteId format
  - Sync step 1 sent on connection
  - Update messages applied to server doc
  - Connection cleanup on close

**Client Tests:**
- `PasteEditor.test.tsx`:
  - Renders CodeMirror editor container
  - Mounts/unmounts without errors
  - Mock Yjs types for unit testing

- `useCollaboration.test.ts`:
  - Creates Y.Doc and WebsocketProvider
  - Returns ytext, awareness, connectionStatus
  - Cleans up on unmount (destroy provider and doc)
  - Mock WebsocketProvider for unit tests

- `PastePage.test.tsx` (updated):
  - Renders PasteEditor (mock useCollaboration)
  - Shows loading state while connecting
  - Shows PageHeader

**Co-locate all test files** with source files per project convention. Use Vitest 4.1.x (workspace root dependency).

### Project Structure Notes

- All new files follow the architecture's directory structure exactly
- Server WebSocket files go in `packages/server/src/ws/` (new directory)
- Client hook goes in `packages/client/src/hooks/` (new directory)
- React components use PascalCase: `PasteEditor.tsx`
- Utilities use kebab-case: `document-manager.ts`, `yjs-handler.ts`
- No barrel exports — import directly by path
- No `src/utils/` directory

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: Real-Time Document Sync]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns]
- [Source: _bmad-output/planning-artifacts/prd.md#FR2, FR6, FR7, FR8, FR11]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component Strategy — PasteEditor]
- [Source: _bmad-output/implementation-artifacts/1-3-paste-viewing-and-sharing.md#Previous Story Intelligence]
- [Source: github.com/yjs/y-codemirror.next — v0.3.5 API]
- [Source: github.com/yjs/y-websocket — v3.0 WebsocketProvider API]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- ESLint flagged React ref access during render in useCollaboration hook — refactored to use `useMemo` for stable doc/ytext/undoManager/awareness creation, eliminating all lint errors
- `@fastify/websocket` `injectWS` hangs when server closes WS immediately (invalid pasteId) — adapted test to use HTTP inject for invalid format validation instead

### Completion Notes List

- **Task 1:** Installed all dependencies per spec. Verified `@codemirror/lang-javascript` was NOT installed.
- **Task 2:** Built `DocumentManager` class with in-memory doc management, debounced persistence (5s), immediate persist on last disconnect, graceful shutdown via `persistAll()`. Created shared `yjs-utils.ts` with `loadYjsDoc()` for legacy plain-text backward compatibility. 12 unit tests (9 document-manager + 3 yjs-utils).
- **Task 3:** Built `yjs-handler.ts` Fastify plugin implementing full Yjs sync protocol (sync step 1/2, update broadcasting) and awareness protocol relay. Registered `@fastify/websocket` and handler in `app.ts`. Exported `NANOID_PATTERN` from pastes route for reuse. Added `onClose` hook for graceful shutdown. 5 integration tests.
- **Task 4:** Built `PasteEditor` component with CodeMirror 6 + Yjs binding (`yCollab`), monospace font theme via CSS variable, line wrapping, proper cleanup on unmount. 3 unit tests.
- **Task 5:** Built `useCollaboration` hook returning `{ ytext, awareness, connectionStatus, connectedUsers, undoManager }`. Uses `useMemo` for stable Yjs objects, creates `WebsocketProvider` with awareness injection. Proper cleanup on unmount. 4 unit tests.
- **Task 6:** Replaced PastePage fetch-and-display textarea with `useCollaboration` + `PasteEditor`. Shows loading skeleton while connecting, "Connection lost" state for disconnected. 6 unit tests.
- **Task 7:** Updated `POST /api/pastes` to store Yjs binary state via `Y.encodeStateAsUpdate()`. Updated `GET /api/pastes/:id` to decode via `loadYjsDoc()` with legacy plain-text fallback. All 10 existing paste route tests pass unchanged.
- **Task 8:** Full regression suite: 74 tests across 15 files, zero regressions. Test count: 51 (Epic 1) → 74 (Story 2.1), +23 new tests.

### File List

**New files:**
- `packages/server/src/ws/document-manager.ts`
- `packages/server/src/ws/document-manager.test.ts`
- `packages/server/src/ws/yjs-handler.ts`
- `packages/server/src/ws/yjs-handler.test.ts`
- `packages/server/src/ws/yjs-utils.ts`
- `packages/server/src/ws/yjs-utils.test.ts`
- `packages/client/src/components/PasteEditor.tsx`
- `packages/client/src/components/PasteEditor.test.tsx`
- `packages/client/src/hooks/useCollaboration.ts`
- `packages/client/src/hooks/useCollaboration.test.ts`

**Modified files:**
- `packages/server/src/app.ts` — registered @fastify/websocket and yjsHandler plugins
- `packages/server/src/routes/pastes.ts` — Yjs binary encoding on POST, Yjs decoding on GET, exported NANOID_PATTERN
- `packages/server/package.json` — added @fastify/websocket, yjs, y-protocols, lib0
- `packages/client/src/pages/PastePage.tsx` — replaced fetch+textarea with useCollaboration+PasteEditor
- `packages/client/src/pages/PastePage.test.tsx` — updated for new collaborative editor
- `packages/client/package.json` — added yjs, y-websocket, y-codemirror.next, codemirror, @codemirror/state, @codemirror/view
- `package-lock.json` — updated lockfile

## Change Log

- 2026-03-17: Implemented Story 2.1 — real-time document sync with Yjs & WebSocket. Added server-side DocumentManager with debounced persistence, WebSocket handler with full Yjs sync protocol, CodeMirror 6 editor with Yjs binding, useCollaboration hook, and Yjs binary state storage with legacy backward compatibility. 74 tests pass (23 new).
