---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# pastebin - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for pastebin, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

- FR1: User can create a new paste by entering plain text content
- FR2: User can edit the content of an existing paste
- FR3: System generates a unique shareable link for each paste
- FR4: User can access any paste via its unique link
- FR5: Pastes persist indefinitely without expiration
- FR6: Multiple users can edit the same paste simultaneously
- FR7: Edits from any collaborator are visible to all other connected users in real time
- FR8: System resolves concurrent edits without data loss or corruption (conflict-free)
- FR9: System displays cursor positions of all connected collaborators
- FR10: System supports up to 10 concurrent editors per paste
- FR11: User's browser establishes a real-time connection when opening a paste
- FR12: System automatically reconnects when a connection is lost
- FR13: System synchronizes document state upon reconnection (catch up on missed edits)
- FR14: System handles graceful disconnection when a user leaves
- FR15: User can view a paste without editing (read-only access by choosing not to type)
- FR16: User can copy paste content to clipboard
- FR17: User can access a paste from any supported modern browser
- FR18: User can access a previously created paste at a later time via the same link
- FR19: User is presented with a paste creation interface when visiting the root URL

### NonFunctional Requirements

- NFR1: Paste creation (text submission to shareable link) completes in under 1 second
- NFR2: Paste loads and is visible within 2 seconds of opening the link
- NFR3: Edit operations propagate to all connected collaborators within 1 second
- NFR4: Cursor position updates propagate to all connected collaborators within 500ms
- NFR5: System maintains acceptable performance with up to 10 concurrent editors on a single paste
- NFR6: Paste links use sufficiently random identifiers to prevent guessing or enumeration
- NFR7: All client-server communication uses TLS encryption (HTTPS/WSS)
- NFR8: Persistent pastes survive server restarts without data loss
- NFR9: WebSocket connections automatically reconnect after transient network failures
- NFR10: Document state remains consistent after reconnection (no lost edits, no duplicated content)
- NFR11: Concurrent edits never result in data corruption or permanent divergence between clients

### Additional Requirements

- Starter template: Custom npm workspaces monorepo (Vite react-ts client + hand-built Fastify server + shared types package)
- TypeScript 5.x strict mode across all packages, ESM throughout, Node.js 22+
- PostgreSQL 17 with Drizzle ORM 0.45 for persistent storage; single `pastes` table with `bytea` column for Yjs binary state
- Drizzle Kit for database migrations (`drizzle-kit generate` / `drizzle-kit migrate`)
- Yjs 13.6 for CRDT with CodeMirror 6 editor binding (`y-codemirror.next`)
- y-websocket 3.0 for WebSocket sync protocol via `@fastify/websocket` 11.2
- nanoid (21 chars, ~126 bits entropy) for paste ID generation
- Rate limiting on `POST /api/pastes` via `@fastify/rate-limit`
- Input size limit on paste content (1MB max)
- API response envelope: shared `ApiResponse<T>` type in `packages/shared`
- Pino structured logging (built into Fastify)
- Environment validation via `@fastify/env` (`DATABASE_URL`, `PORT`, `NODE_ENV`)
- Docker multi-stage build (build stage → Node.js 22 Alpine production stage)
- `docker-compose.yml` with `app` + `postgres` services (named volume for data)
- Fastify serves static SPA bundle via `@fastify/static`
- In-memory Yjs docs with debounced persistence (5s inactivity) and persist-on-last-disconnect
- Vitest 4.1 for testing (client and server), co-located test files
- Shared TypeScript configuration (`tsconfig.base.json`) extended by each package
- Concurrent dev scripts at monorepo root (Vite HMR for client, tsx watch for server)

### UX Design Requirements

- UX-DR1: Implement Tailwind CSS v4.2 design tokens — custom color palette (background #FFFFFF, text #1A1A1A, muted #6B7280, border #E5E7EB, primary #2563EB/#1D4ED8, semantic green-500/amber-500/red-500), spacing scale (4/8/12/16/24/32/48/64px), and typography (JetBrains Mono for editor, Inter for UI)
- UX-DR2: Build PasteEditor component — full-width CodeMirror 6 editor with monospace font, placeholder state, collaborative cursor rendering, reconnecting indicator; ARIA role="textbox", aria-multiline, aria-label
- UX-DR3: Build CreateButton component — "Create" label, disabled when editor empty, Cmd/Ctrl+Enter keyboard shortcut, hover/active/disabled states per button hierarchy (blue-600 bg, blue-700 hover, gray-300 disabled)
- UX-DR4: Build ShareLink component — displays paste URL with Copy button, "Copied!" confirmation for 2 seconds with green-600 color, selectable URL text; aria-labels for link and copy action
- UX-DR5: Build CursorIndicator component — thin vertical colored lines from collaborator cursor palette (violet/pink/orange/teal/yellow, cycling for 6-10), 150ms smooth position transitions, fade out on disconnect; aria-hidden="true"
- UX-DR6: Build ConnectionStatus component — small dot in bottom-right corner (green filled = connected, amber hollow pulsing ring = reconnecting, red filled = disconnected), tooltip on hover, inline "Reconnecting..." message after 30s; aria-live="polite"
- UX-DR7: Build PageHeader component — thin non-sticky top bar containing ShareLink and "New Paste" link; semantic `<header>` element with skip-to-content link
- UX-DR8: Build PlaceholderState — "Paste your text here..." in gray-400/muted color, disappears on first input, reappears if all content deleted; not announced to screen readers
- UX-DR9: Implement responsive layout — desktop-first (1024px+: max 800px centered create, full-width paste), tablet (768-1023px: reduced padding, 44px touch targets), mobile (320-767px: full-width stacked, read-optimized, large touch targets)
- UX-DR10: Implement accessibility — WCAG 2.1 AA compliance: visible focus rings (2px solid blue, offset), semantic HTML (`<main>`, `<header>`, `<button>`, `<textarea>`), ARIA labels on interactive elements, `prefers-reduced-motion` support for cursor transitions and pulse animation
- UX-DR11: Implement keyboard shortcuts — Cmd/Ctrl+Enter for paste creation on root URL, Cmd/Ctrl+Shift+C for copy link on paste page
- UX-DR12: Implement loading and error states — shimmer/skeleton on paste content area during load (no full-page spinner), 404 "Paste not found" centered message with link to create new paste, retry button on creation failure

### FR Coverage Map

| FR | Epic | Description |
|---|---|---|
| FR1 | Epic 1 | Create paste with plain text content |
| FR3 | Epic 1 | Generate unique shareable link |
| FR4 | Epic 1 | Access paste via unique link |
| FR5 | Epic 1 | Pastes persist indefinitely |
| FR15 | Epic 1 | View paste without editing |
| FR16 | Epic 1 | Copy paste content to clipboard |
| FR17 | Epic 1 | Access from any modern browser |
| FR18 | Epic 1 | Access previously created paste via same link |
| FR19 | Epic 1 | Paste creation interface at root URL |
| FR2 | Epic 2 | Edit content of existing paste |
| FR6 | Epic 2 | Multiple users edit simultaneously |
| FR7 | Epic 2 | Real-time edit visibility |
| FR8 | Epic 2 | Conflict-free concurrent edits |
| FR9 | Epic 2 | Display cursor positions |
| FR10 | Epic 2 | Support 10 concurrent editors |
| FR11 | Epic 2 | Real-time connection on paste open |
| FR12 | Epic 3 | Auto-reconnect on connection loss |
| FR13 | Epic 3 | Sync state upon reconnection |
| FR14 | Epic 3 | Graceful disconnection handling |

## Epic List

### Epic 1: Paste Creation & Sharing
Users can create text pastes, get shareable links, and access pastes from any browser. The complete paste creation and sharing flow works end-to-end. Journey 3 (Solo Scratchpad) is fully enabled.
**FRs covered:** FR1, FR3, FR4, FR5, FR15, FR16, FR17, FR18, FR19

### Epic 2: Real-Time Collaborative Editing
Multiple users can edit the same paste simultaneously with live sync and cursor presence. Real-time collaboration works — edits sync, cursors are visible, conflicts resolve automatically. Journey 1 (Quick Share to Live Collaboration) is fully enabled.
**FRs covered:** FR2, FR6, FR7, FR8, FR9, FR10, FR11

### Epic 3: Connection Resilience & Reliability
Users maintain reliable connections with auto-recovery, ensuring no edits are ever lost. Connections recover silently, state syncs after drops, and disconnects are handled gracefully. Journey 2 (Returning to Stale Paste) is fully enabled.
**FRs covered:** FR12, FR13, FR14

### Epic 4: UX Polish & Accessibility
Users enjoy a polished, responsive, accessible experience with keyboard shortcuts across all devices. The product is responsive on mobile/tablet, meets WCAG AA, supports keyboard power users, and handles loading/error states gracefully. Production Docker build completes the deployment story.
**FRs covered:** All 19 FRs addressed by Epics 1-3. This epic addresses UX-DRs and NFRs across the full product.

## Epic 1: Paste Creation & Sharing

Users can create text pastes, get shareable links, and access pastes from any browser. The complete paste creation and sharing flow works end-to-end. Journey 3 (Solo Scratchpad) is fully enabled.

### Story 1.1: Project Foundation & Paste Storage

As a developer,
I want a working monorepo with database, Fastify server, and shared types,
So that the team can start building paste features on a solid foundation.

**Acceptance Criteria:**

**Given** the repository is cloned and dependencies are installed
**When** I run `npm run dev` at the monorepo root
**Then** the Fastify server starts on the configured port and the Vite dev server starts with HMR
**And** both processes run concurrently via a root dev script

**Given** Docker Compose is running
**When** the PostgreSQL 17 container starts
**Then** a `pastes` table exists with columns: `id` (nanoid string, PK), `content` (bytea), `created_at` (timestamptz), `updated_at` (timestamptz)
**And** the schema is managed by Drizzle ORM 0.45 with Drizzle Kit migrations

**Given** the server is running
**When** I send `GET /api/health`
**Then** I receive a 200 response wrapped in the `ApiResponse<T>` envelope from `packages/shared`

**Given** the monorepo structure
**When** I inspect the project
**Then** it uses npm workspaces with `packages/client` (Vite react-ts), `packages/server` (Fastify), and `packages/shared` (types)
**And** TypeScript 5.x strict mode is enabled across all packages via `tsconfig.base.json`
**And** ESM is used throughout with Node.js 22+
**And** environment variables (`DATABASE_URL`, `PORT`, `NODE_ENV`) are validated at startup via `@fastify/env`
**And** Pino structured logging is configured via Fastify's built-in logger

### Story 1.2: Paste Creation Flow

As a user,
I want to paste text and click Create to get a shareable link,
So that I can quickly save and share text snippets.

**Acceptance Criteria:**

**Given** I am on the root URL (`/`)
**When** the page loads
**Then** I see a large text area with placeholder text "Paste your text here..." in muted color (UX-DR8)
**And** a "Create" button is visible below the editor
**And** the Create button is disabled when the text area is empty (UX-DR3)

**Given** I have entered text in the editor
**When** I click the "Create" button or press Cmd/Ctrl+Enter (UX-DR3, UX-DR11)
**Then** a `POST /api/pastes` request is sent with the text content
**And** the system generates a nanoid (21 chars, ~126 bits entropy) as the paste ID
**And** the paste is stored in PostgreSQL with the content
**And** the response returns the paste ID in an `ApiResponse<T>` envelope within 1 second (NFR1)

**Given** the paste is created successfully
**When** the server responds with the paste ID
**Then** the browser navigates to `/:pasteId` without a full page reload
**And** the shareable URL is visible in the browser address bar

**Given** the root URL is loaded
**When** I inspect the page
**Then** Tailwind CSS v4.2 design tokens are applied: background #FFFFFF, text #1A1A1A, primary action #2563EB, muted text #6B7280 (UX-DR1)
**And** the editor uses a monospace font stack (JetBrains Mono / Fira Code / SF Mono / Consolas)
**And** UI elements use a sans-serif font stack (Inter / system fonts)

**Given** paste creation receives excessive requests from one client
**When** the rate limit is exceeded
**Then** the server returns a 429 response with an appropriate error in `ApiResponse<T>` envelope
**And** paste content exceeding 1MB is rejected with a validation error

### Story 1.3: Paste Viewing & Sharing

As a user,
I want to open a paste link and view its content with an easy way to copy and share the link,
So that anyone I share with can access my text.

**Acceptance Criteria:**

**Given** a paste exists with ID `abc123`
**When** I navigate to `/abc123`
**Then** the paste content loads and is visible within 2 seconds (NFR2)
**And** the content is displayed in a read-only text area with the same monospace font as the create page

**Given** I am on a paste page
**When** I look at the top of the page
**Then** I see a thin non-sticky PageHeader (UX-DR7) containing the ShareLink and a "New Paste" link back to root
**And** the header uses a semantic `<header>` element

**Given** I am on a paste page
**When** I click the "Copy" button next to the shareable URL (UX-DR4)
**Then** the paste URL is copied to my clipboard
**And** the button text changes to "Copied!" with green-600 color for 2 seconds, then reverts

**Given** I navigate to a paste URL that does not exist
**When** the server returns a 404
**Then** I see a centered "Paste not found" message with a link to create a new paste

**Given** a paste was created days ago
**When** I open the same URL later
**Then** the paste content loads exactly as it was saved (FR5, FR18)
**And** the paste persists across server restarts (NFR8)

**Given** I open a paste URL in any supported modern browser (Chrome, Firefox, Safari, Edge — latest 2 versions)
**When** the page loads
**Then** the paste content is displayed correctly (FR17)
**And** the Fastify server serves the SPA bundle via `@fastify/static` with fallback to `index.html` for client-side routing

## Epic 2: Real-Time Collaborative Editing

Multiple users can edit the same paste simultaneously with live sync and cursor presence. Real-time collaboration works — edits sync, cursors are visible, conflicts resolve automatically. Journey 1 (Quick Share to Live Collaboration) is fully enabled.

### Story 2.1: Real-Time Document Sync with Yjs & WebSocket

As a user,
I want my edits to a paste to be saved in real time,
So that I can edit existing pastes and my changes persist automatically.

**Acceptance Criteria:**

**Given** I am on a paste page (`/:pasteId`)
**When** the page loads
**Then** the editor is a CodeMirror 6 instance with Yjs binding (`y-codemirror.next`) replacing the basic textarea from Epic 1
**And** the editor uses the same monospace font stack (JetBrains Mono / Fira Code / SF Mono / Consolas)

**Given** I am on a paste page
**When** the CodeMirror editor initializes
**Then** a WebSocket connection is established to `GET /ws/:pasteId` via `@fastify/websocket`
**And** the Yjs document syncs with the server using the y-websocket sync protocol (FR11)

**Given** the server receives a WebSocket connection for a paste
**When** the paste exists in PostgreSQL
**Then** the document-manager loads the Yjs binary state from the `content` (bytea) column into an in-memory Yjs document
**And** the Yjs sync protocol sends the current document state to the connecting client

**Given** the server receives a WebSocket connection for a paste
**When** no in-memory Yjs document exists for that paste
**Then** a new Yjs document is created from the stored binary state and held in memory

**Given** I am editing a paste
**When** I type in the CodeMirror editor
**Then** edits are sent to the server via the Yjs WebSocket sync protocol
**And** the server-side Yjs document is updated in memory
**And** the document-manager persists the Yjs binary state to PostgreSQL on a debounced interval (5 seconds of inactivity) (FR2)

**Given** all clients disconnect from a paste
**When** the last WebSocket connection closes
**Then** the document-manager persists the final Yjs state to PostgreSQL immediately
**And** the in-memory Yjs document is cleaned up

**Given** the paste page component
**When** I inspect the implementation
**Then** a `useCollaboration(pasteId)` custom hook wires up the Yjs document, WebsocketProvider, and awareness protocol
**And** the hook returns document state, connection status, and connected users

### Story 2.2: Concurrent Multi-User Editing

As a user,
I want to edit a paste at the same time as others with all edits merging automatically,
So that we can collaborate without conflicts or data loss.

**Acceptance Criteria:**

**Given** two users have the same paste open
**When** both users type simultaneously in the CodeMirror editor
**Then** both users see each other's edits appear in real time within 1 second (NFR3)
**And** the Yjs CRDT resolves all concurrent edits without data loss or corruption (FR8)
**And** the final document state is identical for both users (NFR11)

**Given** a paste is open
**When** a second user opens the same paste URL
**Then** a new WebSocket connection joins the same room (paste ID = room name)
**And** both clients receive each other's edits via the Yjs sync protocol (FR6, FR7)

**Given** 10 users are concurrently editing the same paste
**When** all users type simultaneously
**Then** the system maintains acceptable performance (NFR5)
**And** all edits propagate to all connected users within 1 second (NFR3)
**And** no data corruption occurs (FR10)

**Given** one user inserts text at the beginning of the document
**When** another user simultaneously inserts text at the end
**Then** both insertions are preserved in their correct positions
**And** neither user's edits overwrite or displace the other's

**Given** two users edit the same line simultaneously
**When** their edits are concurrent
**Then** the Yjs CRDT merges both edits deterministically
**And** both clients converge to the same document state

### Story 2.3: Collaborator Cursor Presence

As a user,
I want to see where other collaborators are editing in the document,
So that I can coordinate and avoid editing the same area.

**Acceptance Criteria:**

**Given** two or more users have the same paste open
**When** a remote user places their cursor in the document
**Then** a thin vertical colored line (CursorIndicator) appears at the remote user's cursor position (FR9, UX-DR5)
**And** the cursor color is assigned from the palette: violet (#8B5CF6), pink (#EC4899), orange (#F97316), teal (#14B8A6), yellow (#EAB308) — in order of arrival
**And** cursors 6-10 cycle through the palette with reduced opacity

**Given** a remote collaborator is typing
**When** their cursor position changes
**Then** the CursorIndicator transitions smoothly to the new position (150ms transition)
**And** the cursor position update is visible within 500ms (NFR4)

**Given** a remote collaborator disconnects
**When** their WebSocket connection closes
**Then** their CursorIndicator fades out gracefully
**And** the cursor is removed from the awareness state

**Given** I am the only user on a paste
**When** no other users are connected
**Then** no CursorIndicators are displayed
**And** the interface is clean with no collaboration artifacts

**Given** the CursorIndicator component
**When** rendered in the editor
**Then** it has `aria-hidden="true"` since cursor indicators are purely visual and supplementary
**And** cursor presence is managed via the Yjs awareness protocol

## Epic 3: Connection Resilience & Reliability

Users maintain reliable connections with auto-recovery, ensuring no edits are ever lost. Connections recover silently, state syncs after drops, and disconnects are handled gracefully. Journey 2 (Returning to Stale Paste) is fully enabled.

### Story 3.1: Auto-Reconnection & State Synchronization

As a user,
I want my connection to recover automatically when it drops with all missed edits caught up seamlessly,
So that I never lose work or have to manually refresh.

**Acceptance Criteria:**

**Given** I am editing a paste with an active WebSocket connection
**When** my network connection drops temporarily
**Then** the Yjs WebsocketProvider detects the disconnection and begins automatic reconnection attempts (FR12, NFR9)
**And** no user action is required to reconnect

**Given** my connection was lost while others continued editing
**When** the WebSocket reconnects successfully
**Then** the Yjs sync protocol merges all missed updates into my local document (FR13)
**And** the document state is consistent with all other connected clients (NFR10)
**And** no edits are lost, duplicated, or corrupted (NFR11)

**Given** I made edits while disconnected (offline edits buffered by Yjs)
**When** the connection is restored
**Then** my local edits are sent to the server via the Yjs sync protocol
**And** they are merged with any concurrent edits from other users without conflict
**And** all clients converge to the same document state

**Given** the server still has the in-memory Yjs document for the paste
**When** a client reconnects
**Then** the sync protocol efficiently sends only the missing updates (not the full document)
**And** the catch-up completes within 1 second for typical edit volumes

**Given** the server was restarted while I had a paste open
**When** my client reconnects
**Then** the server loads the Yjs document from PostgreSQL binary state
**And** my client syncs against the restored document
**And** the document state is consistent (NFR8)

### Story 3.2: Graceful Disconnection & Connection Status

As a user,
I want to see my connection health at a glance and know the system handles disconnections cleanly,
So that I have confidence my work is always safe.

**Acceptance Criteria:**

**Given** I am on a paste page with an active WebSocket connection
**When** the connection is healthy
**Then** a small green filled dot is visible in the bottom-right corner of the page (UX-DR6)
**And** hovering the dot shows a tooltip with text "Connected"

**Given** my WebSocket connection drops
**When** the system begins reconnection attempts
**Then** the status dot changes to an amber hollow ring with a pulsing animation (UX-DR6)
**And** hovering shows tooltip text "Reconnecting..."

**Given** the connection has been lost for more than 30 seconds
**When** reconnection attempts are ongoing
**Then** a subtle inline message "Reconnecting..." appears below the header in muted text
**And** the amber pulsing dot continues to show

**Given** reconnection attempts fail for an extended period
**When** the system determines the connection is lost
**Then** the status dot changes to a red filled dot
**And** hovering shows tooltip text "Disconnected"

**Given** the ConnectionStatus component
**When** the connection state changes
**Then** the state change is announced to screen readers via `aria-live="polite"`
**And** the component uses `aria-label` describing the current connection state

**Given** a user closes their browser tab or navigates away
**When** the WebSocket connection closes
**Then** the server handles the disconnection gracefully (FR14)
**And** the user's awareness state (cursor) is cleaned up from the Yjs awareness protocol
**And** if this was the last connected client, the document-manager persists the Yjs state to PostgreSQL immediately

**Given** the user has `prefers-reduced-motion` enabled
**When** the connection status is "reconnecting"
**Then** the amber dot does not pulse and instead shows a static amber hollow ring

## Epic 4: UX Polish & Accessibility

Users enjoy a polished, responsive, accessible experience with keyboard shortcuts across all devices. The product is responsive on mobile/tablet, meets WCAG AA, supports keyboard power users, and handles loading/error states gracefully. Production Docker build completes the deployment story.

### Story 4.1: Responsive Layout

As a user,
I want the product to work well on desktop, tablet, and mobile,
So that I can read and share pastes from any device.

**Acceptance Criteria:**

**Given** I am on the create page (`/`) on a desktop browser (1024px+)
**When** the page renders
**Then** the editor area is centered with a max-width of 800px
**And** generous whitespace surrounds the content
**And** the Create button is positioned below the editor at its natural width (UX-DR9)

**Given** I am on a paste page on a desktop browser (1024px+)
**When** the page renders
**Then** the editor takes the full available width with 16px padding
**And** the PageHeader spans the full width

**Given** I am on any page on a tablet (768px - 1023px)
**When** the page renders
**Then** the layout matches desktop with slightly reduced padding
**And** all interactive elements (Create button, Copy button, New Paste link) have a minimum touch target of 44x44px

**Given** I am on the create page on a mobile device (320px - 767px)
**When** the page renders
**Then** the editor is full-width with minimal padding (8px-12px)
**And** the Create button is full-width below the editor
**And** the layout is stacked vertically

**Given** I am on a paste page on a mobile device
**When** the page renders
**Then** the content is fully readable with appropriate font sizing
**And** the Copy link button is prominently sized for thumb targeting (44px+ touch target)
**And** CursorIndicators for collaborators are visible but simplified

**Given** the implementation uses Tailwind CSS
**When** I inspect the responsive styles
**Then** desktop-first CSS is used with responsive prefixes (`sm:`, `md:`, `lg:`) for smaller breakpoint overrides
**And** typography uses `rem` units, borders/shadows use `px`, and layout widths use `%` or `vw`

### Story 4.2: Accessibility & Keyboard Shortcuts

As a user,
I want the product to be fully keyboard-navigable and accessible,
So that everyone can use it regardless of ability or input method.

**Acceptance Criteria:**

**Given** I am navigating the product with a keyboard only
**When** I press Tab to move through interactive elements
**Then** each element shows a visible focus ring (2px solid blue, offset 2px) (UX-DR10)
**And** I can reach all interactive elements: Create button, editor, Copy button, New Paste link
**And** focus order follows a logical reading sequence

**Given** the page structure
**When** I inspect the HTML
**Then** semantic elements are used: `<main>` for content area, `<header>` for PageHeader, `<button>` for actions, `<textarea>` or CodeMirror's accessible role for the editor (UX-DR10)
**And** all interactive elements without visible text labels have `aria-label` attributes

**Given** I am a keyboard user landing on any page
**When** I press Tab for the first time
**Then** the first focusable element is a "Skip to content" link that jumps to `#main-content`

**Given** I am on a paste page
**When** I press Cmd/Ctrl+Shift+C (UX-DR11)
**Then** the paste URL is copied to my clipboard
**And** the ShareLink component shows the "Copied!" confirmation

**Given** the user has `prefers-reduced-motion` enabled in their OS settings
**When** any animation would normally play (cursor transitions, status dot pulse)
**Then** the animation is suppressed or reduced to a static state (UX-DR10)

**Given** I run an automated accessibility audit (axe-core or Lighthouse)
**When** the audit scans all pages
**Then** no WCAG 2.1 AA violations are reported
**And** all text meets 4.5:1 contrast ratio against backgrounds
**And** all large text meets 3:1 contrast ratio

### Story 4.3: Loading States & Production Build

As a user,
I want smooth loading states and a reliable deployment,
So that the product feels fast and the team can ship with confidence.

**Acceptance Criteria:**

**Given** I navigate to a paste URL
**When** the paste content is loading from the server
**Then** the editor container is shown immediately with a shimmer/skeleton effect on the content area (UX-DR12)
**And** no full-page spinner is displayed
**And** the content appears once loaded (within 2 seconds per NFR2)

**Given** paste creation fails due to a network or server error
**When** the error response is received
**Then** the Create button text changes to "Retry" with a muted error message below it (UX-DR12)
**And** clicking "Retry" re-attempts the paste creation

**Given** I navigate to a paste URL that does not exist
**When** the server returns a 404
**Then** I see a centered "Paste not found" message with a link to create a new paste (UX-DR12)
**And** no broken UI or unhandled error state is shown

**Given** the Dockerfile
**When** a production build is executed
**Then** a multi-stage Docker build compiles TypeScript, bundles the client via Vite, and produces a Node.js 22 Alpine production image
**And** the production image runs `node packages/server/dist/index.js`
**And** Fastify serves the client bundle from `packages/client/dist/` via `@fastify/static`

**Given** the docker-compose.yml
**When** `docker compose up` is run
**Then** the `app` service (Fastify) and `postgres` service (PostgreSQL 17) both start
**And** PostgreSQL data is persisted via a named Docker volume
**And** the app connects to PostgreSQL using the `DATABASE_URL` environment variable

**Given** the production deployment
**When** the server starts
**Then** environment variables (`DATABASE_URL`, `PORT`, `NODE_ENV`) are validated via `@fastify/env`
**And** Drizzle migrations have been run as a separate step in the Docker build
**And** the health endpoint (`GET /api/health`) returns 200
