// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import * as Y from 'yjs'

vi.mock('codemirror', () => {
  const MockView = Object.assign(
    class {
      destroy() { /* noop */ }
    },
    { theme: () => [], lineWrapping: [] },
  )
  return { EditorView: MockView, basicSetup: [] }
})

let capturedExtensions: unknown[] = []
vi.mock('@codemirror/state', () => ({
  EditorState: { create: (config: { extensions?: unknown[] }) => { capturedExtensions = (config.extensions ?? []) as unknown[]; return {} } },
}))

vi.mock('@codemirror/view', () => {
  const MockView = Object.assign(
    class {
      destroy() { /* noop */ }
    },
    { theme: () => [], lineWrapping: [] },
  )
  return { EditorView: MockView }
})

const mockYCollab = vi.fn().mockReturnValue([])
vi.mock('y-codemirror.next', () => ({
  yCollab: (...args: unknown[]) => mockYCollab(...args),
}))

vi.mock('./CursorIndicator', () => ({
  cursorIndicatorTheme: '__cursorIndicatorTheme__',
  cursorReducedMotionTheme: '__cursorReducedMotionTheme__',
}))

import PasteEditor from './PasteEditor'

describe('PasteEditor', () => {
  let doc: Y.Doc

  beforeEach(() => {
    capturedExtensions = []
    // Default: no reduced motion
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    })
  })

  afterEach(() => {
    cleanup()
    doc?.destroy()
  })

  function createProps() {
    doc = new Y.Doc()
    const ytext = doc.getText('content')
    const awareness = { on: vi.fn(), off: vi.fn(), getStates: vi.fn().mockReturnValue(new Map()) } as any
    const undoManager = new Y.UndoManager(ytext)
    return { ytext, awareness, undoManager }
  }

  it('renders editor container with data-testid', () => {
    render(<PasteEditor {...createProps()} />)
    expect(screen.getByTestId('paste-editor')).toBeInTheDocument()
  })

  it('applies correct CSS classes to container', () => {
    render(<PasteEditor {...createProps()} />)
    const container = screen.getByTestId('paste-editor')
    expect(container).toHaveClass('w-full', 'min-h-[60vh]', 'border', 'border-border', 'rounded-md')
  })

  it('mounts and unmounts without errors', () => {
    const { unmount } = render(<PasteEditor {...createProps()} />)
    expect(screen.getByTestId('paste-editor')).toBeInTheDocument()
    unmount()
  })

  it('includes yCollab extension with ytext and awareness', () => {
    const props = createProps()
    render(<PasteEditor {...props} />)

    expect(mockYCollab).toHaveBeenCalledWith(
      props.ytext,
      props.awareness,
      expect.objectContaining({ undoManager: props.undoManager }),
    )
  })

  it('includes cursorIndicatorTheme in extensions', () => {
    render(<PasteEditor {...createProps()} />)
    expect(capturedExtensions).toContain('__cursorIndicatorTheme__')
  })

  it('excludes cursorReducedMotionTheme when prefers-reduced-motion is not set', () => {
    render(<PasteEditor {...createProps()} />)
    expect(capturedExtensions).not.toContain('__cursorReducedMotionTheme__')
  })

  it('includes cursorReducedMotionTheme when prefers-reduced-motion is set', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    })

    render(<PasteEditor {...createProps()} />)
    expect(capturedExtensions).toContain('__cursorReducedMotionTheme__')
  })
})
