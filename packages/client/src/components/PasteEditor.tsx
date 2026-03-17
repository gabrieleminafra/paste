import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { yCollab } from 'y-codemirror.next'
import { cursorIndicatorTheme, cursorReducedMotionTheme } from './CursorIndicator'
import type { Text as YText } from 'yjs'
import type { UndoManager } from 'yjs'
import type { Awareness } from 'y-protocols/awareness'

interface PasteEditorProps {
  ytext: YText
  awareness: Awareness
  undoManager: UndoManager
}

const darkEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
  },
  '.cm-editor': { height: '100%' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '1rem',
    caretColor: '#818CF8',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#818CF8',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(129, 140, 248, 0.08)',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(129, 140, 248, 0.2) !important',
  },
  '.cm-gutters': {
    backgroundColor: '#0F172A',
    color: '#475569',
    borderRight: '1px solid #334155',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    color: '#94A3B8',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: '#334155',
    color: '#94A3B8',
    border: 'none',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(129, 140, 248, 0.25)',
    color: '#A5B4FC',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(250, 204, 21, 0.2)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(250, 204, 21, 0.4)',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
  },
  '.cm-tooltip': {
    backgroundColor: '#1E293B',
    border: '1px solid #334155',
    color: '#F8FAFC',
  },
  '.cm-tooltip-autocomplete': {
    '& > ul > li[aria-selected]': {
      backgroundColor: 'rgba(129, 140, 248, 0.2)',
    },
  },
  '.cm-panels': {
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
  },
  '.cm-panel.cm-search': {
    backgroundColor: '#1E293B',
  },
  '.cm-panel.cm-search input, .cm-panel.cm-search button': {
    color: '#F8FAFC',
  },
}, { dark: true })

export default function PasteEditor({ ytext, awareness, undoManager }: PasteEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editorRef.current) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        basicSetup,
        yCollab(ytext, awareness, { undoManager }),
        darkEditorTheme,
        cursorIndicatorTheme,
        ...(reducedMotion ? [cursorReducedMotionTheme] : []),
        EditorView.lineWrapping,
      ],
    })

    const view = new EditorView({ state, parent: editorRef.current })
    return () => view.destroy()
  }, [ytext, awareness, undoManager])

  return (
    <div
      ref={editorRef}
      className="h-full border border-surface-border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary"
      aria-label="Paste content editor"
      data-testid="paste-editor"
    />
  )
}
