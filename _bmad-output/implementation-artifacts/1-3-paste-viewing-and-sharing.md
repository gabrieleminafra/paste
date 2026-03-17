# Story 1.3: Paste Viewing & Sharing

Status: review

## Story

As a user,
I want to open a paste link and view its content with an easy way to copy and share the link,
So that anyone I share with can access my text.

## Acceptance Criteria

1. **Given** a paste exists with ID `abc123`
   **When** I navigate to `/abc123`
   **Then** the paste content loads and is visible within 2 seconds (NFR2)
   **And** the content is displayed in a read-only text area with the same monospace font as the create page

2. **Given** I am on a paste page
   **When** I look at the top of the page
   **Then** I see a thin non-sticky PageHeader (UX-DR7) containing the ShareLink and a "New Paste" link back to root
   **And** the header uses a semantic `<header>` element

3. **Given** I am on a paste page
   **When** I click the "Copy" button next to the shareable URL (UX-DR4)
   **Then** the paste URL is copied to my clipboard
   **And** the button text changes to "Copied!" with green-600 color for 2 seconds, then reverts

4. **Given** I navigate to a paste URL that does not exist
   **When** the server returns a 404
   **Then** I see a centered "Paste not found" message with a link to create a new paste

5. **Given** a paste was created days ago
   **When** I open the same URL later
   **Then** the paste content loads exactly as it was saved (FR5, FR18)
   **And** the paste persists across server restarts (NFR8)

6. **Given** I open a paste URL in any supported modern browser (Chrome, Firefox, Safari, Edge — latest 2 versions)
   **When** the page loads
   **Then** the paste content is displayed correctly (FR17)
   **And** the Fastify server serves the SPA bundle via `@fastify/static` with fallback to `index.html` for client-side routing

## Tasks / Subtasks

- [x] Task 1: Build ShareLink component (AC: #3)
  - [x] Create `packages/client/src/components/ShareLink.tsx` — displays current paste URL with a "Copy" button
  - [x] Implement clipboard copy via `navigator.clipboard.writeText(window.location.href)`
  - [x] Add "Copied!" confirmation state: text changes to "Copied!" in green-600 for 2 seconds, then reverts to "Copy"
  - [x] Style as secondary button: transparent background, blue-600 text, subtle border per UX button hierarchy
  - [x] URL text is selectable (rendered in a read-only input or span)
  - [x] Add `aria-label="Shareable paste link"` on URL element, `aria-label="Copy link to clipboard"` on copy button
  - [x] Create `packages/client/src/components/ShareLink.test.tsx`

- [x] Task 2: Build PageHeader component (AC: #2)
  - [x] Create `packages/client/src/components/PageHeader.tsx` — thin non-sticky top bar
  - [x] Use semantic `<header>` element
  - [x] Include `ShareLink` component and a "New Paste" link (React Router `<Link to="/">`)
  - [x] "New Paste" link styled as tertiary action: no background/border, blue-600 text, underline on hover
  - [x] Add skip-to-content link as first focusable element: `<a href="#main-content">Skip to content</a>` (visually hidden, visible on focus)
  - [x] Create `packages/client/src/components/PageHeader.test.tsx`

- [x] Task 3: Enhance PastePage with PageHeader and full viewing experience (AC: #1, #2, #4)
  - [x] Update `packages/client/src/pages/PastePage.tsx` to integrate PageHeader at the top
  - [x] Wrap main content in `<main id="main-content">` for skip-to-content target
  - [x] Ensure paste content displays in read-only textarea with monospace font (font-mono), same styling as CreatePage editor
  - [x] Ensure loading state shows skeleton/shimmer on content area (no full-page spinner per UX-DR12)
  - [x] Ensure 404 state shows centered "Paste not found" message with link to create new paste
  - [x] Update `packages/client/src/pages/PastePage.test.tsx`

- [x] Task 4: Create NotFoundPage for unknown routes (AC: #4)
  - [x] Create `packages/client/src/pages/NotFoundPage.tsx` — centered "Page not found" message with link to create a new paste
  - [x] Add catch-all route `*` in `App.tsx` pointing to `NotFoundPage`
  - [x] Create `packages/client/src/pages/NotFoundPage.test.tsx`

- [x] Task 5: Configure @fastify/static for SPA serving (AC: #6)
  - [x] Register `@fastify/static` in `packages/server/src/app.ts` to serve `packages/client/dist/` in production
  - [x] Configure SPA fallback: use `setNotFoundHandler` to serve `index.html` for non-API/non-WS routes that don't match static files
  - [x] Only enable static serving when `NODE_ENV !== 'development'` (Vite dev server handles this in dev via proxy)
  - [x] Ensure API routes (`/api/*`) and future WebSocket routes (`/ws/*`) are NOT caught by the SPA fallback

- [x] Task 6: Add tests (AC: all)
  - [x] `packages/client/src/components/ShareLink.test.tsx` — test URL display, copy button click triggers clipboard write, "Copied!" state appears and reverts after 2s
  - [x] `packages/client/src/components/PageHeader.test.tsx` — test renders header element, contains ShareLink, contains "New Paste" link to `/`, skip-to-content link exists
  - [x] `packages/client/src/pages/PastePage.test.tsx` — test PageHeader renders, content displays in read-only textarea, loading state shows skeleton, 404 shows error message with link
  - [x] `packages/client/src/pages/NotFoundPage.test.tsx` — test renders "not found" message with create link

## Dev Notes

### Architecture Compliance

**File structure** — MUST create these exact files:
```
packages/
├── client/
│   └── src/
│       ├── App.tsx                # MODIFY: Add catch-all NotFoundPage route
│       ├── components/
│       │   ├── ShareLink.tsx      # NEW
│       │   ├── ShareLink.test.tsx # NEW
│       │   ├── PageHeader.tsx     # NEW
│       │   └── PageHeader.test.tsx # NEW
│       └── pages/
│           ├── PastePage.tsx      # MODIFY: Integrate PageHeader, finalize viewing
│           ├── PastePage.test.tsx  # MODIFY: Update tests for new components
│           ├── NotFoundPage.tsx   # NEW
│           └── NotFoundPage.test.tsx # NEW
├── server/
│   └── src/
│       └── app.ts                # MODIFY: Register @fastify/static, SPA fallback
```

### Critical Technical Requirements

**ShareLink — Clipboard API:**
- Use `navigator.clipboard.writeText(url)` — supported in all target browsers (Chrome 66+, Firefox 63+, Safari 13.1+, Edge 79+)
- Requires secure context (HTTPS) — works in `localhost` during development
- Requires user activation (must be called from a click handler, NOT from useEffect)
- Handle the returned Promise: catch errors gracefully (e.g., if permissions denied)
- Fallback not needed — all target browsers (latest 2 versions) support this API
- The URL to copy is `window.location.href` (the full paste URL including protocol and host)

**ShareLink — "Copied!" feedback pattern:**
```typescript
const [copied, setCopied] = useState(false);

const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
  }
};
// Button text: copied ? "Copied!" : "Copy"
// Button color: copied ? "text-green-600" : "text-primary" (blue-600)
```

**ShareLink — Component styling (UX-DR4):**
- URL text: displayed in a read-only `<input>` with `value={window.location.href}`, monospace or sans-serif font, selectable
- Copy button: secondary button style — transparent background, blue-600 text, subtle border
- "Copied!" state: green-600 text color, auto-reverts after 2 seconds
- `aria-label="Shareable paste link"` on URL input
- `aria-label="Copy link to clipboard"` on copy button

**PageHeader — Component structure (UX-DR7):**
- Thin, non-sticky `<header>` element at top of paste page
- Contains: ShareLink component + "New Paste" `<Link to="/">`
- "New Paste" link: tertiary style — no background, no border, blue-600 text, underline on hover
- Must include skip-to-content link: `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to content</a>`
- Layout: flex row, items centered, justify-between, padding 8-16px, border-bottom (border color #E5E7EB)

**PastePage — Enhanced layout:**
```
┌──────────────────────────────────────────────┐
│ <header> PageHeader                          │
│   [Skip to content]  ShareLink  [New Paste]  │
├──────────────────────────────────────────────┤
│ <main id="main-content">                     │
│   ┌──────────────────────────────────────┐   │
│   │ Read-only textarea with paste content│   │
│   │ font-mono, full-width, min-height    │   │
│   └──────────────────────────────────────┘   │
│ </main>                                      │
└──────────────────────────────────────────────┘
```

**@fastify/static — SPA Serving Configuration:**
- `@fastify/static` is already installed (Story 1.1)
- Register in `app.ts` conditionally for non-development environments
- **ESM IMPORTANT:** `__dirname` is NOT available in ESM. Use `import.meta.url` to derive the directory:
```typescript
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```
- Serve from the built client directory — from compiled `packages/server/dist/app.js`, the client dist is at `../../../packages/client/dist` (or use `path.resolve` from project root)
- Set `prefix: '/'` to serve all static files from root
- SPA fallback: use `setNotFoundHandler` to send `index.html` for any route that:
  - Does NOT start with `/api/`
  - Does NOT start with `/ws/`
  - Is NOT a request for a static file (no file extension)
- **CRITICAL: `setNotFoundHandler` REPLACEMENT** — `app.ts` already has a `setNotFoundHandler` that wraps all 404s in `ApiResponse` envelope. Fastify only allows ONE `setNotFoundHandler` at root level. You must REPLACE the existing handler, not add a second one.
- Pattern for SPA fallback in Fastify:
```typescript
import fastifyStatic from '@fastify/static';

// Inside buildApp(), register @fastify/static at ROOT scope (not in a scoped plugin)
// This ensures reply.sendFile() is available everywhere including setNotFoundHandler
app.register(fastifyStatic, {
  root: path.join(__dirname, '../../client/dist'),
  prefix: '/',
  wildcard: false, // Don't let static plugin handle 404s — let setNotFoundHandler do it
});

// REPLACE the existing setNotFoundHandler — differentiate API vs page 404s
app.setNotFoundHandler((request, reply) => {
  // API/WS 404s return JSON error envelope
  if (request.url.startsWith('/api/') || request.url.startsWith('/ws/')) {
    return reply.status(404).send({
      data: null,
      error: { message: 'Not found', code: 'NOT_FOUND' },
    });
  }
  // All other 404s serve index.html for client-side routing
  return reply.sendFile('index.html');
});
```
- **Registration order matters:** Register `@fastify/static` at root scope (not inside an encapsulated plugin) so that `reply.sendFile()` decorator is available in `setNotFoundHandler`. Register AFTER API routes but BEFORE setting the not-found handler.
- In development mode, Vite's dev server handles static serving and client-side routing via its proxy config — wrap the `@fastify/static` registration in a `NODE_ENV` check:
```typescript
if (process.env.NODE_ENV !== 'development') {
  app.register(fastifyStatic, { ... });
}
```

**NotFoundPage — Client-side 404:**
- A React component rendered by a catch-all route `*` in App.tsx
- Centered layout: "Page not found" heading, "The page you're looking for doesn't exist." message, link to `/` ("Create a new paste")
- This handles routes that don't match `/` or `/:pasteId`
- NOTE: Paste-specific 404 (paste ID not found in DB) is handled WITHIN PastePage — the server returns a 404 API response, and PastePage renders an inline "Paste not found" message. NotFoundPage handles truly unknown routes.
- **Routing table after this story:**
  - `/` → CreatePage
  - `/:pasteId` (paste exists) → PastePage with content + PageHeader
  - `/:pasteId` (paste not in DB) → PastePage with inline "Paste not found" message
  - `/anything/else` (multi-segment unknown routes) → NotFoundPage

### Previous Story Intelligence (1.1 & 1.2)

**Key patterns established that MUST be followed:**

From Story 1.1:
- App factory pattern: `export async function buildApp()` in `app.ts` — register all plugins/routes inside this function
- Error handler wraps all errors in `ApiResponse` envelope — the `setNotFoundHandler` currently returns JSON for all 404s. Story 1.3 MODIFIES this to differentiate API vs page 404s
- `@fastify/static` already installed but NOT registered — register it in this story
- Database client in `db/client.ts`, schema in `db/schema.ts` — paste retrieval already works from Story 1.2's `GET /api/pastes/:id`

From Story 1.2:
- React Router 7 — unified `react-router` package. Import `Link` from `"react-router"` (NOT `react-router-dom`)
- Tailwind CSS v4.2 with CSS-based config — design tokens defined in `@theme` block in `index.css`
- PastePage already fetches paste via `GET /api/pastes/:pasteId` using `useParams()` from React Router
- PastePage has loading state and 404 handling — this story ENHANCES it with PageHeader integration
- CreatePage uses `useNavigate()` for client-side navigation after paste creation
- Components are single files in `components/` — no barrel exports, no subdirectories
- Tailwind custom colors available: `--color-primary` (#2563EB), `--color-primary-hover` (#1D4ED8), `--color-muted` (#6B7280), `--color-border` (#E5E7EB)

**PastePage — What ALREADY EXISTS (do NOT rewrite from scratch):**
Story 1.2 built PastePage with:
- `useParams()` to extract `pasteId` from URL
- `fetch()` call to `GET /api/pastes/:pasteId` in a `useEffect`
- Loading state with `animate-pulse` skeleton shimmer on content area
- 404 state: "Paste not found" centered message with `<Link to="/">` to create new paste
- Read-only `<textarea>` with monospace font displaying paste content
- Error/loading state management via `useState`

**What Story 1.3 CHANGES in PastePage:**
- ADD: `<PageHeader>` component at the top (pass `pasteId` or URL as prop)
- ADD: Wrap content area with `<main id="main-content">` for skip-to-content accessibility
- KEEP: All existing fetch logic, loading state, 404 handling, textarea display
- DO NOT rewrite the component — modify it minimally to integrate the new header
- Font variables: `--font-mono` and `--font-sans` defined in `@theme`

**Files from previous stories that will be MODIFIED:**
- `packages/client/src/App.tsx` — add NotFoundPage catch-all route
- `packages/client/src/pages/PastePage.tsx` — integrate PageHeader, finalize layout
- `packages/server/src/app.ts` — register @fastify/static, update setNotFoundHandler for SPA fallback

### UX Implementation Details

**Design tokens already configured in `index.css` (from Story 1.2):**
- Primary: #2563EB (blue-600) → `text-primary` / `bg-primary`
- Primary hover: #1D4ED8 (blue-700) → `hover:bg-primary-hover`
- Muted: #6B7280 → `text-muted`
- Border: #E5E7EB → `border-border`
- Connected green: #22C55E → `text-green-500` (Tailwind default)
- Font mono: JetBrains Mono stack → `font-mono`
- Font sans: Inter stack → `font-sans`

**Button styling reference (from UX spec):**
- Primary: `bg-primary text-white rounded-md px-4 py-2 hover:bg-primary-hover focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`
- Secondary (Copy button): `bg-transparent text-primary border border-border rounded-md px-3 py-1.5 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`
- Tertiary (New Paste link): `text-primary hover:underline`

**Transition timing:** 150ms for hover/focus states — `transition-colors duration-150`

### What This Story Does NOT Include

- No CodeMirror editor — that's Epic 2 (Story 2.1 replaces textarea with CodeMirror)
- No WebSocket/Yjs integration — that's Epic 2
- No ConnectionStatus component — that's Epic 3 (Story 3.2)
- No CursorIndicator — that's Epic 2 (Story 2.3)
- No Cmd/Ctrl+Shift+C keyboard shortcut for copy — that's Story 4.2 (Accessibility & Keyboard Shortcuts)
- No responsive breakpoints beyond basic layout — that's Story 4.1
- No Dockerfile or production Docker build — that's Story 4.3
- No PlaceholderState component — that exists as inline placeholder in CreatePage's textarea from Story 1.2

### Library Versions (Verified March 2026)

| Package | Version | Notes |
|---------|---------|-------|
| @fastify/static | 9.x | Already installed in Story 1.1, register in this story |
| react-router | 7.x | Already installed, use `Link` for "New Paste" navigation |
| tailwindcss | 4.2.x | Already configured, use existing design tokens |

No new dependencies needed for this story. All required packages are already installed.

### Testing Strategy

- **ShareLink tests** (`ShareLink.test.tsx`):
  - Renders URL display with current location
  - Copy button click calls `navigator.clipboard.writeText` with correct URL
  - "Copied!" text appears after click, reverts after 2s (use `vi.useFakeTimers()`)
  - Appropriate aria-labels are present
  - Mock `navigator.clipboard.writeText` as `vi.fn().mockResolvedValue(undefined)`

- **PageHeader tests** (`PageHeader.test.tsx`):
  - Renders semantic `<header>` element
  - Contains ShareLink component
  - Contains "New Paste" link pointing to `/`
  - Skip-to-content link exists with `href="#main-content"`

- **PastePage tests** (`PastePage.test.tsx`):
  - PageHeader is rendered on paste page
  - Content displayed in read-only textarea
  - Loading skeleton shown while fetching
  - 404 state renders "Paste not found" with create link
  - Mock fetch API for paste retrieval

- **NotFoundPage tests** (`NotFoundPage.test.tsx`):
  - Renders "Page not found" message
  - Contains link to `/` for creating a new paste

- Co-locate all test files with source files
- Vitest 4.1.x is already configured as a workspace root dependency — do NOT install per-package
- The client has `vitest.config.ts` with jsdom environment and `@testing-library/jest-dom/vitest` setup
- Use `@testing-library/react` (`render`, `screen`, `fireEvent`) and `vitest` (`describe`, `it`, `expect`, `vi`) — follow the existing pattern from `CreateButton.test.tsx`
- Mock `navigator.clipboard.writeText` as `vi.fn().mockResolvedValue(undefined)` for ShareLink tests
- For ShareLink URL testing: `window.location.href` defaults to `http://localhost/` in jsdom — either mock `window.location` or wrap component in `<MemoryRouter initialEntries={['/abc123']}>` for a realistic URL
- Use `vi.useFakeTimers()` to test the 2-second "Copied!" revert behavior

### Project Structure Notes

- All new components follow flat structure in `components/` — single files, no subdirectories
- React components use PascalCase filenames: `ShareLink.tsx`, `PageHeader.tsx`
- Tests co-located: `ShareLink.test.tsx` beside `ShareLink.tsx`
- No `src/utils/` directory — clipboard logic lives directly in ShareLink component
- No barrel exports — import components directly by path

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure & Deployment]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component Strategy — PageHeader, ShareLink]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX Consistency Patterns — Button Hierarchy, Feedback Patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Visual Design Foundation — Color System, Typography]
- [Source: _bmad-output/planning-artifacts/prd.md#Functional Requirements — FR4, FR5, FR15, FR16, FR17, FR18]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- @fastify/static registration initially failed in test environment because `NODE_ENV` was not set to `development` — resolved by gating on `NODE_ENV === "production"` instead of `!== "development"`

### Completion Notes List

- Task 1: Built ShareLink component with clipboard copy via `navigator.clipboard.writeText`, "Copied!" feedback with 2s auto-revert, secondary button styling, aria-labels. 6 tests passing.
- Task 2: Built PageHeader with semantic `<header>`, ShareLink integration, "New Paste" tertiary link, skip-to-content accessibility link. 4 tests passing.
- Task 3: Enhanced PastePage with PageHeader at top and `<main id="main-content">` wrapper across all states (loading, error, notFound, content). 7 tests passing (2 new).
- Task 4: Created NotFoundPage with "Page not found" message and link to create new paste. Added catch-all `*` route in App.tsx. 2 tests passing.
- Task 5: Configured @fastify/static for production SPA serving. Replaced setNotFoundHandler to differentiate API/WS 404s (JSON envelope) from page 404s (serve index.html). Gated on `NODE_ENV === "production"`. All 14 server tests passing.
- Task 6: All component tests written and co-located. Full suite: 51 tests across 10 files, zero regressions.

### Change Log

- 2026-03-17: Implemented Story 1.3 — Paste Viewing & Sharing (all 6 tasks complete)

### File List

**New files:**
- packages/client/src/components/ShareLink.tsx
- packages/client/src/components/ShareLink.test.tsx
- packages/client/src/components/PageHeader.tsx
- packages/client/src/components/PageHeader.test.tsx
- packages/client/src/pages/NotFoundPage.tsx
- packages/client/src/pages/NotFoundPage.test.tsx

**Modified files:**
- packages/client/src/App.tsx — added NotFoundPage catch-all route
- packages/client/src/pages/PastePage.tsx — integrated PageHeader, added `<main>` wrapper
- packages/client/src/pages/PastePage.test.tsx — added PageHeader and main-content tests
- packages/server/src/app.ts — registered @fastify/static, SPA fallback in setNotFoundHandler
