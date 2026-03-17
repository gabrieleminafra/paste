// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import NotFoundPage from './NotFoundPage'

function renderNotFoundPage() {
  return render(
    <MemoryRouter>
      <NotFoundPage />
    </MemoryRouter>,
  )
}

describe('NotFoundPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders "Page not found" message', () => {
    renderNotFoundPage()

    expect(screen.getByText('Page not found')).toBeInTheDocument()
    expect(
      screen.getByText("The page you're looking for doesn't exist."),
    ).toBeInTheDocument()
  })

  it('contains link to / for creating a new paste', () => {
    renderNotFoundPage()

    const link = screen.getByText('Create a new paste')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/')
  })
})
