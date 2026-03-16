// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
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
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows loading skeleton initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))

    renderWithRoute('abc123')

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('displays paste content after successful fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: { id: 'abc123', content: 'Hello world', createdAt: '', updatedAt: '' },
            error: null,
          }),
      }),
    )

    renderWithRoute('abc123')

    await vi.waitFor(() => {
      expect(screen.getByDisplayValue('Hello world')).toBeInTheDocument()
    })

    const textarea = screen.getByDisplayValue('Hello world')
    expect(textarea).toHaveAttribute('readonly')
  })

  it('shows "Paste not found" on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () =>
          Promise.resolve({ data: null, error: { message: 'Paste not found', code: 'PASTE_NOT_FOUND' } }),
      }),
    )

    renderWithRoute('nonexistent')

    await vi.waitFor(() => {
      expect(screen.getByText('Paste not found')).toBeInTheDocument()
    })

    expect(screen.getByText('Create a new paste')).toHaveAttribute('href', '/')
  })

  it('shows error state on server error (non-404)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({ data: null, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } }),
      }),
    )

    renderWithRoute('abc123')

    await vi.waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    expect(screen.getByText('Try again')).toBeInTheDocument()
  })

  it('shows error state on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    renderWithRoute('abc123')

    await vi.waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })
})
