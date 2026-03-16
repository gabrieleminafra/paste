# Story 1.2: Paste Creation Flow

Status: ready-for-dev

## Story

As a user,
I want to paste text and click Create to get a shareable link,
So that I can quickly save and share text snippets.

## Acceptance Criteria

1. **Given** I am on the root URL (`/`)
   **When** the page loads
   **Then** I see a large text area with placeholder text "Paste your text here..." in muted color (UX-DR8)
   **And** a "Create" button is visible below the editor
   **And** the Create button is disabled when the text area is empty (UX-DR3)

2. **Given** I have entered text in the editor
   **When** I click the "Create" button or press Cmd/Ctrl+Enter (UX-DR3, UX-DR11)
   **Then** a `POST /api/pastes` request is sent with the text content
   **And** the system generates a nanoid (21 chars, ~126 bits entropy) as the paste ID
   **And** the paste is stored in PostgreSQL with the content
   **And** the response returns the paste ID in an `ApiResponse<T>` envelope within 1 second (NFR1)

3. **Given** the paste is created successfully
   **When** the server responds with the paste ID
   **Then** the browser navigates to `/:pasteId` without a full page reload
   **And** the shareable URL is visible in the browser address bar

4. **Given** the root URL is loaded
   **When** I inspect the page
   **Then** Tailwind CSS v4.2 design tokens are applied: background #FFFFFF, text #1A1A1A, primary action #2563EB, muted text #6B7280 (UX-DR1)
   **And** the editor uses a monospace font stack (JetBrains Mono / Fira Code / SF Mono / Consolas)
   **And** UI elements use a sans-serif font stack (Inter / system fonts)

5. **Given** paste creation receives excessive requests from one client
   **When** the rate limit is exceeded
   **Then** the server returns a 429 response with an appropriate error in `ApiResponse<T>` envelope
   **And** paste content exceeding 1MB is rejected with a validation error

## Tasks / Subtasks

- [ ] Task 1: Install dependencies and set up Tailwind CSS v4.2 (AC: #4)
  - [ ] Install `tailwindcss` (4.2.x) and `@tailwindcss/vite` in `packages/client`
  - [ ] Install `react-router` (7.x) in `packages/client`
  - [ ] Install `nanoid` (5.x) in `packages/server`
  - [ ] Add `@tailwindcss/vite` plugin to `packages/client/vite.config.ts`
  - [ ] Replace CSS content in `packages/client/src/index.css` with `@import "tailwindcss";` and custom design tokens via `@theme`
  - [ ] Remove the existing Vite boilerplate CSS in `App.css`

- [ ] Task 2: Set up client-side routing with React Router 7 (AC: #3)
  - [ ] Configure `BrowserRouter` in `packages/client/src/main.tsx`
  - [ ] Update `packages/client/src/App.tsx` to define routes: `/` → `CreatePage`, `/:pasteId` → `PastePage`
  - [ ] Create `packages/client/src/pages/CreatePage.tsx` (stub)
  - [ ] Create `packages/client/src/pages/PastePage.tsx` (stub — displays paste content read-only for now)

- [ ] Task 3: Build CreatePage with editor and CreateButton (AC: #1, #4)
  - [ ] Create `packages/client/src/pages/CreatePage.tsx` with full-width textarea, placeholder "Paste your text here...", monospace font
  - [ ] Create `packages/client/src/components/CreateButton.tsx` — "Create" label, disabled when empty, styled per UX-DR3
  - [ ] Implement Cmd/Ctrl+Enter keyboard shortcut to trigger create (UX-DR11)
  - [ ] Apply Tailwind design tokens: background #FFFFFF, text #1A1A1A, button primary #2563EB, muted #6B7280
  - [ ] Center editor with max-width 800px on desktop (UX-DR9)

- [ ] Task 4: Build paste creation API route (AC: #2, #5)
  - [ ] Create `packages/server/src/routes/pastes.ts` with `POST /api/pastes` and `GET /api/pastes/:id`
  - [ ] `POST /api/pastes`: validate content exists and is <= 1MB, generate nanoid (21 chars), encode text to Buffer, insert into `pastes` table, return `{ data: { id }, error: null }` with 201
  - [ ] `GET /api/pastes/:id`: query `pastes` table by ID, decode bytea content to text string via `Buffer.from(content).toString('utf-8')`, return in `ApiResponse<T>` envelope with 200, or 404 if not found
  - [ ] Register routes in `packages/server/src/app.ts`
  - [ ] Enable `@fastify/rate-limit` on `POST /api/pastes` route

- [ ] Task 5: Build PastePage for viewing (AC: #3)
  - [ ] Create `packages/client/src/pages/PastePage.tsx` — fetch paste via `GET /api/pastes/:pasteId`, display content in read-only textarea with same monospace font
  - [ ] Show loading skeleton/shimmer while fetching (no full-page spinner per UX-DR12)
  - [ ] Show "Paste not found" with link to create a new paste on 404

- [ ] Task 6: Wire up paste creation flow end-to-end (AC: #2, #3)
  - [ ] CreatePage calls `POST /api/pastes` with textarea content on create
  - [ ] On success, use React Router `useNavigate()` to navigate to `/:pasteId` (client-side navigation, no full page reload)
  - [ ] Handle creation errors: show "Retry" button with muted error message (UX-DR12)

- [ ] Task 7: Add tests (AC: all)
  - [ ] Create `packages/server/src/routes/pastes.test.ts` — test POST creates paste, GET retrieves it, 404 for unknown ID, 429 for rate limit, validation errors for empty/oversized content
  - [ ] Create `packages/client/src/pages/CreatePage.test.tsx` — test textarea renders, button disabled when empty, enabled when text entered
  - [ ] Create `packages/client/src/components/CreateButton.test.tsx` — test disabled/enabled states, click handler

## Dev Notes

### Architecture Compliance

**File structure** — MUST create these exact files:
```
packages/
├── client/
│   └── src/
│       ├── index.css              # MODIFY: Replace with Tailwind import + design tokens
│       ├── App.tsx                # MODIFY: Replace Vite boilerplate with React Router routes
│       ├── App.css                # MODIFY: Remove boilerplate styles (or delete if empty)
│       ├── main.tsx               # MODIFY: Wrap with BrowserRouter
│       ├── components/
│       │   ├── CreateButton.tsx   # NEW
│       │   └── CreateButton.test.tsx # NEW
│       └── pages/
│           ├── CreatePage.tsx     # NEW
│           ├── CreatePage.test.tsx # NEW
│           ├── PastePage.tsx      # NEW
│           └── PastePage.test.tsx # NEW
├── server/
│   └── src/
│       ├── app.ts                # MODIFY: Register paste routes + rate-limit
│       └── routes/
│           ├── pastes.ts          # NEW
│           └── pastes.test.ts     # NEW
```

### Critical Technical Requirements

**React Router 7 — Unified Package:**
- Install `react-router` (v7.x), NOT `react-router-dom` — packages are unified in v7
- Import `BrowserRouter`, `Routes`, `Route`, `useNavigate`, `useParams` from `"react-router"`
- Routes: `/` → `CreatePage`, `/:pasteId` → `PastePage`

**Tailwind CSS v4.2 — Vite Plugin (NOT PostCSS):**
- Install `tailwindcss` (4.2.x) and `@tailwindcss/vite`
- Add `tailwindcss()` plugin to `vite.config.ts` plugins array
- NO `tailwind.config.js` or `postcss.config.js` needed — v4 uses CSS-based configuration
- In `index.css`: `@import "tailwindcss";` then define custom theme via `@theme { }` block
- Tailwind v4 auto-detects content files — no `content` configuration needed
- Custom design tokens go in `@theme` block in CSS, for example:
```css
@import "tailwindcss";

@theme {
  --color-primary: #2563EB;
  --color-primary-hover: #1D4ED8;
  --color-muted: #6B7280;
  --color-border: #E5E7EB;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', monospace;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

**nanoid 5.x — ESM only:**
- Install `nanoid` (5.x) in `packages/server` only
- Import: `import { nanoid } from 'nanoid';`
- Usage: `const id = nanoid();` — generates 21-char URL-safe ID by default (~126 bits entropy)
- nanoid 5.x is ESM-only — compatible with our ESM-throughout architecture

**Paste CRUD Routes (`packages/server/src/routes/pastes.ts`):**
```typescript
// POST /api/pastes
// Body: { content: string }
// Response 201: { data: { id: string }, error: null }
// Response 400: { data: null, error: { message: "Content is required", code: "VALIDATION_ERROR" } }
// Response 400: { data: null, error: { message: "Content exceeds 1MB limit", code: "VALIDATION_ERROR" } }
// Response 429: { data: null, error: { message: "Too many requests", code: "RATE_LIMITED" } }

// GET /api/pastes/:id
// Response 200: { data: { id, content, createdAt, updatedAt }, error: null }
// Response 404: { data: null, error: { message: "Paste not found", code: "PASTE_NOT_FOUND" } }
```

**Content Storage Strategy:**
- `POST` receives plain text string in `content` field
- Encode to `Buffer.from(content, 'utf-8')` for storage in `bytea` column
- `GET` decodes: `Buffer.from(row.content).toString('utf-8')` to return plain text string
- The `bytea` column is designed for Yjs binary state in Epic 2; for now it stores UTF-8 encoded text
- Return dates as ISO 8601 strings in JSON: `createdAt`, `updatedAt` (camelCase, Drizzle maps automatically)

**Rate Limiting (`@fastify/rate-limit`):**
- Already installed in Story 1.1
- Register globally or per-route on `POST /api/pastes`
- Use default settings or reasonable limits (e.g., 10 requests/minute per IP)

**Input Validation:**
- Content is required — reject empty/missing content with 400
- Content max size: 1MB (1,048,576 bytes) — reject with 400
- No other validation needed — accept any text

**`ApiResponse<T>` Envelope — MUST use for ALL responses:**
- Import from `shared` package: `import type { ApiResponse } from 'shared';`
- Success: `{ data: T, error: null }`
- Error: `{ data: null, error: { message: string, code: string } }`

### UX Implementation Details

**CreatePage layout (desktop, 1024px+):**
- Editor area centered, max-width 800px
- Textarea: full-width within container, min-height ~60vh, monospace font (font-mono), text-[#1A1A1A], bg-white
- Placeholder: "Paste your text here..." in text-[#6B7280] (muted)
- CreateButton below textarea, aligned right or natural width

**CreateButton styling (UX-DR3):**
- Default: bg-[#2563EB] text-white rounded-md px-4 py-2
- Hover: bg-[#1D4ED8]
- Disabled: bg-gray-300 text-gray-500 cursor-not-allowed
- Focus: ring-2 ring-blue-500 ring-offset-2

**Keyboard shortcut (UX-DR11):**
- Cmd+Enter (Mac) / Ctrl+Enter (Windows/Linux) triggers paste creation
- Only active on the CreatePage (root URL), not on PastePage

**PastePage (basic view for this story):**
- Fetch paste content via `GET /api/pastes/:pasteId`
- Display in read-only textarea with same monospace font
- Loading: show skeleton/shimmer on content area (no full-page spinner)
- 404: centered "Paste not found" message with link to create new paste
- NOTE: PageHeader, ShareLink, ConnectionStatus components are NOT built in this story — they come in Story 1.3 and Epic 2/3

**Error handling on creation failure:**
- Show muted error message below the Create button
- Button text changes to "Retry"
- Clicking "Retry" re-attempts the POST

### Previous Story Intelligence (1.1)

**Key patterns established in Story 1.1 that MUST be followed:**
- App factory pattern in `app.ts`: `export async function buildApp()` — register new route plugins inside this function
- Routes are Fastify plugins: export an `async function` and register with `fastify.register()`
- Tests use Fastify's `inject()` method — no real HTTP needed for server tests
- Shared types imported as `import type { ApiResponse } from 'shared';`
- Error handler already wraps all errors in `ApiResponse` envelope — leverage this, don't duplicate
- 404 handler already wraps unknown routes — paste-specific 404 needs to be handled in the route itself before the global 404 catches it
- Database client in `packages/server/src/db/client.ts` — import and use this, don't create a new connection
- Drizzle schema in `packages/server/src/db/schema.ts` — `pastes` table already defined with `id`, `content`, `createdAt`, `updatedAt`
- Vitest 4.1.x already configured at monorepo root
- `@fastify/rate-limit` already installed but NOT yet registered — register it in `app.ts`

**Files created in Story 1.1 that will be MODIFIED:**
- `packages/server/src/app.ts` — add paste routes registration, register rate-limit plugin
- `packages/client/src/App.tsx` — replace Vite boilerplate with React Router routes
- `packages/client/src/main.tsx` — wrap with BrowserRouter
- `packages/client/src/index.css` — replace with Tailwind import
- `packages/client/src/App.css` — remove boilerplate styles

**Existing Vite boilerplate in client:**
- `App.tsx` currently has Vite template content (logos, counter, links) — replace entirely
- `App.css` has Vite template styles — clear/remove
- `index.css` has Vite template styles — replace with Tailwind
- `assets/` folder has `hero.png`, `vite.svg`, `react.svg` — can be removed or ignored

### What This Story Does NOT Include

- No PageHeader component — that's Story 1.3
- No ShareLink component — that's Story 1.3
- No "Copy" button or "Copied!" feedback — that's Story 1.3
- No "New Paste" link — that's Story 1.3
- No CodeMirror editor — that's Epic 2 (Story 2.1 replaces textarea with CodeMirror)
- No WebSocket/Yjs integration — that's Epic 2
- No ConnectionStatus component — that's Epic 3
- No CursorIndicator — that's Epic 2
- No Dockerfile or production build — that's Story 4.3
- No responsive breakpoints beyond basic centering — that's Story 4.1
- No accessibility beyond basic semantic HTML — that's Story 4.2

### Library Versions (Verified March 2026)

| Package | Version | Notes |
|---------|---------|-------|
| nanoid | 5.x (latest 5.1.7) | ESM-only, 21-char default, ~126 bits entropy |
| react-router | 7.x (latest 7.13.1) | Unified package, replaces react-router-dom |
| tailwindcss | 4.2.x (latest 4.2.1) | CSS-based config, no tailwind.config.js |
| @tailwindcss/vite | 4.2.x (latest 4.2.1) | First-party Vite plugin, replaces PostCSS setup |
| @fastify/rate-limit | 10.x | Already installed in Story 1.1 |

**CRITICAL:** Do NOT install `react-router-dom` — it's deprecated in v7. Use `react-router` only.

**CRITICAL:** Do NOT create `tailwind.config.js` or `postcss.config.js` — Tailwind v4 uses CSS-based configuration via `@theme` blocks.

### Testing Strategy

- **Server route tests** (`pastes.test.ts`): Use Fastify's `inject()` method. Test:
  - POST with valid content → 201, returns `{ data: { id: string }, error: null }`
  - POST with empty content → 400 VALIDATION_ERROR
  - POST with >1MB content → 400 VALIDATION_ERROR
  - GET existing paste → 200 with content as string
  - GET non-existent paste → 404 PASTE_NOT_FOUND
  - Rate limiting returns 429 (may need to configure lower limit for testing)
- **Client tests** (`CreatePage.test.tsx`, `CreateButton.test.tsx`): Use Vitest + React testing utilities
  - CreateButton disabled when text is empty, enabled when text present
  - CreatePage renders textarea with placeholder
  - Keyboard shortcut test (Cmd/Ctrl+Enter)
- Co-locate all test files with source files

### Project Structure Notes

- Alignment with unified project structure: all new files follow architecture spec exactly
- No `src/utils/` directories — route logic lives in route files
- Components are single files in `components/` — no barrel exports, no subdirectories
- Pages in `pages/` directory as defined in architecture

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component Strategy]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX Consistency Patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Visual Design Foundation]
- [Source: _bmad-output/planning-artifacts/prd.md#Functional Requirements]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
