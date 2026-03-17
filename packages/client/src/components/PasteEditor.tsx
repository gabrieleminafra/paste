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
        cursorIndicatorTheme,
        ...(reducedMotion ? [cursorReducedMotionTheme] : []),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-editor': { height: '100%' },
          '.cm-scroller': { fontFamily: 'var(--font-mono)', overflow: 'auto' },
          '.cm-content': { padding: '1rem' },
        }),
        EditorView.lineWrapping,
      ],
    })

    const view = new EditorView({ state, parent: editorRef.current })
    return () => view.destroy()
  }, [ytext, awareness, undoManager])

  return (
    <div
      ref={editorRef}
      className="w-full min-h-[60vh] border border-border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
      aria-label="Paste content editor"
      data-testid="paste-editor"
    />
  )
}
