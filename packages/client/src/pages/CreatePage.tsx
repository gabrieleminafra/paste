import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import CreateButton from '../components/CreateButton'

export default function CreatePage() {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const navigate = useNavigate()

  const handleCreate = useCallback(async () => {
    if (!content.trim() || submittingRef.current) return

    submittingRef.current = true
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/pastes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error?.message ?? 'Failed to create paste')
        return
      }

      navigate(`/${json.data.id}`, { replace: true })
    } catch {
      setError('Failed to create paste')
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }, [content, navigate])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleCreate()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleCreate])

  const isEmpty = content.trim().length === 0

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:px-4 focus:py-2 focus:text-primary focus:underline focus:rounded-md"
      >
        Skip to content
      </a>
      <main id="main-content" className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-md:px-4 max-md:py-6">
        <div className="w-full max-w-2xl flex flex-col gap-5">
          <div className="mb-2">
            <h1 className="text-2xl font-semibold text-text tracking-tight max-md:text-xl">Pastebin</h1>
            <p className="text-sm text-muted mt-1">Paste, share, collaborate in real-time.</p>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your text here..."
            className="w-full min-h-[320px] max-md:min-h-[240px] p-4 font-mono text-sm text-text bg-surface border border-surface-border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-muted"
          />
          <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
            <p className="text-xs text-muted max-md:text-center">
              {isEmpty ? '' : <><kbd className="px-1.5 py-0.5 bg-surface-border rounded text-[11px] font-mono">{navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter</kbd> to create</>}
            </p>
            <div className="flex items-center gap-3 max-md:flex-col max-md:items-stretch">
              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}
              <CreateButton
                disabled={isEmpty || isSubmitting}
                onClick={handleCreate}
                label={error ? 'Retry' : 'Create Paste'}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
