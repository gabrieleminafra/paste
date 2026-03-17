// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

// Mock useCollaboration hook
const mockUseCollaboration = vi.fn()
vi.mock('../hooks/useCollaboration', () => ({
  useCollaboration: (...args: any[]) => mockUseCollaboration(...args),
}))

// Mock PasteEditor
vi.mock('../components/PasteEditor', () => ({
  default: () => <div data-testid="paste-editor">Mock PasteEditor</div>,
}))

// Mock ConnectionStatus
const mockConnectionStatusComponent = vi.fn()
vi.mock('../components/ConnectionStatus', () => ({
  default: (props: { status: string }) => {
    mockConnectionStatusComponent(props)
    return <div data-testid="connection-status" data-status={props.status}>ConnectionStatus</div>
  },
}))

import PastePage from './PastePage'

function renderWithRoute(pasteId: string) {
  return render(
    <MemoryRouter initialEntries={[`/${pasteId}`]}>
      <Routes>
        <Route path="/:pasteId" element={<PastePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PastePage', () => {
  const originalClipboard = navigator.clipboard

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    mockConnectionStatusComponent.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    })
  })

  it('shows loading skeleton while connecting', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'connecting',
      connectedUsers: 0,
      undoManager: {},
    })

    renderWithRoute('abc123')

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders PageHeader', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'connecting',
      connectedUsers: 0,
      undoManager: {},
    })

    renderWithRoute('abc123')

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByText('New Paste')).toBeInTheDocument()
  })

  it('renders PasteEditor when connected', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'connected',
      connectedUsers: 1,
      undoManager: {},
    })

    renderWithRoute('abc123')

    expect(screen.getByTestId('paste-editor')).toBeInTheDocument()
  })

  it('renders main content area with id="main-content"', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'connected',
      connectedUsers: 1,
      undoManager: {},
    })

    renderWithRoute('abc123')

    expect(document.getElementById('main-content')).toBeInTheDocument()
  })

  it('keeps editor visible when disconnected (local Yjs doc still has content)', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'disconnected',
      connectedUsers: 0,
      undoManager: {},
    })

    renderWithRoute('abc123')

    expect(screen.getByTestId('paste-editor')).toBeInTheDocument()
    expect(screen.queryByText('Connection lost')).not.toBeInTheDocument()
  })

  it('keeps editor visible during reconnecting state', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'reconnecting',
      connectedUsers: 0,
      undoManager: {},
    })

    renderWithRoute('abc123')

    expect(screen.getByTestId('paste-editor')).toBeInTheDocument()
    expect(document.querySelector('.animate-pulse')).not.toBeInTheDocument()
  })

  it('only shows skeleton loader during initial connecting state', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'connecting',
      connectedUsers: 0,
      undoManager: {},
    })

    renderWithRoute('abc123')

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByTestId('paste-editor')).not.toBeInTheDocument()
  })

  it('shows "Paste not found" when connection closes with 4404', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'not-found',
      connectedUsers: 0,
      undoManager: {},
    })

    renderWithRoute('nonexistent')

    expect(screen.getByText('Paste not found')).toBeInTheDocument()
    expect(screen.getByText('Create a new paste')).toHaveAttribute('href', '/')
  })

  it('renders without error when multiple users are connected', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'connected',
      connectedUsers: 3,
      undoManager: {},
    })

    renderWithRoute('abc123')

    expect(screen.getByTestId('paste-editor')).toBeInTheDocument()
    expect(mockUseCollaboration).toHaveReturnedWith(
      expect.objectContaining({ connectedUsers: 3 }),
    )
  })

  it('shows no collaboration artifacts when only 1 user is connected', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'connected',
      connectedUsers: 1,
      undoManager: {},
    })

    renderWithRoute('abc123')

    // Editor should render but no cursor-related collaboration UI should appear
    expect(screen.getByTestId('paste-editor')).toBeInTheDocument()
    // No cursor indicator or presence UI elements in the page
    expect(screen.queryByTestId('cursor-indicator')).toBeNull()
    expect(screen.queryByTestId('presence-sidebar')).toBeNull()
  })

  it('calls useCollaboration with the pasteId from route params', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'connecting',
      connectedUsers: 0,
      undoManager: {},
    })

    renderWithRoute('my-paste-id')

    expect(mockUseCollaboration).toHaveBeenCalledWith('my-paste-id')
  })

  it('renders ConnectionStatus with correct status when connected', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'connected',
      connectedUsers: 1,
      undoManager: {},
    })

    renderWithRoute('abc123')

    const cs = screen.getByTestId('connection-status')
    expect(cs).toBeInTheDocument()
    expect(cs).toHaveAttribute('data-status', 'connected')
  })

  it('renders ConnectionStatus when reconnecting', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'reconnecting',
      connectedUsers: 0,
      undoManager: {},
    })

    renderWithRoute('abc123')

    const cs = screen.getByTestId('connection-status')
    expect(cs).toBeInTheDocument()
    expect(cs).toHaveAttribute('data-status', 'reconnecting')
  })

  it('does NOT render ConnectionStatus during initial connecting state', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'connecting',
      connectedUsers: 0,
      undoManager: {},
    })

    renderWithRoute('abc123')

    expect(screen.queryByTestId('connection-status')).not.toBeInTheDocument()
  })

  it('does NOT render ConnectionStatus for not-found state', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'not-found',
      connectedUsers: 0,
      undoManager: {},
    })

    renderWithRoute('abc123')

    expect(screen.queryByTestId('connection-status')).not.toBeInTheDocument()
  })

  it('shows "Reconnecting..." message after 30s in reconnecting state', () => {
    vi.useFakeTimers()

    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'reconnecting',
      connectedUsers: 0,
      undoManager: {},
    })

    renderWithRoute('abc123')

    // Not visible yet
    expect(screen.queryByText('Reconnecting...')).not.toBeInTheDocument()

    // Advance 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000)
    })

    expect(screen.getByText('Reconnecting...')).toBeInTheDocument()

    vi.useRealTimers()
  })

  // Responsive layout tests (Story 4.1)
  describe('responsive layout', () => {
    it('uses full-width layout without max-w-800px constraint on desktop', () => {
      mockUseCollaboration.mockReturnValue({
        ytext: {},
        awareness: {},
        connectionStatus: 'connected',
        connectedUsers: 1,
        undoManager: {},
      })

      renderWithRoute('abc123')

      const main = document.getElementById('main-content')
      expect(main?.className).toContain('px-4')
      // Should NOT have max-w-[800px] on the editor wrapper
      const editorWrapper = screen.getByTestId('paste-editor').parentElement
      expect(editorWrapper?.className).not.toContain('max-w-[800px]')
      expect(editorWrapper?.className).toContain('w-full')
    })

    it('applies mobile padding to main content area', () => {
      mockUseCollaboration.mockReturnValue({
        ytext: {},
        awareness: {},
        connectionStatus: 'connected',
        connectedUsers: 1,
        undoManager: {},
      })

      renderWithRoute('abc123')

      const main = document.getElementById('main-content')
      expect(main?.className).toContain('max-md:px-2')
      expect(main?.className).toContain('max-md:pt-4')
    })

    it('applies mobile padding to skeleton loading state', () => {
      mockUseCollaboration.mockReturnValue({
        ytext: {},
        awareness: {},
        connectionStatus: 'connecting',
        connectedUsers: 0,
        undoManager: {},
      })

      renderWithRoute('abc123')

      const main = document.getElementById('main-content')
      expect(main?.className).toContain('max-md:px-2')
      expect(main?.className).toContain('max-md:pt-4')
    })

    it('applies mobile padding to not-found state', () => {
      mockUseCollaboration.mockReturnValue({
        ytext: {},
        awareness: {},
        connectionStatus: 'not-found',
        connectedUsers: 0,
        undoManager: {},
      })

      renderWithRoute('abc123')

      const main = document.getElementById('main-content')
      expect(main?.className).toContain('max-md:px-2')
    })

    it('not-found "Create a new paste" link has touch target on tablet/mobile', () => {
      mockUseCollaboration.mockReturnValue({
        ytext: {},
        awareness: {},
        connectionStatus: 'not-found',
        connectedUsers: 0,
        undoManager: {},
      })

      renderWithRoute('abc123')

      const createLink = screen.getByText('Create a new paste')
      expect(createLink.className).toContain('max-lg:min-h-[44px]')
    })

    it('skeleton loader uses full-width without max-w-800px', () => {
      mockUseCollaboration.mockReturnValue({
        ytext: {},
        awareness: {},
        connectionStatus: 'connecting',
        connectedUsers: 0,
        undoManager: {},
      })

      renderWithRoute('abc123')

      const skeletonWrapper = document.querySelector('.animate-pulse')?.parentElement
      expect(skeletonWrapper?.className).not.toContain('max-w-[800px]')
      expect(skeletonWrapper?.className).toContain('w-full')
    })
  })

  it('hides "Reconnecting..." message when status returns to connected', () => {
    vi.useFakeTimers()

    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'reconnecting',
      connectedUsers: 0,
      undoManager: {},
    })

    const { rerender } = render(
      <MemoryRouter initialEntries={['/abc123']}>
        <Routes>
          <Route path="/:pasteId" element={<PastePage />} />
        </Routes>
      </MemoryRouter>,
    )

    act(() => {
      vi.advanceTimersByTime(30000)
    })
    expect(screen.getByText('Reconnecting...')).toBeInTheDocument()

    // Reconnect
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'connected',
      connectedUsers: 1,
      undoManager: {},
    })

    rerender(
      <MemoryRouter initialEntries={['/abc123']}>
        <Routes>
          <Route path="/:pasteId" element={<PastePage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByText('Reconnecting...')).not.toBeInTheDocument()

    vi.useRealTimers()
  })
})
