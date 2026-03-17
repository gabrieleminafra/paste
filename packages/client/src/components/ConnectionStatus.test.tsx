// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ConnectionStatus from './ConnectionStatus'

describe('ConnectionStatus', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders green filled dot when connected', () => {
    render(<ConnectionStatus status="connected" />)

    const dot = screen.getByRole('status')
    expect(dot).toBeInTheDocument()
    expect(dot.className).toContain('bg-green-500')
    expect(dot.className).not.toContain('border-amber-500')
    expect(dot.className).not.toContain('bg-red-500')
  })

  it('renders amber hollow ring when reconnecting', () => {
    render(<ConnectionStatus status="reconnecting" />)

    const dot = screen.getByRole('status')
    expect(dot.className).toContain('border-amber-500')
    expect(dot.className).not.toContain('bg-green-500')
    expect(dot.className).not.toContain('bg-red-500')
  })

  it('renders red filled dot when disconnected', () => {
    render(<ConnectionStatus status="disconnected" />)

    const dot = screen.getByRole('status')
    expect(dot.className).toContain('bg-red-500')
    expect(dot.className).not.toContain('bg-green-500')
    expect(dot.className).not.toContain('border-amber-500')
  })

  it('shows "Connected" tooltip when connected', () => {
    render(<ConnectionStatus status="connected" />)

    const dot = screen.getByRole('status')
    expect(dot).toHaveAttribute('title', 'Connected')
  })

  it('shows "Reconnecting..." tooltip when reconnecting', () => {
    render(<ConnectionStatus status="reconnecting" />)

    const dot = screen.getByRole('status')
    expect(dot).toHaveAttribute('title', 'Reconnecting...')
  })

  it('shows "Disconnected" tooltip when disconnected', () => {
    render(<ConnectionStatus status="disconnected" />)

    const dot = screen.getByRole('status')
    expect(dot).toHaveAttribute('title', 'Disconnected')
  })

  it('has aria-live="polite" region for screen reader announcements', () => {
    const { container } = render(<ConnectionStatus status="connected" />)

    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeInTheDocument()
  })

  it('updates aria-label with connection status text', () => {
    const { rerender } = render(<ConnectionStatus status="connected" />)

    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Connection status: Connected',
    )

    rerender(<ConnectionStatus status="reconnecting" />)
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Connection status: Reconnecting...',
    )

    rerender(<ConnectionStatus status="disconnected" />)
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Connection status: Disconnected',
    )
  })

  it('applies motion-safe:animate-pulse only for reconnecting state', () => {
    const { rerender } = render(<ConnectionStatus status="reconnecting" />)

    expect(screen.getByRole('status').className).toContain('motion-safe:animate-pulse')

    rerender(<ConnectionStatus status="connected" />)
    expect(screen.getByRole('status').className).not.toContain('animate-pulse')

    rerender(<ConnectionStatus status="disconnected" />)
    expect(screen.getByRole('status').className).not.toContain('animate-pulse')
  })
})
