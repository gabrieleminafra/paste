---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
workflowType: 'architecture'
project_name: 'pastebin'
user_name: 'Gabriele'
date: '2026-03-16'
lastStep: 8
status: 'complete'
completedAt: '2026-03-16'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
19 requirements across 4 domains:
- **Paste Management (FR1-FR5):** CRUD operations for plain text pastes with unique shareable links and indefinite persistence. Architecturally straightforward — standard REST/HTTP for creation and retrieval.
- **Real-Time Collaboration (FR6-FR10):** Simultaneous editing by up to 10 users with conflict-free resolution, real-time text sync, and cursor presence. This is the architectural centerpiece — requires CRDT integration, WebSocket communication layer, and careful state management across clients.
- **Connection Management (FR11-FR14):** WebSocket lifecycle including automatic reconnection and state synchronization after disconnects. Implies the server must track document state authoritatively and support catch-up sync.
- **Paste Access (FR15-FR19):** Read access, clipboard copy, cross-browser and cross-device access via persistent URLs, and a creation interface at root URL. Standard web delivery — no auth gates.

**Non-Functional Requirements:**
- **Performance:** Paste creation <1s, paste load <2s, edit propagation <1s, cursor updates <500ms, 10 concurrent editors per paste. These are modest targets achievable with a well-structured WebSocket layer and efficient CRDT operations.
- **Security:** Unguessable paste IDs (sufficient randomness to prevent enumeration), TLS for all communication (HTTPS + WSS). No auth-related security concerns.
- **Reliability:** Persistent storage survives restarts (rules out in-memory-only storage), automatic reconnection, consistent state after reconnection, concurrent edits never cause corruption.

**Scale & Complexity:**
- Primary domain: Full-stack web (SPA client + WebSocket/HTTP server + persistent storage)
- Complexity level: Medium
- Estimated architectural components: ~5 (SPA client, HTTP API, WebSocket server, CRDT sync engine, persistent storage)

### Technical Constraints & Dependencies

- **CRDT library dependency:** The PRD explicitly recommends Yjs or Automerge for conflict-free editing rather than building from scratch. This is a foundational dependency that shapes client and server architecture.
- **No authentication infrastructure:** Simplifies backend significantly but means all pastes are publicly accessible to anyone with the link. Paste ID entropy is the only access control mechanism.
- **WebSocket requirement:** Real-time features mandate persistent connections, which affects server hosting choices (must support long-lived connections, not just request/response).
- **Persistent storage:** Pastes must survive server restarts. CRDT document state must be persistable and recoverable.
- **Browser-only client:** SPA with no SSR requirement (no SEO needs). Lightweight bundle is a stated design goal.

### Cross-Cutting Concerns Identified

- **CRDT state management:** Touches the client editor, WebSocket sync layer, and persistent storage. The CRDT document is the single source of truth and must flow consistently across all three.
- **Connection lifecycle:** Affects client UX (status indicators, cursor presence), server resource management (connection tracking, cleanup), and data consistency (catch-up sync on reconnect).
- **Paste identity and routing:** The paste ID is the key for URL routing (client), API access (HTTP), WebSocket room assignment (sync), and storage retrieval. It must be generated with sufficient entropy and handled consistently across all layers.
- **Error resilience:** Network failures, server restarts, and stale clients must all resolve gracefully without data loss — this concern spans every layer of the system.

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web application (SPA + WebSocket server + persistent storage) based on project requirements analysis.

### Technology Preferences

- **Language:** TypeScript (client and server)
- **Frontend framework:** React
- **Backend framework:** Fastify
- **Database:** PostgreSQL
- **Deployment:** Self-hosted on Docker

### Starter Options Considered

**Option 1: Community full-stack monorepo starters** (ts-rest-workspace, fuelstack, etc.)
- Pre-configured Fastify + Vite + workspaces with shared packages
- Rejected: ship with opinionated dependencies (ts-rest, react-query, auth) that add weight and complexity to a deliberately simple product. Time saved on setup is lost on removal.

**Option 2: Official Vite `react-ts` template only**
- Clean, minimal React + TypeScript client scaffold
- Rejected as sole starter: no monorepo structure, no shared types, still requires full manual server setup. Useful as a component of Option 3.

**Option 3: Custom npm workspaces monorepo** (selected)
- Scaffold client from official Vite `react-ts` template
- Hand-build Fastify server package with TypeScript
- npm workspaces for dependency management and shared types
- Zero unnecessary dependencies, full architectural control

### Selected Starter: Custom npm Workspaces Monorepo

**Rationale for Selection:**
The project has a small surface area with specific technical needs (CRDT sync, WebSocket). No community starter aligns closely enough to justify its overhead. A custom monorepo using the official Vite template for the client and a hand-built Fastify server gives full control over the architecture with zero unnecessary dependencies — matching the product's philosophy of radical simplicity.

**Initialization Command:**

```bash
# Create monorepo root
mkdir pastebin && cd pastebin
npm init -y

# Scaffold client from official Vite template
npm create vite@latest packages/client -- --template react-ts

# Create server package
mkdir -p packages/server/src
```

Then configure `package.json` with `"workspaces": ["packages/*"]` and set up shared TypeScript configuration.

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript 5.x across all packages (strict mode)
- Node.js 22+ (LTS, required by Vite 8 and modern Fastify)
- ESM throughout (no CommonJS)

**Styling Solution:**
- Tailwind CSS v4.2 — utility-first, configured in client package
- No component library — 7 custom components built from primitives (per UX spec)

**Build Tooling:**
- Vite 8 (Rolldown-based) for client bundling — up to 10-30x faster builds
- TypeScript compiler (`tsc`) for server — simple, no bundler needed for Node.js
- npm workspaces for dependency hoisting and cross-package scripts

**Testing Framework:**
- Vitest 4.1 for both client and server — native Vite integration, fast execution
- Shared test configuration at monorepo root

**Code Organization:**
```
pastebin/
├── package.json              # Workspaces root
├── tsconfig.base.json        # Shared TS config
├── docker-compose.yml        # PostgreSQL + app services
├── Dockerfile                # Multi-stage build
├── packages/
│   ├── client/               # Vite + React SPA
│   │   ├── src/
│   │   │   ├── components/   # 7 UX components
│   │   │   ├── lib/          # Yjs integration, WebSocket client
│   │   │   └── App.tsx
│   │   ├── package.json
│   │   └── vite.config.ts
│   ├── server/               # Fastify API + WebSocket
│   │   ├── src/
│   │   │   ├── routes/       # HTTP routes (paste CRUD)
│   │   │   ├── ws/           # WebSocket handlers (Yjs sync)
│   │   │   ├── db/           # Drizzle schema + queries
│   │   │   └── app.ts
│   │   └── package.json
│   └── shared/               # Shared TypeScript types
│       ├── src/
│       │   └── types.ts
│       └── package.json
```

**Development Experience:**
- Vite dev server with HMR for client
- `tsx` watch mode for server development
- Concurrent dev script at monorepo root
- Single `docker compose up` for PostgreSQL in development

**Key Dependencies (verified current versions):**

| Package | Version | Purpose |
|---|---|---|
| Vite | 8.0 | Client build tooling (Rolldown engine) |
| React | 19.x | UI framework |
| Fastify | 5.8 | HTTP server |
| @fastify/websocket | 11.2 | WebSocket support |
| Yjs | 13.6 | CRDT for collaborative editing |
| y-websocket | 3.0 | Yjs WebSocket sync provider |
| Drizzle ORM | 0.45 | Type-safe PostgreSQL queries |
| Tailwind CSS | 4.2 | Utility-first styling |
| Vitest | 4.1 | Testing framework |

**Note:** Project initialization using this structure should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Data model: single `pastes` table with CRDT binary state
- Yjs for CRDT with CodeMirror 6 editor binding
- WebSocket via @fastify/websocket for real-time sync
- PostgreSQL for persistent storage via Drizzle ORM
- Fastify serves both API and static SPA bundle

**Important Decisions (Shape Architecture):**
- nanoid for paste ID generation (126 bits entropy)
- Rate limiting on paste creation via @fastify/rate-limit
- Pino structured logging (built into Fastify)
- React Router for client-side routing (2 routes)
- No global state library — Yjs document is the shared state

**Deferred Decisions (Post-MVP):**
- Redis for horizontal scaling (Yjs doc sync between instances)
- API documentation (Swagger/OpenAPI)
- External monitoring/alerting
- CI/CD pipeline specifics

### Data Architecture

**Database:** PostgreSQL 17, accessed via Drizzle ORM 0.45

**Schema:** Single `pastes` table:
- `id` — nanoid string, primary key (21 chars, URL-safe, cryptographically random)
- `content` — `bytea` column storing Yjs document binary state
- `created_at` — timestamp with time zone
- `updated_at` — timestamp with time zone

**Persistence Strategy:**
- Active Yjs documents live in server memory during collaboration sessions
- Persist to PostgreSQL on debounced interval (5 seconds of inactivity) and on last client disconnect
- On paste load: read binary state from PostgreSQL, initialize Yjs document in memory
- No Redis — in-memory caching is sufficient for single-instance MVP

**Migrations:** Drizzle Kit (`drizzle-kit generate` / `drizzle-kit migrate`). Run as separate step in production Docker builds.

### Authentication & Security

**Authentication:** None — no user accounts, sessions, or tokens

**Authorization:** None — paste link is the access credential

**Paste ID Security:** nanoid (21 characters, ~126 bits entropy) prevents enumeration and guessing

**API Security:**
- Rate limiting on `POST /api/pastes` via `@fastify/rate-limit` to prevent creation abuse
- Input size limit on paste content (1MB max)
- TLS enforced at reverse proxy level (HTTPS + WSS)

### API & Communication Patterns

**HTTP API (REST):**
- `POST /api/pastes` — create paste, returns `{ id: string }`
- `GET /api/pastes/:id` — retrieve paste content for initial page load
- `GET /api/health` — health check for Docker and uptime monitoring

**WebSocket:**
- `GET /ws/:pasteId` — upgrades to WebSocket, Yjs sync protocol
- Handles document sync, awareness (cursor presence), and reconnection
- No custom WebSocket protocol — Yjs y-websocket handles encoding/decoding

**Error Handling:**
- Standard HTTP status codes (201, 404, 429, 500)
- JSON error responses: `{ "message": string }`
- WebSocket errors trigger client-side automatic reconnection

### Frontend Architecture

**State Management:**
- No global state library — Yjs document is the shared state
- React `useState` for local UI concerns (copy feedback, connection status)
- Yjs `WebsocketProvider` manages connection state and awareness

**Editor:** CodeMirror 6 with `y-codemirror.next` Yjs binding
- Production-grade text editor with native CRDT integration
- Remote cursor rendering via Yjs awareness protocol
- Monospace editing, lightweight

**Routing:** React Router — two routes:
- `/` — create page (editor + CreateButton)
- `/:pasteId` — paste page (editor + ShareLink + ConnectionStatus)

**Collaboration Hook:** `useCollaboration(pasteId)` custom hook wires up Yjs document, WebsocketProvider, and awareness. Returns document state, connection status, and connected users.

**Bundle Optimization:**
- Vite 8 tree-shaking and code splitting
- Lazy-load collaboration layer (Yjs + CodeMirror) on paste page
- Create page stays ultra-light

### Infrastructure & Deployment

**Docker Architecture:**
- Multi-stage Dockerfile: build stage (compile TS, bundle client) → production stage (Node.js 22 Alpine)
- `docker-compose.yml` with two services: `app` (Fastify) + `postgres` (PostgreSQL 17 with named volume)
- Fastify serves static SPA bundle via `@fastify/static` — single app container

**Environment Configuration:**
- `.env` file loaded by Docker Compose
- Variables: `DATABASE_URL`, `PORT`, `NODE_ENV`
- Validated at startup via `@fastify/env`

**TLS:** Handled by external reverse proxy (Traefik/nginx/Caddy) — not included in docker-compose

**Logging:** Fastify's built-in Pino logger — structured JSON, zero setup

**Scaling:** Single instance for MVP. Horizontal scaling (post-MVP) would add Redis for cross-instance Yjs document sync.

### Decision Impact Analysis

**Implementation Sequence:**
1. Monorepo scaffolding (npm workspaces, shared TS config)
2. PostgreSQL + Drizzle schema + Docker Compose
3. Fastify server with HTTP routes (paste CRUD)
4. Yjs + WebSocket integration on server
5. React SPA with CodeMirror + Yjs client
6. Docker production build
7. Integration testing

**Cross-Component Dependencies:**
- Yjs is the central dependency — it connects the editor (CodeMirror binding), the sync layer (WebSocket provider), and persistence (binary state to PostgreSQL)
- Paste ID flows through every layer: URL routing → HTTP API → WebSocket room → database key
- Connection lifecycle management spans client (status indicators, reconnect) and server (room cleanup, persistence trigger)

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 5 categories where AI agents could make different choices — naming, structure, format, communication, and process patterns.

### Naming Patterns

**Database Naming Conventions:**
- Tables: `snake_case`, plural — `pastes`
- Columns: `snake_case` — `created_at`, `updated_at`
- Primary keys: `id` (no table prefix)
- Indexes: `idx_<table>_<column>` — `idx_pastes_created_at`
- PostgreSQL convention, Drizzle ORM default

**API Naming Conventions:**
- Endpoints: plural nouns, `kebab-case` — `/api/pastes`, `/api/health`
- Route parameters: `:camelCase` — `:pasteId`
- JSON fields: `camelCase` — `{ id, createdAt, updatedAt }`
- Drizzle maps `snake_case` DB columns to `camelCase` at the application layer

**Code Naming Conventions:**
- React components: `PascalCase` files and exports — `PasteEditor.tsx`, `ShareLink.tsx`
- Utilities/modules: `kebab-case.ts` — `paste-service.ts`, `db-client.ts`
- Functions/variables: `camelCase` — `createPaste()`, `pasteId`
- Types/interfaces: `PascalCase` — `Paste`, `ConnectionStatus`, `ApiResponse<T>`
- Constants: `UPPER_SNAKE_CASE` — `MAX_PASTE_SIZE`, `WS_RECONNECT_INTERVAL`
- Hooks: `camelCase` prefixed with `use` — `useCollaboration.ts`

### Structure Patterns

**Project Organization:**
- Tests: co-located with source files — `PasteEditor.test.tsx` beside `PasteEditor.tsx`, `pastes.test.ts` beside `pastes.ts`
- Components: flat structure in `components/` — only 7 components, no nesting
- Each component is a single file (no `component/index.ts` barrel pattern)
- Custom hooks in `hooks/` directory
- Shared types in `packages/shared/src/types.ts`

**File Structure Patterns:**
- Config files at package root (`vite.config.ts`, `drizzle.config.ts`)
- Environment files at monorepo root (`.env`, `.env.example`)
- Docker files at monorepo root (`Dockerfile`, `docker-compose.yml`)
- No `src/utils/` catch-all — if a utility is specific to a domain, it lives in that domain's directory

### Format Patterns

**API Response Envelope:**

All HTTP API responses use a consistent envelope:

```typescript
// Shared type in packages/shared
type ApiResponse<T> = {
  data: T;
  error: null;
} | {
  data: null;
  error: { message: string; code: string };
}
```

Success examples:
```json
// POST /api/pastes → 201
{ "data": { "id": "abc123" }, "error": null }

// GET /api/pastes/:id → 200
{ "data": { "id": "abc123", "content": "...", "createdAt": "2026-03-16T14:30:00.000Z", "updatedAt": "2026-03-16T14:30:00.000Z" }, "error": null }
```

Error examples:
```json
// 404
{ "data": null, "error": { "message": "Paste not found", "code": "PASTE_NOT_FOUND" } }

// 429
{ "data": null, "error": { "message": "Too many requests", "code": "RATE_LIMITED" } }

// 500
{ "data": null, "error": { "message": "Internal server error", "code": "INTERNAL_ERROR" } }
```

**Error codes:** `UPPER_SNAKE_CASE` string constants — `PASTE_NOT_FOUND`, `RATE_LIMITED`, `VALIDATION_ERROR`, `INTERNAL_ERROR`

**Data Exchange Formats:**
- Dates: ISO 8601 strings in API responses (`2026-03-16T14:30:00.000Z`)
- IDs: string type everywhere (nanoid produces strings)
- Nulls: explicit `null` in JSON, never `undefined`
- Binary data (Yjs state): not exposed via HTTP API — internal to server persistence layer

### Communication Patterns

**WebSocket Protocol:**
- No custom protocol — Yjs y-websocket handles all message encoding/decoding
- Awareness protocol handles cursor presence (position, client ID)
- Room naming: paste ID is the room name (1:1 mapping)

**State Management Patterns:**
- Yjs document is the single source of truth for paste content — never duplicated in React state
- React components subscribe to Yjs document via CodeMirror binding — no manual sync
- Local UI state uses `useState` — connection status, copy button feedback, loading state
- No global state store — each component owns its UI state

### Process Patterns

**Error Handling:**
- Server: Fastify `setErrorHandler` plugin wraps all errors in the API envelope format, logs via Pino
- Client: React Error Boundary at route level catches render errors, shows simple fallback
- WebSocket: Yjs provider handles reconnection automatically — no custom error handling needed
- 404 paste: simple centered message "Paste not found" with link to create new paste

**Loading States:**
- Status enum pattern: `'idle' | 'loading' | 'ready' | 'error'`
- Each concern manages its own status — no global loading state
- Paste page: show editor container immediately, content area shows skeleton until loaded
- No full-page spinners — content-first loading per UX spec

**Logging:**
- Server: Pino structured JSON with levels:
  - `info` — HTTP requests (automatic via Fastify), paste created, WebSocket connections
  - `warn` — rate limited requests, oversized payloads rejected
  - `error` — database failures, uncaught exceptions, persistence failures
- Client: `console.warn` / `console.error` only — no logging library

### Enforcement Guidelines

**All AI Agents MUST:**
- Use the naming conventions defined above — no exceptions
- Wrap all HTTP responses in the `ApiResponse<T>` envelope
- Co-locate tests with source files
- Use the shared types from `packages/shared` for any cross-package contracts
- Never introduce global state libraries — Yjs is the shared state
- Never add `src/utils/` catch-all directories

**Pattern Verification:**
- TypeScript strict mode catches type mismatches across packages
- ESLint with naming convention rules enforces casing
- Shared `ApiResponse<T>` type makes envelope violations a compile error

## Project Structure & Boundaries

### Complete Project Directory Structure

```
pastebin/
├── .env.example                          # Environment variable template
├── .gitignore
├── docker-compose.yml                    # PostgreSQL + app services
├── Dockerfile                            # Multi-stage production build
├── package.json                          # Workspaces root, shared scripts
├── tsconfig.base.json                    # Shared TypeScript config
│
├── packages/
│   ├── client/                           # Vite + React SPA
│   │   ├── index.html                    # Vite entry HTML
│   │   ├── package.json
│   │   ├── tsconfig.json                 # Extends base, client-specific
│   │   ├── vite.config.ts
│   │   ├── public/
│   │   │   └── favicon.svg
│   │   └── src/
│   │       ├── main.tsx                  # React DOM entry point
│   │       ├── App.tsx                   # Router setup
│   │       ├── App.css                   # Tailwind imports
│   │       ├── components/
│   │       │   ├── ConnectionStatus.tsx  # WebSocket health dot
│   │       │   ├── ConnectionStatus.test.tsx
│   │       │   ├── CreateButton.tsx      # Paste creation trigger
│   │       │   ├── CreateButton.test.tsx
│   │       │   ├── CursorIndicator.tsx   # Remote collaborator cursors
│   │       │   ├── CursorIndicator.test.tsx
│   │       │   ├── PageHeader.tsx        # Top bar with ShareLink
│   │       │   ├── PageHeader.test.tsx
│   │       │   ├── PasteEditor.tsx       # CodeMirror + Yjs binding
│   │       │   ├── PasteEditor.test.tsx
│   │       │   ├── PlaceholderState.tsx  # Empty editor placeholder
│   │       │   ├── PlaceholderState.test.tsx
│   │       │   ├── ShareLink.tsx         # URL display + copy button
│   │       │   └── ShareLink.test.tsx
│   │       ├── hooks/
│   │       │   ├── useCollaboration.ts   # Yjs doc + WebSocket provider + awareness
│   │       │   └── useCollaboration.test.ts
│   │       └── pages/
│   │           ├── CreatePage.tsx        # Route: / — editor + CreateButton
│   │           ├── CreatePage.test.tsx
│   │           ├── PastePage.tsx         # Route: /:pasteId — editor + header + status
│   │           ├── PastePage.test.tsx
│   │           ├── NotFoundPage.tsx      # 404 fallback
│   │           └── NotFoundPage.test.tsx
│   │
│   ├── server/                           # Fastify API + WebSocket
│   │   ├── package.json
│   │   ├── tsconfig.json                 # Extends base, server-specific
│   │   ├── drizzle.config.ts             # Drizzle Kit config
│   │   └── src/
│   │       ├── index.ts                  # Server entry point (start + listen)
│   │       ├── app.ts                    # Fastify app factory (plugins, routes)
│   │       ├── app.test.ts
│   │       ├── config.ts                 # Environment validation (@fastify/env)
│   │       ├── db/
│   │       │   ├── client.ts             # Drizzle client instance
│   │       │   ├── schema.ts             # Drizzle table definitions (pastes)
│   │       │   └── migrations/           # Generated by drizzle-kit
│   │       ├── routes/
│   │       │   ├── pastes.ts             # POST /api/pastes, GET /api/pastes/:id
│   │       │   ├── pastes.test.ts
│   │       │   ├── health.ts             # GET /api/health
│   │       │   └── health.test.ts
│   │       └── ws/
│   │           ├── yjs-handler.ts        # WebSocket route, Yjs sync protocol
│   │           ├── yjs-handler.test.ts
│   │           ├── document-manager.ts   # In-memory Yjs docs, persistence logic
│   │           └── document-manager.test.ts
│   │
│   └── shared/                           # Shared TypeScript types
│       ├── package.json
│       ├── tsconfig.json                 # Extends base
│       └── src/
│           ├── types.ts                  # ApiResponse<T>, Paste, ErrorCode
│           └── types.test.ts
```

### Architectural Boundaries

**API Boundaries:**
- HTTP API (`/api/*`) — Fastify routes handle request validation, call DB/service layer, return `ApiResponse<T>` envelope
- WebSocket (`/ws/:pasteId`) — Yjs protocol only, no custom messages cross this boundary
- Static files (`/*`) — `@fastify/static` serves the built SPA, falls back to `index.html` for client-side routing

**Component Boundaries:**
- `packages/client` depends on `packages/shared` (types only)
- `packages/server` depends on `packages/shared` (types only)
- `packages/shared` has zero dependencies — pure TypeScript types
- Client never imports server code; server never imports client code

**Data Boundaries:**
- Only `packages/server/src/db/` accesses PostgreSQL directly
- Only `packages/server/src/ws/document-manager.ts` manages in-memory Yjs documents
- Routes and WebSocket handlers call `document-manager` for Yjs state — never access DB directly for CRDT operations
- Client receives paste data via HTTP (initial load) and WebSocket (real-time sync) — never queries DB

### Requirements to Structure Mapping

**Paste Management (FR1-FR5):**
- Server: `packages/server/src/routes/pastes.ts` (HTTP CRUD)
- Server: `packages/server/src/db/schema.ts` (Drizzle schema)
- Client: `packages/client/src/pages/CreatePage.tsx`, `packages/client/src/pages/PastePage.tsx`
- Client: `packages/client/src/components/CreateButton.tsx`, `packages/client/src/components/ShareLink.tsx`

**Real-Time Collaboration (FR6-FR10):**
- Server: `packages/server/src/ws/yjs-handler.ts` (WebSocket + Yjs sync)
- Server: `packages/server/src/ws/document-manager.ts` (in-memory Yjs docs, persistence triggers)
- Client: `packages/client/src/hooks/useCollaboration.ts` (Yjs + WebSocket provider setup)
- Client: `packages/client/src/components/PasteEditor.tsx` (CodeMirror + Yjs binding)
- Client: `packages/client/src/components/CursorIndicator.tsx`

**Connection Management (FR11-FR14):**
- Server: `packages/server/src/ws/yjs-handler.ts` (connection tracking, cleanup)
- Server: `packages/server/src/ws/document-manager.ts` (persist on disconnect)
- Client: `packages/client/src/hooks/useCollaboration.ts` (reconnect handling)
- Client: `packages/client/src/components/ConnectionStatus.tsx`

**Paste Access (FR15-FR19):**
- Client: `packages/client/src/pages/CreatePage.tsx` (root URL entry point)
- Client: `packages/client/src/pages/PastePage.tsx` (paste URL view/edit)
- Client: `packages/client/src/components/PageHeader.tsx`

### Data Flow

```
Client (Browser)                         Server (Fastify)                    PostgreSQL
─────────────────                        ────────────────                    ──────────
                    POST /api/pastes →
CreatePage          ─────────────────→   routes/pastes.ts  ──────────────→  INSERT paste
  ← { data: { id } }                    (nanoid, init Yjs doc)

                    navigate(/:pasteId)
PastePage           GET /api/pastes/:id →
  useCollaboration  ─────────────────→   routes/pastes.ts  ──────────────→  SELECT paste
  ← { data: paste }

                    WS /ws/:pasteId →
  WebsocketProvider ═════════════════→   ws/yjs-handler.ts
  ↕ Yjs sync msgs   ←═══════════════    ↕ document-manager.ts ──(debounce)→ UPDATE paste
  ↕ awareness msgs                       ↕ (in-memory Yjs doc)
```

### Development Workflow Integration

**Development servers:**
- `npm run dev` at root runs concurrently:
  - `packages/client`: Vite dev server (port 5173) with proxy to API
  - `packages/server`: `tsx watch src/index.ts` (port 3000)
  - PostgreSQL: via `docker compose up postgres`

**Build process:**
- `npm run build` at root:
  - `packages/shared`: `tsc` compiles types
  - `packages/client`: `vite build` → `packages/client/dist/`
  - `packages/server`: `tsc` → `packages/server/dist/`

**Production Docker:**
- Build stage: installs deps, builds all packages
- Production stage: copies server dist + client dist, runs `node packages/server/dist/index.js`
- Fastify serves `packages/client/dist/` via `@fastify/static`

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:**
All technology choices are verified compatible:
- Vite 8 + React 19 + TypeScript 5 — standard, well-tested combination
- Fastify 5.8 + @fastify/websocket 11.2 — official plugin, first-class support
- Yjs 13.6 + y-websocket 3.0 + y-codemirror.next — maintained ecosystem, designed to work together
- Drizzle ORM 0.45 + PostgreSQL 17 — native support, `bytea` column for Yjs binary state
- Tailwind CSS 4.2 + Vite 8 — built-in PostCSS integration
- No version conflicts or contradictory decisions detected

**Pattern Consistency:**
- Naming conventions align with technology defaults (Drizzle snake_case DB → camelCase API, React PascalCase components)
- Co-located test pattern works naturally with Vitest
- API envelope type in shared package is enforced by TypeScript strict mode
- Structure patterns match monorepo best practices for npm workspaces

**Structure Alignment:**
- Project structure supports all architectural decisions with clear package boundaries
- Integration points are well-defined (shared types, HTTP API, WebSocket protocol)
- Build and deployment pipeline maps cleanly to Docker multi-stage build

### Requirements Coverage Validation

**Functional Requirements Coverage: 19/19 (100%)**

| FR | Requirement | Architectural Support |
|---|---|---|
| FR1-FR2 | Create/edit paste | `routes/pastes.ts` + `CreatePage`/`PastePage` |
| FR3-FR4 | Unique link, access via link | nanoid generation + React Router `/:pasteId` |
| FR5 | Persistent storage | PostgreSQL `pastes` table, no expiration |
| FR6-FR8 | Concurrent editing, real-time sync, conflict-free | Yjs CRDT + `document-manager.ts` + `yjs-handler.ts` |
| FR9 | Cursor presence | Yjs awareness protocol + `CursorIndicator.tsx` |
| FR10 | 10 concurrent editors | Single-instance server, in-memory Yjs rooms |
| FR11-FR12 | WebSocket connect/reconnect | `@fastify/websocket` + Yjs `WebsocketProvider` auto-reconnect |
| FR13 | State sync on reconnect | Yjs sync protocol built-in catch-up |
| FR14 | Graceful disconnect | `document-manager.ts` connection cleanup + persistence trigger |
| FR15-FR16 | View/copy paste | `PastePage.tsx` + `ShareLink.tsx` copy button |
| FR17-FR18 | Cross-browser, persistent access | SPA in all modern browsers, PostgreSQL persistence |
| FR19 | Root URL creation interface | `CreatePage.tsx` at `/` route |

**Non-Functional Requirements Coverage: 11/11 (100%)**

| NFR | Requirement | Architectural Support |
|---|---|---|
| NFR1 | Paste creation <1s | Single HTTP POST, nanoid generation, minimal DB insert |
| NFR2 | Paste load <2s | Single DB read + Vite-optimized SPA bundle |
| NFR3 | Edit propagation <1s | Yjs WebSocket sync (binary protocol, efficient diffing) |
| NFR4 | Cursor updates <500ms | Yjs awareness protocol (lightweight, separate channel) |
| NFR5 | 10 concurrent editors | Single server instance with in-memory Yjs docs |
| NFR6 | Unguessable paste IDs | nanoid 21 chars (~126 bits entropy) |
| NFR7 | TLS encryption | External reverse proxy handles HTTPS/WSS termination |
| NFR8 | Survive restarts | PostgreSQL with named Docker volume |
| NFR9 | Auto-reconnect | Yjs `WebsocketProvider` built-in reconnect |
| NFR10 | Consistent state after reconnect | Yjs sync protocol merges missed updates |
| NFR11 | No data corruption | CRDT guarantees conflict-free convergence by design |

### Implementation Readiness Validation

**Decision Completeness:**
- All critical decisions documented with specific library versions
- API contract fully specified (endpoints, envelope format, error codes)
- Technology stack verified against current npm registry versions
- Implementation patterns comprehensive with concrete examples

**Structure Completeness:**
- Every file and directory defined with purpose annotations
- All 7 UX components mapped to specific files
- Test files co-located for every source file
- Build and deployment pipeline fully specified

**Pattern Completeness:**
- Naming conventions cover database, API, code, and file levels
- API envelope enforced via shared TypeScript type
- Error handling patterns specified for server, client, and WebSocket layers
- Loading state pattern defined with status enum

### Gap Analysis Results

**One gap identified and resolved:**

The `GET /api/pastes/:id` HTTP endpoint returns **plain text** extracted from the Yjs document (via `Y.Text.toString()`), not the binary CRDT state. This ensures:
- Content-first loading: the page shows paste content immediately before WebSocket connects
- Graceful degradation: pastes are readable even if WebSocket is temporarily unavailable
- The binary Yjs state (`bytea`) remains internal to the server persistence layer

No other gaps found. All critical, important, and nice-to-have areas are covered.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed
- [x] Security considerations addressed

**Implementation Patterns**
- [x] Naming conventions established (database, API, code, files)
- [x] Structure patterns defined (co-located tests, flat components)
- [x] Communication patterns specified (WebSocket, state management)
- [x] Process patterns documented (error handling, loading states, logging)
- [x] API response envelope defined with shared types

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established (client, server, shared)
- [x] Integration points mapped (HTTP API, WebSocket, shared types)
- [x] Requirements to structure mapping complete (all 19 FRs mapped)
- [x] Data flow documented

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High — all requirements have direct architectural support, technology choices are proven and compatible, and implementation patterns are comprehensive enough to prevent AI agent conflicts.

**Key Strengths:**
- Yjs handles the hardest problem (CRDT sync) as a well-maintained library, avoiding custom distributed systems work
- Single-instance architecture is appropriate for the modest scale (~500 users, 10 concurrent editors)
- Minimal surface area (3 HTTP endpoints, 1 WebSocket endpoint, 7 UI components) keeps complexity low
- Shared TypeScript types enforce API contracts at compile time
- Docker deployment matches the product's simplicity philosophy

**Areas for Future Enhancement (Post-MVP):**
- Redis for horizontal scaling if user count exceeds single-instance capacity
- API documentation (Swagger/OpenAPI) if the API surface grows
- External monitoring/alerting for production observability
- CI/CD pipeline definition
- Dark mode (noted in UX spec as Phase 2)
- Syntax highlighting, version history, presence sidebar (PRD Phase 2)

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and package boundaries
- Wrap all HTTP responses in the `ApiResponse<T>` envelope from `packages/shared`
- Use Yjs as the single source of truth for document state — never duplicate in React state
- Refer to this document for all architectural questions

**First Implementation Priority:**
1. Scaffold the npm workspaces monorepo with shared TypeScript config
2. Set up `docker-compose.yml` with PostgreSQL
3. Create Drizzle schema and run initial migration
4. Build Fastify server with paste CRUD routes
5. Add Yjs WebSocket handler and document manager
6. Scaffold React SPA with CodeMirror + Yjs integration
7. Build the 7 UX components
8. Create production Dockerfile
