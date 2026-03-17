// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import CreateButton from './CreateButton'

describe('CreateButton', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders with "Create" label by default', () => {
    render(<CreateButton disabled={false} onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })

  it('renders with custom label', () => {
    render(<CreateButton disabled={false} onClick={() => {}} label="Retry" />)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('is disabled when disabled prop is true', () => {
    render(<CreateButton disabled={true} onClick={() => {}} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is enabled when disabled prop is false', () => {
    render(<CreateButton disabled={false} onClick={() => {}} />)
    expect(screen.getByRole('button')).toBeEnabled()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<CreateButton disabled={false} onClick={onClick} />)

    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  // Responsive layout tests (Story 4.1)
  describe('responsive layout', () => {
    it('has 44px min touch target on tablet/mobile', () => {
      render(<CreateButton disabled={false} onClick={() => {}} />)

      const button = screen.getByRole('button')
      expect(button.className).toContain('max-lg:min-h-[44px]')
    })

    it('has full-width class on mobile', () => {
      render(<CreateButton disabled={false} onClick={() => {}} />)

      const button = screen.getByRole('button')
      expect(button.className).toContain('max-md:w-full')
    })
  })

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn()
    render(<CreateButton disabled={true} onClick={onClick} />)

    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
