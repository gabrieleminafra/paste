// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import QrCode from './QrCode'

describe('QrCode', () => {
  afterEach(cleanup)

  it('renders a toggle button and is initially collapsed', () => {
    render(<QrCode value="https://example.com/abc" />)

    const button = screen.getByRole('button', { name: 'Show QR code' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens a popover with the encoded url and an SVG when clicked', () => {
    render(<QrCode value="https://example.com/abc" />)

    fireEvent.click(screen.getByRole('button', { name: 'Show QR code' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('https://example.com/abc')).toBeInTheDocument()
    expect(dialog.querySelector('svg')).toBeInTheDocument()
  })

  it('closes the popover on Escape', () => {
    render(<QrCode value="https://example.com/abc" />)

    fireEvent.click(screen.getByRole('button', { name: 'Show QR code' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
