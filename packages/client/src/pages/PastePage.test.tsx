// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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

  it('shows disconnected state when connection is lost', () => {
    mockUseCollaboration.mockReturnValue({
      ytext: {},
      awareness: {},
      connectionStatus: 'disconnected',
      connectedUsers: 0,
      undoManager: {},
    })

    renderWithRoute('abc123')

    expect(screen.getByText('Connection lost')).toBeInTheDocument()
    expect(screen.getByText('Create a new paste')).toHaveAttribute('href', '/')
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
})
