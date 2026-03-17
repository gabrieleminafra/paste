import type { ConnectionStatus as ConnectionStatusType } from '../hooks/useCollaboration'

interface ConnectionStatusProps {
  status: ConnectionStatusType
}

const STATUS_TEXT: Record<string, string> = {
  connected: 'Connected',
  reconnecting: 'Reconnecting...',
  disconnected: 'Disconnected',
}

export default function ConnectionStatus({ status }: ConnectionStatusProps) {
  const statusText = STATUS_TEXT[status] ?? status

  const dotClasses =
    status === 'connected'
      ? 'w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
      : status === 'reconnecting'
        ? 'w-3 h-3 rounded-full border-2 border-amber-400 motion-safe:animate-pulse'
        : 'w-3 h-3 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]'

  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-50 max-md:bottom-2 max-md:right-2">
      <div
        role="status"
        aria-label={`Connection status: ${statusText}`}
        title={statusText}
        className={dotClasses}
      />
      <span className="sr-only">{statusText}</span>
    </div>
  )
}
