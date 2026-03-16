# Story 1.1: Project Foundation & Paste Storage

Status: review

## Story

As a developer,
I want a working monorepo with database, Fastify server, and shared types,
So that the team can start building paste features on a solid foundation.

## Acceptance Criteria

1. **Given** the repository is cloned and dependencies are installed
   **When** I run `npm run dev` at the monorepo root
   **Then** the Fastify server starts on the configured port and the Vite dev server starts with HMR
   **And** both processes run concurrently via a root dev script

2. **Given** Docker Compose is running
   **When** the PostgreSQL 17 container starts
   **Then** a `pastes` table exists with columns: `id` (nanoid string, PK), `content` (bytea), `created_at` (timestamptz), `updated_at` (timestamptz)
   **And** the schema is managed by Drizzle ORM 0.45 with Drizzle Kit migrations

3. **Given** the server is running
   **When** I send `GET /api/health`
   **Then** I receive a 200 response wrapped in the `ApiResponse<T>` envelope from `packages/shared`

4. **Given** the monorepo structure
   **When** I inspect the project
   **Then** it uses npm workspaces with `packages/client` (Vite react-ts), `packages/server` (Fastify), and `packages/shared` (types)
   **And** TypeScript 5.x strict mode is enabled across all packages via `tsconfig.base.json`
   **And** ESM is used throughout with Node.js 22+
   **And** environment variables (`DATABASE_URL`, `PORT`, `NODE_ENV`) are validated at startup via `@fastify/env`
   **And** Pino structured logging is configured via Fastify's built-in logger

## Tasks / Subtasks

- [x] Task 1: Initialize monorepo structure (AC: #4)
  - [x] Create root `package.json` with `"workspaces": ["packages/*"]` and `"type": "module"`
  - [x] Create `tsconfig.base.json` with TypeScript 5.x strict mode, ESM, Node.js 22+ target
  - [x] Scaffold `packages/client` via `npm create vite@latest -- --template react-ts`
  - [x] Create `packages/server` with `package.json`, `tsconfig.json` extending base
  - [x] Create `packages/shared` with `package.json`, `tsconfig.json` extending base
  - [x] Configure each package's `tsconfig.json` to extend `../../tsconfig.base.json`

- [x] Task 2: Set up shared types package (AC: #3, #4)
  - [x] Create `packages/shared/src/types.ts` with `ApiResponse<T>` discriminated union type and `ErrorCode` type
  - [x] Configure package exports for ESM consumption by client and server

- [x] Task 3: Set up Docker Compose with PostgreSQL (AC: #2)
  - [x] Create `docker-compose.yml` with `postgres` service (PostgreSQL 17, named volume `pgdata`)
  - [x] Create `.env.example` with `DATABASE_URL`, `PORT`, `NODE_ENV` template values
  - [x] Create `.gitignore` covering `node_modules`, `dist`, `.env`, Drizzle migration artifacts

- [x] Task 4: Set up Drizzle ORM and database schema (AC: #2)
  - [x] Install `drizzle-orm` (0.45.x) and `drizzle-kit` in `packages/server`
  - [x] Install `postgres` (pg driver) — use `postgres` (postgres.js) or `pg` as the PostgreSQL driver
  - [x] Create `packages/server/src/db/schema.ts` with `pastes` table: `id` (text PK), `content` (bytea via `customType` or Drizzle's `bytea`), `created_at` (timestamp with timezone, default now), `updated_at` (timestamp with timezone, default now)
  - [x] Create `packages/server/drizzle.config.ts` pointing to schema and migrations directory
  - [x] Create `packages/server/src/db/client.ts` with Drizzle client instance using `DATABASE_URL`
  - [x] Run `drizzle-kit generate` to create initial migration
  - [x] Verify `drizzle-kit migrate` applies successfully against Docker PostgreSQL

- [x] Task 5: Build Fastify server with health endpoint (AC: #3, #4)
  - [x] Install `fastify` (5.8.x), `@fastify/env` (5.0.x), `@fastify/static` (9.x), `@fastify/rate-limit` (10.x)
  - [x] Create `packages/server/src/config.ts` — env validation schema for `DATABASE_URL`, `PORT` (default 3000), `NODE_ENV`
  - [x] Create `packages/server/src/app.ts` — Fastify app factory, register plugins (`@fastify/env`), enable Pino logger
  - [x] Create `packages/server/src/routes/health.ts` — `GET /api/health` returning `ApiResponse<{ status: "ok" }>` with 200
  - [x] Create `packages/server/src/index.ts` — entry point, call app factory, listen on configured port
  - [x] Register error handler wrapping all errors in `ApiResponse` envelope format

- [x] Task 6: Configure development scripts (AC: #1)
  - [x] Add `"dev"` script to `packages/server/package.json` using `tsx watch src/index.ts`
  - [x] Ensure `packages/client/package.json` has Vite dev script (comes with template)
  - [x] Add root `package.json` `"dev"` script using `concurrently` (or `npm-run-all`) to run client + server dev concurrently
  - [x] Configure Vite proxy in `packages/client/vite.config.ts` to forward `/api/*` and `/ws/*` to Fastify server (port 3000)

- [x] Task 7: Add basic tests (AC: #3)
  - [x] Install `vitest` (4.1.x) at monorepo root or per-package
  - [x] Create `packages/server/src/routes/health.test.ts` — test health endpoint returns 200 with correct envelope
  - [x] Create `packages/server/src/app.test.ts` — test app factory creates valid Fastify instance
  - [x] Create `packages/shared/src/types.test.ts` — type-level tests for `ApiResponse<T>`

## Dev Notes

### Architecture Compliance

**Monorepo structure** — MUST follow this exact layout:
```
pastebin/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json              # workspaces root
├── tsconfig.base.json        # shared TS config (strict, ESM)
├── packages/
│   ├── client/               # Vite + React SPA (scaffolded from react-ts template)
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json     # extends ../../tsconfig.base.json
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── main.tsx
│   │       └── App.tsx
│   ├── server/               # Fastify API server
│   │   ├── package.json
│   │   ├── tsconfig.json     # extends ../../tsconfig.base.json
│   │   ├── drizzle.config.ts
│   │   └── src/
│   │       ├── index.ts      # entry point (start + listen)
│   │       ├── app.ts        # Fastify app factory
│   │       ├── app.test.ts
│   │       ├── config.ts     # @fastify/env schema
│   │       ├── db/
│   │       │   ├── client.ts # Drizzle client instance
│   │       │   ├── schema.ts # Drizzle table definitions
│   │       │   └── migrations/
│   │       └── routes/
│   │           ├── health.ts
│   │           └── health.test.ts
│   └── shared/               # Pure TypeScript types
│       ├── package.json
│       ├── tsconfig.json     # extends ../../tsconfig.base.json
│       └── src/
│           ├── types.ts      # ApiResponse<T>, Paste, ErrorCode
│           └── types.test.ts
```

### Critical Technical Requirements

**TypeScript Configuration (`tsconfig.base.json`):**
- `"strict": true`
- `"target": "ES2022"` or later
- `"module": "ESNext"`, `"moduleResolution": "bundler"` or `"nodenext"`
- `"esModuleInterop": true`, `"skipLibCheck": true`
- All packages extend this base config

**ESM Throughout:**
- Every `package.json` MUST have `"type": "module"`
- Use `.ts` extensions in imports for the server (tsx handles this)
- No CommonJS — no `require()`, no `module.exports`

**`ApiResponse<T>` Type (packages/shared/src/types.ts):**
```typescript
export type ApiResponse<T> = {
  data: T;
  error: null;
} | {
  data: null;
  error: { message: string; code: string };
};
```
Error codes use `UPPER_SNAKE_CASE`: `PASTE_NOT_FOUND`, `RATE_LIMITED`, `VALIDATION_ERROR`, `INTERNAL_ERROR`

**Database Schema (`pastes` table):**
- `id` — text, primary key (nanoid 21 chars will be generated in Story 1.2)
- `content` — `bytea` column (will store Yjs binary state in Epic 2, initially stores raw text encoded to Buffer)
- `created_at` — `timestamp with time zone`, default `now()`
- `updated_at` — `timestamp with time zone`, default `now()`

**Drizzle ORM conventions:**
- Table names: `snake_case`, plural — `pastes`
- Column names: `snake_case` — `created_at`, `updated_at`
- Drizzle maps to `camelCase` at application layer automatically
- Use `drizzle-kit generate` to create SQL migrations, `drizzle-kit migrate` to apply

**Environment Variables (validated by `@fastify/env`):**
- `DATABASE_URL` — PostgreSQL connection string (required)
- `PORT` — Server port (default: 3000)
- `NODE_ENV` — `development` | `production` | `test` (default: `development`)

**Fastify Server (`app.ts`):**
- Use app factory pattern: `export async function buildApp()` returning configured Fastify instance
- Register `@fastify/env` for env validation first
- Enable Pino logger: `fastify({ logger: true })`
- Set global error handler wrapping errors in `ApiResponse` envelope
- Health route: `GET /api/health` → `{ data: { status: "ok" }, error: null }`

**docker-compose.yml:**
```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: pastebin
      POSTGRES_PASSWORD: pastebin
      POSTGRES_DB: pastebin
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**.env.example:**
```
DATABASE_URL=postgres://pastebin:pastebin@localhost:5432/pastebin
PORT=3000
NODE_ENV=development
```

### Naming Conventions (MUST Follow)

- **React components:** `PascalCase` files — `PasteEditor.tsx`
- **Utilities/modules:** `kebab-case.ts` — `paste-service.ts`, `db-client.ts`
- **Functions/variables:** `camelCase` — `createPaste()`, `pasteId`
- **Types/interfaces:** `PascalCase` — `Paste`, `ApiResponse<T>`
- **Constants:** `UPPER_SNAKE_CASE` — `MAX_PASTE_SIZE`
- **API endpoints:** plural nouns, `kebab-case` — `/api/pastes`, `/api/health`
- **JSON fields:** `camelCase` — `{ id, createdAt, updatedAt }`
- **Tests:** co-located — `health.test.ts` beside `health.ts`

### Library Versions (Verified March 2026)

| Package | Version | Purpose |
|---------|---------|---------|
| fastify | 5.8.x | HTTP server framework |
| @fastify/env | 5.0.x | Environment variable validation |
| @fastify/static | 9.x | Static file serving (used later, install now) |
| @fastify/rate-limit | 10.x | Rate limiting (used in Story 1.2, install now) |
| drizzle-orm | 0.45.x | Type-safe PostgreSQL ORM |
| drizzle-kit | latest matching 0.45.x | Migration generation and running |
| typescript | 5.x | Language |
| tsx | latest | Server dev mode (watch + run TypeScript) |
| vite | 8.x | Client build tooling |
| react | 19.x | UI framework |
| vitest | 4.1.x | Testing framework |
| concurrently | latest | Run multiple dev scripts |

**IMPORTANT:** Do NOT install Drizzle ORM v1.0 beta — stick with 0.45.x stable as specified in architecture. The v1.0 beta has breaking changes to migration folder structure and relational queries.

### What This Story Does NOT Include

- No paste CRUD routes (`POST /api/pastes`, `GET /api/pastes/:id`) — that's Story 1.2
- No React UI components beyond the default Vite template — that's Story 1.2
- No WebSocket/Yjs integration — that's Epic 2
- No Dockerfile or production build — that's Story 4.3
- No nanoid paste ID generation — that's Story 1.2
- No client-side routing (React Router) — that's Story 1.2

This story delivers the **infrastructure skeleton** — the working monorepo, database, server with health check, shared types, and dev tooling that all subsequent stories build upon.

### Vite Proxy Configuration

Configure `packages/client/vite.config.ts` to proxy API and WebSocket requests to the Fastify server during development:

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  // ... other config
});
```

### Testing Strategy

- Use Vitest 4.1.x for all tests
- Co-locate test files with source files
- For server tests, use Fastify's `inject()` method (no real HTTP needed)
- Run tests with `vitest` or `vitest run`
- Shared types can have type-level tests using `expectTypeOf` from vitest

### Project Structure Notes

- This is a greenfield project — no existing code, no conflicts
- The monorepo root has NO `src/` directory — code lives only in packages
- No `src/utils/` catch-all directories anywhere
- Each package has its own `package.json` and `tsconfig.json`
- `packages/shared` has ZERO runtime dependencies — pure TypeScript types only

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Starter Template Evaluation]
- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1]
- [Source: _bmad-output/planning-artifacts/prd.md#Additional Requirements]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- Fixed type error in error handler: added `FastifyError` type annotation
- Added `setNotFoundHandler` to wrap 404s in `ApiResponse` envelope (Fastify's default 404 bypasses `setErrorHandler`)

### Completion Notes List
- Task 1: Initialized npm workspaces monorepo with 3 packages (client, server, shared). Root tsconfig.base.json with strict mode, ES2022, ESM. Client scaffolded via Vite react-ts template.
- Task 2: Created `ApiResponse<T>` discriminated union type, `ErrorCode` union type, and `Paste` interface in shared package. Configured ESM package exports.
- Task 3: Created docker-compose.yml with PostgreSQL 17 Alpine, .env.example, and .gitignore.
- Task 4: Set up Drizzle ORM 0.45.x with postgres.js driver. Created pastes table schema (id text PK, content bytea, created_at/updated_at timestamptz). Generated and applied initial SQL migration.
- Task 5: Built Fastify 5.8.x server with app factory pattern, @fastify/env for env validation, Pino logger, health endpoint (GET /api/health), and error/404 handlers wrapping in ApiResponse envelope.
- Task 6: Configured dev scripts: tsx watch for server, Vite for client, concurrently at root. Added Vite proxy for /api and /ws.
- Task 7: Installed vitest 4.1.x. Created 3 test files (9 tests total): health endpoint test, app factory test, and type-level tests for ApiResponse/ErrorCode/Paste.

### File List
- package.json (new)
- tsconfig.base.json (new)
- docker-compose.yml (new)
- .env.example (new)
- .gitignore (new)
- packages/client/package.json (new - scaffolded)
- packages/client/tsconfig.json (new - scaffolded)
- packages/client/tsconfig.app.json (modified - extends base)
- packages/client/tsconfig.node.json (new - scaffolded)
- packages/client/vite.config.ts (modified - added proxy)
- packages/client/index.html (new - scaffolded)
- packages/client/src/main.tsx (new - scaffolded)
- packages/client/src/App.tsx (new - scaffolded)
- packages/client/src/App.css (new - scaffolded)
- packages/client/src/index.css (new - scaffolded)
- packages/client/eslint.config.js (new - scaffolded)
- packages/client/src/vite-env.d.ts (new - scaffolded)
- packages/server/package.json (new)
- packages/server/tsconfig.json (new)
- packages/server/drizzle.config.ts (new)
- packages/server/src/index.ts (new)
- packages/server/src/app.ts (new)
- packages/server/src/app.test.ts (new)
- packages/server/src/config.ts (new)
- packages/server/src/db/schema.ts (new)
- packages/server/src/db/client.ts (new)
- packages/server/src/db/migrations/0000_condemned_the_enforcers.sql (new - generated)
- packages/server/src/routes/health.ts (new)
- packages/server/src/routes/health.test.ts (new)
- packages/shared/package.json (new)
- packages/shared/tsconfig.json (new)
- packages/shared/src/types.ts (new)
- packages/shared/src/types.test.ts (new)

## Change Log

- 2026-03-16: Implemented Story 1.1 — full monorepo foundation with npm workspaces, PostgreSQL + Drizzle ORM, Fastify server with health endpoint, shared types, dev tooling, and test suite (9 tests passing).
