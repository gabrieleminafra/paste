// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import FilePage from './FilePage'

function renderFilePage() {
  return render(
    <MemoryRouter initialEntries={['/f/abcdefghijklmnopqrstu']}>
      <Routes>
        <Route path="/f/:fileId" element={<FilePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('FilePage', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows a skeleton while loading', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    renderFilePage()
    expect(screen.getByTestId('shimmer-skeleton')).toBeInTheDocument()
  })

  it('renders filename, size and a download link when loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: 'abcdefghijklmnopqrstu',
              filename: 'report.pdf',
              mimeType: 'application/pdf',
              size: 2048,
              createdAt: '2026-06-23T00:00:00.000Z',
              updatedAt: '2026-06-23T00:00:00.000Z',
            },
            error: null,
          }),
      }),
    )

    renderFilePage()

    expect(await screen.findByText('report.pdf')).toBeInTheDocument()
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument()

    const download = screen.getByRole('link', { name: 'Download' })
    expect(download).toHaveAttribute(
      'href',
      '/api/files/abcdefghijklmnopqrstu/download',
    )
    expect(download).toHaveAttribute('download', 'report.pdf')
  })

  it('renders an inline preview for image files', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: 'abcdefghijklmnopqrstu',
              filename: 'photo.png',
              mimeType: 'image/png',
              size: 4096,
              createdAt: '2026-06-23T00:00:00.000Z',
              updatedAt: '2026-06-23T00:00:00.000Z',
            },
            error: null,
          }),
      }),
    )

    renderFilePage()

    const img = (await screen.findByAltText('photo.png')) as HTMLImageElement
    expect(img.getAttribute('src')).toBe(
      '/api/files/abcdefghijklmnopqrstu/download',
    )
  })

  it('shows a not-found message when the file is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            data: null,
            error: { message: 'File not found', code: 'FILE_NOT_FOUND' },
          }),
      }),
    )

    renderFilePage()

    expect(await screen.findByText('File not found')).toBeInTheDocument()
  })
})
