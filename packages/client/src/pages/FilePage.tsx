import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router'
import PageHeader from '../components/PageHeader'
import type { ShareLinkHandle } from '../components/ShareLink'
import type { FileMeta } from 'shared'

type Status = 'loading' | 'ready' | 'not-found'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

export default function FilePage() {
  const { fileId } = useParams<{ fileId: string }>()
  const [status, setStatus] = useState<Status>('loading')
  const [meta, setMeta] = useState<FileMeta | null>(null)
  const shareLinkRef = useRef<ShareLinkHandle>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/files/${fileId}`)
        const json = await res.json()
        if (cancelled) return
        if (!res.ok || !json.data) {
          setStatus('not-found')
          return
        }
        setMeta(json.data)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('not-found')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [fileId])

  if (status === 'loading') {
    return (
      <div className="h-screen bg-bg flex flex-col">
        <PageHeader ref={shareLinkRef} />
        <main id="main-content" className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-lg bg-surface border border-surface-border p-6 space-y-3" data-testid="shimmer-skeleton">
            <div className="shimmer-bar h-5 rounded w-2/3" />
            <div className="shimmer-bar h-4 rounded w-1/3" />
            <div className="shimmer-bar h-10 rounded w-full mt-4" />
          </div>
        </main>
      </div>
    )
  }

  if (status === 'not-found' || !meta) {
    return (
      <div className="h-screen bg-bg flex flex-col">
        <PageHeader ref={shareLinkRef} />
        <main id="main-content" className="flex-1 flex items-center justify-center px-4 max-md:px-2">
          <div className="text-center">
            <h2 className="text-lg text-muted mb-4">File not found</h2>
            <Link
              to="/"
              className="text-primary hover:text-primary-hover underline rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 max-lg:min-h-[44px] max-lg:inline-flex max-lg:items-center max-lg:justify-center"
            >
              Create a new paste
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="h-screen bg-bg flex flex-col">
      <PageHeader ref={shareLinkRef} />
      <main id="main-content" className="flex-1 flex items-center justify-center px-6 py-8 max-md:px-4">
        <div className="w-full max-w-md flex flex-col gap-5 rounded-lg bg-surface border border-surface-border p-6">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-text break-all" title={meta.filename}>
              {meta.filename}
            </h1>
            <p className="text-sm text-muted mt-1">
              {formatBytes(meta.size)} &middot; {meta.mimeType}
            </p>
          </div>
          <a
            href={`/api/files/${meta.id}/download`}
            download={meta.filename}
            className="inline-flex items-center justify-center bg-primary text-bg font-medium rounded-lg px-4 py-2.5 hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/50 max-lg:min-h-[44px]"
          >
            Download
          </a>
        </div>
      </main>
    </div>
  )
}
