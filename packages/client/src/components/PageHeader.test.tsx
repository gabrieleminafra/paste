// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import PageHeader from './PageHeader'

function renderPageHeader() {
  return render(
    <MemoryRouter initialEntries={['/abc123']}>
      <PageHeader />
    </MemoryRouter>,
  )
}

describe('PageHeader', () => {
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

  it('renders a semantic header element', () => {
    renderPageHeader()

    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('contains ShareLink component', () => {
    renderPageHeader()

    expect(screen.getByLabelText('Shareable paste link')).toBeInTheDocument()
    expect(screen.getByLabelText('Copy link to clipboard')).toBeInTheDocument()
  })

  it('contains "New Paste" link pointing to /', () => {
    renderPageHeader()

    const newPasteLink = screen.getByText('New Paste')
    expect(newPasteLink).toBeInTheDocument()
    expect(newPasteLink).toHaveAttribute('href', '/')
  })

  // Responsive layout tests (Story 4.1)
  describe('responsive layout', () => {
    it('New Paste link has 44px touch target on tablet/mobile', () => {
      renderPageHeader()

      const newPasteLink = screen.getByText('New Paste')
      expect(newPasteLink.className).toContain('max-lg:min-h-[44px]')
      expect(newPasteLink.className).toContain('max-lg:min-w-[44px]')
    })

    it('New Paste link has flex alignment for touch target', () => {
      renderPageHeader()

      const newPasteLink = screen.getByText('New Paste')
      expect(newPasteLink.className).toContain('max-lg:flex')
      expect(newPasteLink.className).toContain('max-lg:items-center')
      expect(newPasteLink.className).toContain('max-lg:justify-center')
    })
  })

  it('has skip-to-content link with href="#main-content"', () => {
    renderPageHeader()

    const skipLink = screen.getByText('Skip to content')
    expect(skipLink).toBeInTheDocument()
    expect(skipLink).toHaveAttribute('href', '#main-content')
  })

  // Accessibility tests (Story 4.2)
  describe('accessibility', () => {
    it('New Paste link has focus ring classes', () => {
      renderPageHeader()

      const newPasteLink = screen.getByText('New Paste')
      expect(newPasteLink.className).toContain('focus:ring-2')
      expect(newPasteLink.className).toContain('focus:ring-blue-500')
      expect(newPasteLink.className).toContain('focus:ring-offset-2')
      expect(newPasteLink.className).toContain('focus:outline-none')
    })
  })
})
