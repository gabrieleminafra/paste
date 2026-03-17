import { EditorView } from '@codemirror/view'

/**
 * CodeMirror theme extension for styling remote collaborator cursors
 * rendered by y-codemirror.next's yCollab extension.
 *
 * The yCollab extension renders remote cursor DOM elements using these classes:
 * - .cm-yCursor — cursor line (border-color set inline from awareness user.color)
 * - .cm-ySelection — selection highlight (background-color from user.colorLight)
 * - .cm-ySelectionInfo — cursor label tooltip
 * - .cm-yLineSelection — full-line selection highlight
 */
export const cursorIndicatorTheme = EditorView.theme({
  '.cm-yCursor': {
    position: 'relative',
    borderLeft: '2px solid',
    marginLeft: '-1px',
    marginRight: '-1px',
    pointerEvents: 'none',
  },
  '.cm-ySelection': {
    opacity: '0.7',
  },
  '.cm-ySelectionInfo': {
    display: 'none',
  },
  '.cm-yLineSelection': {
    opacity: '0.15',
  },
})

/**
 * Reduced-motion variant — reserved for future use when smooth cursor
 * repositioning is implemented via a custom ViewPlugin. Currently a no-op
 * placeholder so the conditional wiring in PasteEditor stays in place.
 */
export const cursorReducedMotionTheme = EditorView.theme({})
