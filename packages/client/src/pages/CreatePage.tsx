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
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:text-primary focus:underline"
      >
        Skip to content
      </a>
      <main id="main-content" className="flex items-start justify-center pt-12 px-4 max-lg:px-3 max-lg:pt-8 max-md:px-2 max-md:pt-4">
        <div className="w-full max-w-[800px] flex flex-col gap-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your text here..."
            className="w-full min-h-[60vh] max-md:min-h-[40vh] p-4 font-mono text-[#1A1A1A] bg-white border border-border rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 placeholder:text-muted"
          />
          <div className="flex items-center justify-end gap-3 max-md:flex-col max-md:items-stretch">
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <CreateButton
              disabled={isEmpty || isSubmitting}
              onClick={handleCreate}
              label={error ? 'Retry' : 'Create'}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
