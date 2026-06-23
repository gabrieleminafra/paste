import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import CreateButton from '../components/CreateButton'

const MAX_FILE_SIZE = 52_428_800 // 50MB, mirrors the server limit

export default function CreatePage() {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const submittingRef = useRef(false)
  const dragDepthRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  const uploadFile = useCallback(
    (file: File) => {
      if (submittingRef.current) return

      if (file.size > MAX_FILE_SIZE) {
        setError('File exceeds 50MB limit')
        return
      }

      submittingRef.current = true
      setIsSubmitting(true)
      setError(null)
      setUploadProgress(0)

      const formData = new FormData()
      formData.append('file', file)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/files')

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
      }

      const finish = () => {
        submittingRef.current = false
        setIsSubmitting(false)
        setUploadProgress(null)
      }

      xhr.onload = () => {
        let json: { data?: { id: string }; error?: { message?: string } } = {}
        try {
          json = JSON.parse(xhr.responseText)
        } catch {
          // fall through to generic error below
        }

        if (xhr.status >= 200 && xhr.status < 300 && json.data) {
          navigate(`/f/${json.data.id}`, { replace: true })
          return
        }
        setError(json.error?.message ?? 'Failed to upload file')
        finish()
      }

      xhr.onerror = () => {
        setError('Failed to upload file')
        finish()
      }

      xhr.send(formData)
    },
    [navigate],
  )

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

  const handleDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    dragDepthRef.current++
    setIsDragging(true)
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault()
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    dragDepthRef.current--
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0
      setIsDragging(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragDepthRef.current = 0
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  const isEmpty = content.trim().length === 0

  return (
    <div
      className="min-h-screen bg-bg flex flex-col"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:px-4 focus:py-2 focus:text-primary focus:underline focus:rounded-md"
      >
        Skip to content
      </a>
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm pointer-events-none">
          <div className="rounded-xl border-2 border-dashed border-primary px-12 py-10 text-center">
            <p className="text-lg font-medium text-text">Drop file to upload</p>
            <p className="text-sm text-muted mt-1">Up to 50MB</p>
          </div>
        </div>
      )}
      <main id="main-content" className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-md:px-4 max-md:py-6">
        <div className="w-full max-w-2xl flex flex-col gap-5">
          <div className="mb-2">
            <h1 className="text-2xl font-semibold text-text tracking-tight max-md:text-xl">Pastebin</h1>
            <p className="text-sm text-muted mt-1">Paste, share, collaborate in real-time.</p>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your text here, or drop a file anywhere..."
            disabled={isSubmitting}
            className="w-full min-h-[320px] max-md:min-h-[240px] p-4 font-mono text-sm text-text bg-surface border border-surface-border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-muted disabled:opacity-60"
          />
          {uploadProgress !== null && (
            <div className="flex flex-col gap-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-border">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${uploadProgress}%` }}
                  role="progressbar"
                  aria-valuenow={uploadProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Upload progress"
                />
              </div>
              <p className="text-xs text-muted">Uploading… {uploadProgress}%</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
            <p className="text-xs text-muted max-md:text-center">
              {isEmpty ? (
                <>
                  or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="text-primary underline hover:text-primary-hover rounded focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                  >
                    choose a file
                  </button>{' '}
                  to upload
                </>
              ) : (
                <><kbd className="px-1.5 py-0.5 bg-surface-border rounded text-[11px] font-mono">{navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Enter</kbd> to create</>
              )}
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
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadFile(file)
              e.target.value = ''
            }}
          />
        </div>
      </main>
    </div>
  )
}
