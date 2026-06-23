import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router'
import PageHeader from '../components/PageHeader'
import PasteEditor from '../components/PasteEditor'
import ConnectionStatus from '../components/ConnectionStatus'
import { useCollaboration } from '../hooks/useCollaboration'
import type { ShareLinkHandle } from '../components/ShareLink'
import { useAppConfig } from '../context/AppConfig'

export default function PastePage() {
  const { pasteId } = useParams<{ pasteId: string }>()
  const { ytext, awareness, connectionStatus, undoManager } = useCollaboration(pasteId!)
  const [showReconnectMsg, setShowReconnectMsg] = useState(false)
  const shareLinkRef = useRef<ShareLinkHandle>(null)
  const config = useAppConfig()

  const handleCopyShortcut = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault()
      shareLinkRef.current?.triggerCopy()
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleCopyShortcut)
    return () => window.removeEventListener('keydown', handleCopyShortcut)
  }, [handleCopyShortcut])

  useEffect(() => {
    if (connectionStatus === 'reconnecting') {
      const timer = setTimeout(() => setShowReconnectMsg(true), 30000)
      return () => clearTimeout(timer)
    }
    setShowReconnectMsg(false)
  }, [connectionStatus])

  if (connectionStatus === 'connecting') {
    return (
      <div className="h-screen bg-bg flex flex-col">
        <PageHeader ref={shareLinkRef} />
        <main id="main-content" className="flex-1 p-4 max-md:p-2">
          <div className="h-full rounded-lg bg-surface border border-surface-border p-4 space-y-3" data-testid="shimmer-skeleton">
            <div className="shimmer-bar h-4 rounded w-full" />
            <div className="shimmer-bar h-4 rounded w-[85%]" />
            <div className="shimmer-bar h-4 rounded w-[92%]" />
            <div className="shimmer-bar h-4 rounded w-[70%]" />
            <div className="shimmer-bar h-4 rounded w-[95%]" />
            <div className="shimmer-bar h-4 rounded w-[88%]" />
            <div className="shimmer-bar h-4 rounded w-[76%]" />
          </div>
        </main>
      </div>
    )
  }

  if (connectionStatus === 'not-found') {
    return (
      <div className="h-screen bg-bg flex flex-col">
        <PageHeader ref={shareLinkRef} />
        <main id="main-content" className="flex-1 flex items-center justify-center px-4 max-md:px-2">
          <div className="text-center">
            <h2 className="text-lg text-muted mb-4">Paste not found</h2>
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
      {showReconnectMsg && (
        <div className="text-center text-sm text-muted py-1">Reconnecting...</div>
      )}
      <main id="main-content" className="flex-1 p-4 max-md:p-2">
        <PasteEditor ytext={ytext} awareness={awareness} undoManager={undoManager} />
      </main>
      {config && (
        <p className="text-center text-xs text-muted py-1">
          Kept for {config.pasteTtlDays} days after the last edit
        </p>
      )}
      <ConnectionStatus status={connectionStatus} />
    </div>
  )
}
