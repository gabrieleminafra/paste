# Story 3.1: Auto-Reconnection & State Synchronization

Status: review

## Story

As a user,
I want my connection to recover automatically when it drops with all missed edits caught up seamlessly,
So that I never lose work or have to manually refresh.

## Acceptance Criteria

1. **Given** I am editing a paste with an active WebSocket connection
   **When** my network connection drops temporarily
   **Then** the Yjs WebsocketProvider detects the disconnection and begins automatic reconnection attempts (FR12, NFR9)
   **And** no user action is required to reconnect

2. **Given** my connection was lost while others continued editing
   **When** the WebSocket reconnects successfully
   **Then** the Yjs sync protocol merges all missed updates into my local document (FR13)
   **And** the document state is consistent with all other connected clients (NFR10)
   **And** no edits are lost, duplicated, or corrupted (NFR11)

3. **Given** I made edits while disconnected (offline edits buffered by Yjs)
   **When** the connection is restored
   **Then** my local edits are sent to the server via the Yjs sync protocol
   **And** they are merged with any concurrent edits from other users without conflict
   **And** all clients converge to the same document state

4. **Given** the server still has the in-memory Yjs document for the paste
   **When** a client reconnects
   **Then** the sync protocol efficiently sends only the missing updates (not the full document)
   **And** the catch-up completes within 1 second for typical edit volumes

5. **Given** the server was restarted while I had a paste open
   **When** my client reconnects
   **Then** the server loads the Yjs document from PostgreSQL binary state
   **And** my client syncs against the restored document
   **And** the document state is consistent (NFR8)

## Tasks / Subtasks

- [x] Task 1: Configure WebsocketProvider reconnection parameters (AC: #1)
  - [x] Modify `packages/client/src/hooks/useCollaboration.ts` — add explicit reconnection configuration to WebsocketProvider constructor: `maxBackoffTime: 10000` (10s max retry interval), `resyncInterval: 30000` (re-sync every 30s when connected to catch missed updates)
  - [x] Add `'reconnecting'` to the connection status type — currently the hook tracks `'connecting' | 'connected' | 'disconnected'`; add `'reconnecting'` state that fires when the provider loses connection but is attempting to reconnect (distinct from initial `'connecting'`)
  - [x] Listen to WebsocketProvider `'status'` event changes: map `{ status: 'connecting' }` after a prior `'connected'` to the new `'reconnecting'` state
  - [x] Update `packages/shared/src/types.ts` if `ConnectionStatus` type is defined there, otherwise update the local type in `useCollaboration.ts`
  - [x] Update `packages/client/src/hooks/useCollaboration.test.ts` — add tests for reconnection status transitions: connected → reconnecting → connected

- [x] Task 2: Handle offline edits and state recovery (AC: #2, #3, #4)
  - [x] Verify that Yjs `WebsocketProvider` buffers local edits while disconnected — this is built-in Yjs behavior. The local `Y.Doc` continues to accept edits, and `y-websocket` sends pending updates on reconnection. **No custom buffering code needed.**
  - [x] Add integration test in `useCollaboration.test.ts` — simulate disconnect (destroy provider mock), make local edits, simulate reconnect, verify edits are present in the Yjs doc
  - [x] Verify that `yjs-handler.ts` server-side sync (sync step 1 + step 2 sent on connection) correctly handles a reconnecting client whose state vector is ahead of the server's in-memory doc — Yjs sync protocol handles this natively

- [x] Task 3: Handle server restart recovery (AC: #5)
  - [x] Verify that `document-manager.ts` `getOrCreateDoc()` loads from PostgreSQL when the in-memory cache is empty (this already works — just needs a reconnection-specific test)
  - [x] Add test in `document-manager.test.ts` — simulate: client 1 edits → doc persisted → clear in-memory cache (simulating restart) → client 2 connects → verify doc loaded from DB with client 1's edits
  - [x] Add test in `yjs-handler.test.ts` — simulate: client connects, sends edits, disconnects (doc persists), server clears in-memory doc, client reconnects → verify full sync cycle works and client receives persisted state

- [x] Task 4: Update PastePage to handle reconnecting state (AC: #1)
  - [x] Modify `packages/client/src/pages/PastePage.tsx` — add handling for the new `'reconnecting'` status: keep the editor visible and editable (unlike `'disconnected'` which shows a message), since Yjs buffers edits locally
  - [x] The editor must remain fully functional during reconnection — the user should not see any interruption or disabled state
  - [x] Update `packages/client/src/pages/PastePage.test.tsx` — add test: when status is `'reconnecting'`, the PasteEditor component is still rendered and functional

- [ ] Task 5: Run full test suite and regression check (AC: all)
  - [x] Run all existing 104 tests — zero regressions
  - [x] Verify new tests pass: expect ~112-118 tests total
  - [x] Manually verify (in dev mode): open paste, kill server, type edits, restart server, confirm edits sync and editor recovers

## Dev Notes

### Architecture Compliance

**This story is primarily a configuration and testing story.** The Yjs + y-websocket stack already provides automatic reconnection and state synchronization out of the box. The key work is:

1. **Explicit reconnection configuration** — WebsocketProvider defaults work but should be tuned for reliability
2. **New `'reconnecting'` status** — so the UI can differentiate between first connect and reconnect attempts
3. **Comprehensive reconnection tests** — the most important deliverable, proving the reconnection flow works end-to-end
4. **PastePage keeps editor active during reconnection** — critical UX requirement

**What Yjs/y-websocket already provides (DO NOT re-implement):**
- Automatic reconnection with exponential backoff (`WebsocketProvider`)
- Local edit buffering during disconnection (`Y.Doc` continues to work offline)
- Efficient delta sync on reconnection (only missing updates sent, not full doc)
- CRDT merge of concurrent edits (conflict-free by design)
- State vector comparison to determine missing updates

### File Structure — Files to Create/Modify

```
packages/
├── client/
│   └── src/
│       ├── hooks/
│       │   ├── useCollaboration.ts         # MODIFY: Add reconnection config, 'reconnecting' status
│       │   └── useCollaboration.test.ts    # MODIFY: Add reconnection tests
│       └── pages/
│           ├── PastePage.tsx               # MODIFY: Handle 'reconnecting' status (keep editor visible)
│           └── PastePage.test.tsx          # MODIFY: Add reconnecting state test
├── server/
│   └── src/
│       └── ws/
│           ├── yjs-handler.test.ts         # MODIFY: Add reconnection sync tests
│           └── document-manager.test.ts    # MODIFY: Add server-restart recovery test
```

### Critical Technical Requirements

**WebsocketProvider Reconnection Configuration:**

The `WebsocketProvider` from `y-websocket` accepts these configuration options:

```typescript
import { WebsocketProvider } from 'y-websocket'

const provider = new WebsocketProvider(wsUrl, pasteId, doc, {
  connect: true,
  awareness,
  // Reconnection tuning:
  maxBackoffTime: 10000,    // Max 10s between retry attempts (default: 2500)
  resyncInterval: 30000,    // Re-sync every 30s when connected (default: -1 = disabled)
})
```

- `maxBackoffTime`: Caps exponential backoff at 10s. The default (2500ms) is too aggressive for production. 10s balances responsiveness with server load.
- `resyncInterval`: Enables periodic re-sync while connected, catching any missed updates from brief micro-disconnects. Set to 30s as a safety net.

**Reconnecting vs Disconnected Status:**

The current `useCollaboration.ts` tracks status via provider events:

```typescript
// CURRENT (Story 2.1):
provider.on('status', ({ status }: { status: string }) => {
  if (status === 'connected') setConnectionStatus('connected')
  else if (status === 'connecting') setConnectionStatus('connecting')
  else setConnectionStatus('disconnected')
})
```

**NEW implementation** must track whether the provider was previously connected:

```typescript
// Track if we've been connected before
let wasConnected = false

provider.on('status', ({ status }: { status: string }) => {
  if (status === 'connected') {
    wasConnected = true
    setConnectionStatus('connected')
  } else if (status === 'connecting') {
    // First connection attempt vs reconnection
    setConnectionStatus(wasConnected ? 'reconnecting' : 'connecting')
  } else {
    setConnectionStatus('disconnected')
  }
})
```

This `wasConnected` flag must be scoped to the provider lifecycle (reset when provider is destroyed/recreated for a new pasteId).

**PastePage Reconnecting Behavior:**

Currently `PastePage.tsx` renders the editor only when `status === 'connected'`. During reconnection, the editor MUST stay visible and editable:

```typescript
// CURRENT behavior (approximate):
if (status === 'connecting') return <SkeletonLoader />
if (status === 'disconnected') return <DisconnectedMessage />
if (status === 'not-found') return <NotFoundMessage />
// Only renders editor when connected

// NEW behavior:
if (status === 'connecting') return <SkeletonLoader />
if (status === 'not-found') return <NotFoundMessage />
// Render editor for both 'connected' AND 'reconnecting'
// 'disconnected' should also keep editor visible (user can still see/copy content)
```

**IMPORTANT:** The `'disconnected'` state currently shows a "Connection lost" message and hides the editor. This should be changed so the editor remains visible even when disconnected — the user's local Yjs doc still has the content. Only add a subtle indicator that the connection is lost. The ConnectionStatus component (Story 3.2) will handle the visual indicator; for now, keep the editor visible in all post-initial-connect states.

**Server-Side: No Changes Needed**

The server already handles reconnection correctly:
- `yjs-handler.ts` sends sync step 1 + step 2 on every new WebSocket connection (lines 46-66)
- `document-manager.ts` loads from PostgreSQL when in-memory doc is missing (covers server restart)
- The Yjs sync protocol automatically reconciles state vectors between client and server

The only server-side work is **adding tests** to prove these flows work for reconnection scenarios.

### Previous Story Intelligence (Story 2.3)

**Key learnings to apply:**

1. **Test count:** Story 2.3 ended with 104 tests across 19 test files. Expect ~112-118 after this story.

2. **ESM imports:** All server imports use `.js` extensions. Follow this pattern in any server test modifications.

3. **injectWS testing pattern:** For server-side WebSocket tests, follow the pattern in `yjs-handler.test.ts` which uses `app.injectWS('/ws/' + pasteId)`.

4. **Current useCollaboration status code (Story 2.1):**
   ```typescript
   provider.on('status', ({ status }: { status: string }) => {
     if (status === 'connected') {
       setConnectionStatus('connected')
       // Color assignment happens here
     } else if (status === 'connecting') {
       setConnectionStatus('connecting')
     } else {
       setConnectionStatus('disconnected')
     }
   })
   ```
   Extend this — don't replace it. The color assignment on `'connected'` must remain.

5. **Current PastePage rendering logic:**
   - `'connecting'`: Shows animated skeleton loader
   - `'connected'`: Renders PasteEditor with Yjs objects
   - `'disconnected'`: Shows "Connection lost" message with link to create new paste
   - `'not-found'`: Shows "Paste not found" message

   Change `'disconnected'` to keep the editor visible. Add `'reconnecting'` to also keep editor visible.

6. **4404 close code handling:** `useCollaboration.ts` already handles the `4404` close code (paste not found) by setting `provider.shouldConnect = false`. This must be preserved — reconnection should NOT attempt to reconnect to a non-existent paste.

7. **Provider cleanup pattern:** The effect cleanup in `useCollaboration.ts` destroys provider, undo manager, awareness, and doc. This correctly resets `wasConnected` since a new provider is created for each pasteId.

### Git Intelligence

Recent commits:
- `d3c7265 fix: resolve dotenv path to monorepo root for server config`
- `4cc14b5 feat: Story 2.3 — collaborator cursor presence with code review fixes`
- `58ce74f feat: Story 2.2 — concurrent multi-user editing with code review fixes`
- `110f0de feat: Story 2.1 — real-time document sync with Yjs & WebSocket with code review fixes`

Pattern: `feat: Story X.Y — description with code review fixes`

### Library Versions (Already Installed)

All required libraries are already installed from Stories 2.1-2.3:

| Package | Version | Location |
|---------|---------|----------|
| yjs | ^13.6 | server + client |
| y-protocols | ^1.0 | server |
| y-websocket | ^3.0 | client |
| y-codemirror.next | ^0.3.5 | client |
| @codemirror/view | ^6.0 | client |

No new dependencies are needed for this story.

### What This Story Does NOT Include

- No ConnectionStatus component (green/amber/red dot) — that's Story 3.2
- No inline "Reconnecting..." message after 30s — that's Story 3.2
- No graceful disconnection cleanup — that's Story 3.2
- No `prefers-reduced-motion` for reconnection animations — that's Story 3.2
- No responsive layout changes — that's Story 4.1
- No new server-side code — only new server-side tests
- No custom WebSocket protocol — Yjs handles everything
- No custom retry logic — y-websocket's built-in exponential backoff is sufficient

### Testing Strategy

**Client Hook Tests (modified):**
- `useCollaboration.test.ts`:
  - Test `'reconnecting'` status fires when provider reconnects after prior connection
  - Test that initial connection still shows `'connecting'` (not `'reconnecting'`)
  - Test that `wasConnected` logic resets on provider recreation (pasteId change)
  - Test that local edits survive a disconnect/reconnect cycle (Yjs doc integrity)
  - Test that 4404 handling still prevents reconnection

**Client Page Tests (modified):**
- `PastePage.test.tsx`:
  - Test that editor remains visible during `'reconnecting'` status
  - Test that editor remains visible during `'disconnected'` status (changed from current behavior)
  - Test that skeleton loader only shows during initial `'connecting'`

**Server Integration Tests (modified):**
- `yjs-handler.test.ts`:
  - Test: client connects → edits → disconnects → reconnects → receives current doc state
  - Test: two clients, one disconnects, other edits, first reconnects → first receives missed edits
- `document-manager.test.ts`:
  - Test: doc persisted → cache cleared (simulating restart) → new client connects → doc loaded from DB correctly

**Test approach:** Mock WebsocketProvider status events for client tests. Use `app.injectWS()` for server tests. Co-locate all test files per project convention.

### Project Structure Notes

- No new files created — only modifications to existing files
- No new directories needed
- No new dependencies needed
- All changes are in existing component/hook/test files

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1: Auto-Reconnection & State Synchronization]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns — WebSocket Protocol]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture — Collaboration Hook]
- [Source: _bmad-output/planning-artifacts/architecture.md#Connection Management (FR11-FR14)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#ConnectionStatus Component]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Invisible Reconnection]
- [Source: _bmad-output/planning-artifacts/prd.md#FR12, FR13, NFR8, NFR9, NFR10, NFR11]
- [Source: _bmad-output/implementation-artifacts/2-3-collaborator-cursor-presence.md]
- [Source: _bmad-output/implementation-artifacts/2-1-real-time-document-sync-with-yjs-and-websocket.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Task 1: Added `maxBackoffTime: 10000` and `resyncInterval: 30000` to WebsocketProvider config. Added `'reconnecting'` to ConnectionStatus type. Implemented `wasConnected` tracking to distinguish initial connection from reconnection attempts. 7 new tests.
- Task 2: Verified Yjs offline edit buffering (built-in behavior). Added integration test proving local edits survive disconnect/reconnect cycle. Added server-side test proving reconnecting client receives missed edits from other clients.
- Task 3: Added document-manager test for server restart recovery (cache cleared → doc reloaded from DB). Added yjs-handler test for full sync cycle after server restart.
- Task 4: Updated PastePage to keep editor visible during `'reconnecting'` and `'disconnected'` states. Only initial `'connecting'` shows skeleton loader. Removed "Connection lost" disconnect screen — editor stays visible with local Yjs doc content. 3 new/updated PastePage tests.
- Task 5: Full test suite: 115 tests across 19 files, zero regressions. Up from 104 tests (+11 new).

### Change Log

- 2026-03-17: Story 3.1 implementation complete — auto-reconnection config, reconnecting status, editor stays visible during disconnect/reconnect, comprehensive reconnection tests (client + server)

### File List

- packages/client/src/hooks/useCollaboration.ts (modified)
- packages/client/src/hooks/useCollaboration.test.ts (modified)
- packages/client/src/pages/PastePage.tsx (modified)
- packages/client/src/pages/PastePage.test.tsx (modified)
- packages/server/src/ws/yjs-handler.test.ts (modified)
- packages/server/src/ws/document-manager.test.ts (modified)
