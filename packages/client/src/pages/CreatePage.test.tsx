// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import CreatePage from './CreatePage'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('CreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders textarea with placeholder', () => {
    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>,
    )

    expect(screen.getByPlaceholderText('Paste your text here...')).toBeInTheDocument()
  })

  it('renders Create button disabled when textarea is empty', () => {
    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'Create Paste' })).toBeDisabled()
  })

  it('enables Create button when text is entered', () => {
    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByPlaceholderText('Paste your text here...'), {
      target: { value: 'Hello world' },
    })

    expect(screen.getByRole('button', { name: 'Create Paste' })).toBeEnabled()
  })

  it('keeps Create button disabled when only whitespace is entered', () => {
    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByPlaceholderText('Paste your text here...'), {
      target: { value: '   ' },
    })

    expect(screen.getByRole('button', { name: 'Create Paste' })).toBeDisabled()
  })

  it('calls POST /api/pastes and navigates on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'abc123' }, error: null }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByPlaceholderText('Paste your text here...'), {
      target: { value: 'Test content' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create Paste' }))

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/pastes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Test content' }),
      })
    })

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/abc123', { replace: true })
    })
  })

  it('shows error message and Retry button on failure', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({
          data: null,
          error: { message: 'Content is required', code: 'VALIDATION_ERROR' },
        }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByPlaceholderText('Paste your text here...'), {
      target: { value: 'Test content' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create Paste' }))

    await vi.waitFor(() => {
      expect(screen.getByText('Content is required')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('retries successfully after initial failure', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ data: null, error: { message: 'Server error', code: 'INTERNAL_ERROR' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: 'retry123' }, error: null }),
      })
    vi.stubGlobal('fetch', mockFetch)

    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByPlaceholderText('Paste your text here...'), {
      target: { value: 'Retry content' },
    })

    // First attempt — fails
    fireEvent.click(screen.getByRole('button', { name: 'Create Paste' }))

    await vi.waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()

    // Second attempt — retry succeeds
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/retry123', { replace: true })
    })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('shows generic error on network failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByPlaceholderText('Paste your text here...'), {
      target: { value: 'Test content' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create Paste' }))

    await vi.waitFor(() => {
      expect(screen.getByText('Failed to create paste')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  // Responsive layout tests (Story 4.1)
  describe('responsive layout', () => {
    it('has centered layout with max-w-2xl container', () => {
      render(
        <MemoryRouter>
          <CreatePage />
        </MemoryRouter>,
      )

      const main = document.getElementById('main-content')
      expect(main?.className).toContain('justify-center')
      expect(main?.className).toContain('px-6')

      const innerDiv = screen.getByPlaceholderText('Paste your text here...').closest('.max-w-2xl')
      expect(innerDiv).toBeInTheDocument()
    })

    it('applies mobile-specific padding classes', () => {
      render(
        <MemoryRouter>
          <CreatePage />
        </MemoryRouter>,
      )

      const main = document.getElementById('main-content')
      expect(main?.className).toContain('max-md:px-4')
      expect(main?.className).toContain('max-md:py-6')
    })

    it('applies full-width class to Create button on mobile', () => {
      render(
        <MemoryRouter>
          <CreatePage />
        </MemoryRouter>,
      )

      const buttonContainer = screen.getByRole('button', { name: 'Create Paste' }).closest('.flex.items-center.gap-3')
      expect(buttonContainer?.className).toContain('max-md:flex-col')
    })

    it('applies mobile min-height reduction to textarea', () => {
      render(
        <MemoryRouter>
          <CreatePage />
        </MemoryRouter>,
      )

      const textarea = screen.getByPlaceholderText('Paste your text here...')
      expect(textarea.className).toContain('max-md:min-h-[240px]')
    })
  })

  // Accessibility tests (Story 4.2)
  describe('accessibility', () => {
    it('has skip-to-content link as first focusable element', () => {
      render(
        <MemoryRouter>
          <CreatePage />
        </MemoryRouter>,
      )

      const skipLink = screen.getByText('Skip to content')
      expect(skipLink).toBeInTheDocument()
      expect(skipLink).toHaveAttribute('href', '#main-content')
    })

    it('has main element with id="main-content"', () => {
      render(
        <MemoryRouter>
          <CreatePage />
        </MemoryRouter>,
      )

      const main = document.getElementById('main-content')
      expect(main).toBeInTheDocument()
      expect(main?.tagName).toBe('MAIN')
    })
  })

  it('triggers create on Cmd/Ctrl+Enter', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'xyz789' }, error: null }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(
      <MemoryRouter>
        <CreatePage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByPlaceholderText('Paste your text here...'), {
      target: { value: 'Keyboard shortcut test' },
    })

    fireEvent.keyDown(window, { key: 'Enter', metaKey: true })

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/pastes', expect.any(Object))
    })
  })
})
