// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import ShareLink from './ShareLink'

function renderShareLink(initialRoute = '/abc123') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <ShareLink />
    </MemoryRouter>,
  )
}

describe('ShareLink', () => {
  const originalClipboard = navigator.clipboard

  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    })
  })

  it('renders URL display with current location', () => {
    renderShareLink()

    const urlInput = screen.getByLabelText('Shareable paste link')
    expect(urlInput).toBeInTheDocument()
    expect(urlInput).toHaveAttribute('readonly')
  })

  it('renders copy button', () => {
    renderShareLink()

    const copyButton = screen.getByLabelText('Copy link to clipboard')
    expect(copyButton).toBeInTheDocument()
    expect(copyButton).toHaveTextContent('Copy')
  })

  it('copies URL to clipboard when copy button is clicked', async () => {
    renderShareLink()

    const copyButton = screen.getByLabelText('Copy link to clipboard')
    await act(async () => {
      fireEvent.click(copyButton)
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      window.location.href,
    )
  })

  it('shows "Copied!" text after clicking copy', async () => {
    renderShareLink()

    const copyButton = screen.getByLabelText('Copy link to clipboard')
    await act(async () => {
      fireEvent.click(copyButton)
    })

    expect(copyButton).toHaveTextContent('Copied!')
  })

  it('reverts "Copied!" text back to "Copy" after 2 seconds', async () => {
    renderShareLink()

    const copyButton = screen.getByLabelText('Copy link to clipboard')
    await act(async () => {
      fireEvent.click(copyButton)
    })

    expect(copyButton).toHaveTextContent('Copied!')

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(copyButton).toHaveTextContent('Copy')
  })

  // Responsive layout tests (Story 4.1)
  describe('responsive layout', () => {
    it('Copy button has 44px touch target on tablet/mobile', () => {
      renderShareLink()

      const copyButton = screen.getByLabelText('Copy link to clipboard')
      expect(copyButton.className).toContain('max-lg:min-h-[44px]')
      expect(copyButton.className).toContain('max-lg:min-w-[44px]')
    })

    it('URL input has overflow handling for mobile', () => {
      renderShareLink()

      const urlInput = screen.getByLabelText('Shareable paste link')
      expect(urlInput.className).toContain('min-w-0')
    })
  })

  it('handles clipboard write failure gracefully', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('Permission denied')) },
      writable: true,
      configurable: true,
    })

    renderShareLink()

    const copyButton = screen.getByLabelText('Copy link to clipboard')
    await act(async () => {
      fireEvent.click(copyButton)
    })

    expect(copyButton).toHaveTextContent('Failed')
  })
})
