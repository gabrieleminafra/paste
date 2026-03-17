# Story 4.1: Responsive Layout

Status: done

## Story

As a user,
I want the product to work well on desktop, tablet, and mobile,
So that I can read and share pastes from any device.

## Acceptance Criteria

1. **Given** I am on the create page (`/`) on a desktop browser (1024px+)
   **When** the page renders
   **Then** the editor area is centered with a max-width of 800px
   **And** generous whitespace surrounds the content
   **And** the Create button is positioned below the editor at its natural width (UX-DR9)

2. **Given** I am on a paste page on a desktop browser (1024px+)
   **When** the page renders
   **Then** the editor takes the full available width with 16px padding
   **And** the PageHeader spans the full width

3. **Given** I am on any page on a tablet (768px - 1023px)
   **When** the page renders
   **Then** the layout matches desktop with slightly reduced padding
   **And** all interactive elements (Create button, Copy button, New Paste link) have a minimum touch target of 44x44px

4. **Given** I am on the create page on a mobile device (320px - 767px)
   **When** the page renders
   **Then** the editor is full-width with minimal padding (8px-12px)
   **And** the Create button is full-width below the editor
   **And** the layout is stacked vertically

5. **Given** I am on a paste page on a mobile device
   **When** the page renders
   **Then** the content is fully readable with appropriate font sizing
   **And** the Copy link button is prominently sized for thumb targeting (44px+ touch target)
   **And** CursorIndicators for collaborators are visible but simplified

6. **Given** the implementation uses Tailwind CSS
   **When** I inspect the responsive styles
   **Then** desktop-first CSS is used with responsive prefixes (`sm:`, `md:`, `lg:`) for smaller breakpoint overrides
   **And** typography uses `rem` units, borders/shadows use `px`, and layout widths use `%` or `vw`

## Tasks / Subtasks

- [x] Task 1: Make CreatePage responsive (AC: #1, #4, #6)
  - [x] 1.1 Add mobile breakpoint: full-width editor with 8-12px padding (`max-md:px-2 max-md:pt-4`)
  - [x] 1.2 Make Create button full-width on mobile (`max-md:w-full` via CreateButton + `max-md:flex-col` on container)
  - [x] 1.3 Reduce padding on tablet (`max-lg:px-3 max-lg:pt-8`)
  - [x] 1.4 Ensure min 44px touch targets on tablet/mobile for Create button
  - [x] 1.5 Write responsive tests for CreatePage

- [x] Task 2: Make PastePage responsive (AC: #2, #5, #6)
  - [x] 2.1 Full-width editor on desktop (removed max-w-[800px] on paste page, kept 16px padding)
  - [x] 2.2 Reduce padding on mobile (`max-md:px-2 max-md:pt-4`)
  - [x] 2.3 Ensure readable font sizing on mobile (CodeMirror content — inherits responsive sizing)
  - [x] 2.4 Write responsive tests for PastePage

- [x] Task 3: Make PageHeader responsive (AC: #3, #5)
  - [x] 3.1 Stack ShareLink and "New Paste" link vertically on mobile if needed, or keep inline with smaller font
  - [x] 3.2 Ensure 44px+ touch targets on Copy button and New Paste link for mobile/tablet
  - [x] 3.3 Write responsive tests for PageHeader

- [x] Task 4: Make ShareLink responsive (AC: #5)
  - [x] 4.1 Ensure Copy button has 44px+ touch target on mobile (`max-md:min-h-[44px] max-md:min-w-[44px]`)
  - [x] 4.2 Ensure URL input remains readable and doesn't overflow on mobile
  - [x] 4.3 Write responsive tests for ShareLink

- [x] Task 5: Make CreateButton responsive (AC: #3, #4)
  - [x] 5.1 Ensure 44px min touch target on tablet/mobile (`max-lg:min-h-[44px]`)
  - [x] 5.2 Write responsive tests for CreateButton

- [x] Task 6: Verify ConnectionStatus on mobile (AC: #5)
  - [x] 6.1 Ensure ConnectionStatus dot doesn't overlap content on small screens (`max-md:bottom-2 max-md:right-2`)
  - [x] 6.2 Write test for ConnectionStatus positioning on mobile

## Dev Notes

### Breakpoint Strategy (Desktop-First)

The project uses Tailwind CSS v4.2. Since the design is **desktop-first**, use Tailwind's `max-*` responsive variants for smaller breakpoints:

| Breakpoint | Width | Tailwind Prefix |
|---|---|---|
| Mobile | 320px - 767px | `max-sm:` (below 640px) or custom `max-md:` (below 768px) |
| Tablet | 768px - 1023px | `max-lg:` (below 1024px) |
| Desktop | 1024px+ | Default (no prefix) |

**Important:** Tailwind v4 supports `max-*` variants natively. Since the epics specify desktop-first with responsive overrides for smaller screens, use `max-sm:` and `max-lg:` rather than the mobile-first `sm:` / `lg:` approach.

**Custom breakpoint note:** The epics specify 767px as the mobile/tablet boundary. Tailwind's default `sm` breakpoint is 640px and `md` is 768px. For exact spec compliance, use `max-md:` for mobile styles (applies below 768px) and `max-lg:` for tablet styles (applies below 1024px).

### Unit Conventions (per UX spec)

- Typography: `rem` units
- Borders/shadows: `px` units
- Layout widths: `%` or `vw`

### Current Layout Analysis

**CreatePage (`packages/client/src/pages/CreatePage.tsx`):**
- Currently: `min-h-screen flex items-start justify-center pt-12 px-4` with child `w-full max-w-[800px]`
- Desktop is already correct (centered 800px max-width)
- Needs: mobile padding reduction (px-4 → max-md:px-2), mobile full-width button, tablet touch targets

**PastePage (`packages/client/src/pages/PastePage.tsx`):**
- Currently: uses `max-w-[800px]` for the editor container
- Per AC#2: paste page editor should be **full available width with 16px padding** on desktop — remove `max-w-[800px]` constraint on the main content area
- The skeleton loader and not-found states also use `max-w-[800px]` — update consistently
- Needs: mobile padding reduction, readable font sizing

**PageHeader (`packages/client/src/components/PageHeader.tsx`):**
- Currently: `flex items-center justify-between px-4 py-2 border-b`
- Already spans full width — good
- Needs: 44px touch targets on mobile for "New Paste" link and Copy button

**CreateButton (`packages/client/src/components/CreateButton.tsx`):**
- Currently: `rounded-md px-4 py-2` (approx 36px height)
- Needs: 44px min-height on tablet/mobile, full-width on mobile (passed as className or prop)

**ShareLink (`packages/client/src/components/ShareLink.tsx`):**
- Currently: Copy button is `px-3 py-1.5` (approx 32px height)
- Needs: 44px min touch target on mobile

**ConnectionStatus (`packages/client/src/components/ConnectionStatus.tsx`):**
- Currently: `fixed bottom-4 right-4 z-50`
- Should work on mobile but verify no content overlap

### Touch Target Implementation

The 44x44px touch target requirement (WCAG 2.5.8) can be met by:
- Adding `min-h-[44px] min-w-[44px]` on mobile/tablet breakpoints
- Or using padding to expand the hit area

### Testing Approach

Use the existing test patterns with `@testing-library/react`. Test responsive classes are applied correctly by checking element className or computed styles. Since the project uses `@vitest-environment jsdom`, you cannot test actual CSS media queries. Instead:
- Test that responsive Tailwind classes exist on rendered elements
- Test that mobile-specific props/classes are applied
- Verify no regressions in existing functionality

### Project Structure Notes

- All component files are in `packages/client/src/components/` with colocated `.test.tsx` files
- Page files are in `packages/client/src/pages/` with colocated `.test.tsx` files
- Tailwind theme config is in `packages/client/src/index.css` using `@theme` directive
- No new files needed — this story modifies existing components only
- Server code is NOT touched by this story

### Previous Story Intelligence

**From Story 3.1 (auto-reconnection):**
- PastePage has multiple render paths: `connecting` (skeleton), `not-found`, and main editor view — all must be made responsive
- `useCollaboration` hook manages connection state — no changes needed for this story
- Test count was 117 after Story 3.1 — expect 125-135 after this story

**From Story 3.2 (connection status — ready-for-dev):**
- ConnectionStatus component already exists with `fixed bottom-4 right-4` positioning
- Story 3.2 may or may not be implemented before this story — handle both cases

### Git Intelligence

**Recent commit pattern:** `feat: Story X.Y — description with code review fixes`
**Files pattern:** Each story modifies existing components + their test files
**Test convention:** Colocated test files, `@vitest-environment jsdom` directive, `vi.mock` for hooks

### Key Libraries

- **Tailwind CSS 4.2:** Uses `@import "tailwindcss"` and `@theme` block in index.css. Responsive prefixes like `max-sm:`, `max-md:`, `max-lg:` are native in v4.
- **CodeMirror 6:** Editor height/width is controlled via EditorView.theme extensions. The `min-h-[60vh]` on the wrapper div controls visible area. On mobile, consider reducing this (e.g., `max-md:min-h-[40vh]`).
- **React Testing Library 16.3.2 + Vitest 4.1.0:** Standard render/screen/cleanup pattern.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 4, Story 4.1]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Responsive Design & Accessibility section]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Implementation Guidelines section]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- No debug issues encountered during implementation

### Completion Notes List
- Implemented desktop-first responsive design using Tailwind CSS v4.2 `max-*` variants
- Used `max-md:` (below 768px) for mobile breakpoint and `max-lg:` (below 1024px) for tablet breakpoint per spec
- CreatePage: Added mobile/tablet padding reduction, mobile full-width button via flex-col container, reduced textarea min-height on mobile
- PastePage: Removed `max-w-[800px]` constraint from both connected and skeleton states for full-width editor on desktop, added mobile padding
- PageHeader: Added 44px touch targets on "New Paste" link for tablet/mobile (`max-lg:`) with flex alignment
- ShareLink: Added 44px touch targets on Copy button for tablet/mobile (`max-lg:`); URL input already had `min-w-0` for overflow prevention
- PastePage not-found view: Added responsive padding (`max-md:px-2`) and 44px touch target on "Create a new paste" link
- CreateButton: Added `max-lg:min-h-[44px]` for tablet/mobile touch target and `max-md:w-full` for mobile full-width
- ConnectionStatus: Reduced fixed positioning on mobile (`max-md:bottom-2 max-md:right-2`) to prevent edge overlap
- All 152 tests pass (20 test files), 16 responsive tests added, zero regressions
- Pre-existing ESLint warning in PastePage (setState in effect) — not introduced by this story

### File List
- packages/client/src/pages/CreatePage.tsx (modified)
- packages/client/src/pages/CreatePage.test.tsx (modified)
- packages/client/src/pages/PastePage.tsx (modified)
- packages/client/src/pages/PastePage.test.tsx (modified)
- packages/client/src/components/PageHeader.tsx (modified)
- packages/client/src/components/PageHeader.test.tsx (modified)
- packages/client/src/components/ShareLink.tsx (modified)
- packages/client/src/components/ShareLink.test.tsx (modified)
- packages/client/src/components/CreateButton.tsx (modified)
- packages/client/src/components/CreateButton.test.tsx (modified)
- packages/client/src/components/ConnectionStatus.tsx (modified)
- packages/client/src/components/ConnectionStatus.test.tsx (modified)

### Change Log
- 2026-03-17: Story 4.1 — Responsive layout implementation complete. Desktop-first responsive design with Tailwind CSS `max-md:` and `max-lg:` variants. 14 new tests added, 150 total passing.
- 2026-03-17: Code review fixes — Touch targets on ShareLink/PageHeader widened from `max-md:` to `max-lg:` for AC#3 tablet compliance. Not-found view given responsive padding and touch target. 152 total passing.
