// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { cursorIndicatorTheme, cursorReducedMotionTheme } from './CursorIndicator'

describe('CursorIndicator', () => {
  it('exports cursorIndicatorTheme as a defined extension', () => {
    expect(cursorIndicatorTheme).toBeDefined()
    // EditorView.theme() returns a valid CodeMirror Extension (array-like with Facet values)
    expect(cursorIndicatorTheme).toBeTruthy()
  })

  it('exports cursorReducedMotionTheme as a defined extension', () => {
    expect(cursorReducedMotionTheme).toBeDefined()
    expect(cursorReducedMotionTheme).toBeTruthy()
  })

  it('cursorIndicatorTheme and cursorReducedMotionTheme are distinct extensions', () => {
    expect(cursorIndicatorTheme).not.toBe(cursorReducedMotionTheme)
  })
})
