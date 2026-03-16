import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'

export default function PastePage() {
  const { pasteId } = useParams<{ pasteId: string }>()
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function fetchPaste() {
      try {
        const res = await fetch(`/api/pastes/${pasteId}`, {
          signal: controller.signal,
        })
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        if (!res.ok) {
          setFetchError(true)
          return
        }
        const json = await res.json()
        if (json.data) {
          setContent(json.data.content)
        } else {
          setNotFound(true)
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setFetchError(true)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchPaste()
    return () => controller.abort()
  }, [pasteId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-start justify-center pt-12 px-4">
        <div className="w-full max-w-[800px]">
          <div className="w-full min-h-[60vh] rounded-md bg-gray-100 animate-pulse" />
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg text-muted mb-4">Something went wrong</p>
          <button
            type="button"
            onClick={() => {
              setFetchError(false)
              setLoading(true)
            }}
            className="text-primary hover:text-primary-hover underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg text-muted mb-4">Paste not found</p>
          <Link
            to="/"
            className="text-primary hover:text-primary-hover underline"
          >
            Create a new paste
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-[800px]">
        <textarea
          readOnly
          value={content ?? ''}
          className="w-full min-h-[60vh] p-4 font-mono text-[#1A1A1A] bg-white border border-border rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        />
      </div>
    </div>
  )
}
