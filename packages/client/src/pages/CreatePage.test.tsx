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

    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
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

    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled()
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

    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
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

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

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

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await vi.waitFor(() => {
      expect(screen.getByText('Content is required')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
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
