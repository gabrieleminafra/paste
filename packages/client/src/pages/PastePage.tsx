import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import PageHeader from '../components/PageHeader'
import PasteEditor from '../components/PasteEditor'
import ConnectionStatus from '../components/ConnectionStatus'
import { useCollaboration } from '../hooks/useCollaboration'

export default function PastePage() {
  const { pasteId } = useParams<{ pasteId: string }>()
  const { ytext, awareness, connectionStatus, undoManager } = useCollaboration(pasteId!)
  const [showReconnectMsg, setShowReconnectMsg] = useState(false)

  useEffect(() => {
    if (connectionStatus === 'reconnecting') {
      const timer = setTimeout(() => setShowReconnectMsg(true), 30000)
      return () => clearTimeout(timer)
    }
    setShowReconnectMsg(false)
  }, [connectionStatus])

  if (connectionStatus === 'connecting') {
    return (
      <div className="min-h-screen">
        <PageHeader />
        <main id="main-content" className="flex items-start justify-center pt-12 px-4 max-md:px-2 max-md:pt-4">
          <div className="w-full">
            <div className="w-full min-h-[60vh] rounded-md bg-gray-100 animate-pulse" />
          </div>
        </main>
      </div>
    )
  }

  if (connectionStatus === 'not-found') {
    return (
      <div className="min-h-screen flex flex-col">
        <PageHeader />
        <main id="main-content" className="flex-1 flex items-center justify-center px-4 max-md:px-2">
          <div className="text-center">
            <h2 className="text-lg text-muted mb-4">Paste not found</h2>
            <Link
              to="/"
              className="text-primary hover:text-primary-hover underline max-lg:min-h-[44px] max-lg:inline-flex max-lg:items-center max-lg:justify-center"
            >
              Create a new paste
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <PageHeader />
      {showReconnectMsg && (
        <div className="text-center text-sm text-muted py-2">Reconnecting...</div>
      )}
      <main id="main-content" className="flex items-start justify-center pt-12 px-4 max-md:px-2 max-md:pt-4">
        <div className="w-full">
          <PasteEditor ytext={ytext} awareness={awareness} undoManager={undoManager} />
        </div>
      </main>
      <ConnectionStatus status={connectionStatus} />
    </div>
  )
}
