// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
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

  it('shows shimmer skeleton while connecting', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'connecting',
      connectedUsers: 0,
      undoManager: {},
    })

    renderWithRoute('abc123')

    const skeleton = screen.getByTestId('shimmer-skeleton')
    expect(skeleton).toBeInTheDocument()
    // Multiple shimmer bars mimicking text lines
    const shimmerBars = skeleton.querySelectorAll('.shimmer-bar')
    expect(shimmerBars.length).toBeGreaterThanOrEqual(5)
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
    expect(screen.queryByTestId('shimmer-skeleton')).not.toBeInTheDocument()
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

    expect(screen.getByTestId('shimmer-skeleton')).toBeInTheDocument()
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

  it('does not show editor or skeleton on not-found state', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'not-found',
      connectedUsers: 0,
      undoManager: {},
    })

    renderWithRoute('nonexistent')

    expect(screen.queryByTestId('paste-editor')).not.toBeInTheDocument()
    expect(screen.queryByTestId('shimmer-skeleton')).not.toBeInTheDocument()
    expect(screen.getByText('Paste not found')).toBeInTheDocument()
    const link = screen.getByText('Create a new paste')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/')
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
    it('uses full-width layout filling remaining viewport height', () => {
      mockUseCollaboration.mockReturnValue({
        ytext: {},
        awareness: {},
        connectionStatus: 'connected',
        connectedUsers: 1,
        undoManager: {},
      })

      renderWithRoute('abc123')

      const main = document.getElementById('main-content')
      expect(main?.className).toContain('flex-1')
      expect(main?.className).toContain('p-4')
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
      expect(main?.className).toContain('max-md:p-2')
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
      expect(main?.className).toContain('max-md:p-2')
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

    it('skeleton loader fills available height', () => {
      mockUseCollaboration.mockReturnValue({
        ytext: {},
        awareness: {},
        connectionStatus: 'connecting',
        connectedUsers: 0,
        undoManager: {},
      })

      renderWithRoute('abc123')

      const skeleton = screen.getByTestId('shimmer-skeleton')
      expect(skeleton.className).toContain('h-full')
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

  // Keyboard shortcut tests (Story 4.2)
  describe('Cmd/Ctrl+Shift+C keyboard shortcut', () => {
    it('copies paste URL to clipboard on Cmd+Shift+C', async () => {
      mockUseCollaboration.mockReturnValue({
        ytext: {},
        awareness: {},
        connectionStatus: 'connected',
        connectedUsers: 1,
        undoManager: {},
      })

      renderWithRoute('abc123')

      await act(async () => {
        fireEvent.keyDown(window, { key: 'c', metaKey: true, shiftKey: true })
      })

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.href)
    })

    it('copies paste URL to clipboard on Ctrl+Shift+C', async () => {
      mockUseCollaboration.mockReturnValue({
        ytext: {},
        awareness: {},
        connectionStatus: 'connected',
        connectedUsers: 1,
        undoManager: {},
      })

      renderWithRoute('abc123')

      await act(async () => {
        fireEvent.keyDown(window, { key: 'c', ctrlKey: true, shiftKey: true })
      })

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.href)
    })

    it('shows "Copied!" confirmation in ShareLink after shortcut', async () => {
      vi.useFakeTimers()

      mockUseCollaboration.mockReturnValue({
        ytext: {},
        awareness: {},
        connectionStatus: 'connected',
        connectedUsers: 1,
        undoManager: {},
      })

      renderWithRoute('abc123')

      await act(async () => {
        fireEvent.keyDown(window, { key: 'c', metaKey: true, shiftKey: true })
      })

      expect(screen.getByText('Copied!')).toBeInTheDocument()

      vi.useRealTimers()
    })

    it('does NOT copy on Cmd+C without Shift (standard copy)', async () => {
      mockUseCollaboration.mockReturnValue({
        ytext: {},
        awareness: {},
        connectionStatus: 'connected',
        connectedUsers: 1,
        undoManager: {},
      })

      renderWithRoute('abc123')

      await act(async () => {
        fireEvent.keyDown(window, { key: 'c', metaKey: true, shiftKey: false })
      })

      expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    })

    it('does NOT copy on Shift+C without Cmd/Ctrl', async () => {
      mockUseCollaboration.mockReturnValue({
        ytext: {},
        awareness: {},
        connectionStatus: 'connected',
        connectedUsers: 1,
        undoManager: {},
      })

      renderWithRoute('abc123')

      await act(async () => {
        fireEvent.keyDown(window, { key: 'c', shiftKey: true })
      })

      expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    })
  })
})
