import { useState, useRef, useEffect, useId } from 'react'
import { QRCodeSVG } from 'qrcode.react'

interface QrCodeProps {
  /** URL to encode. Defaults to the current page URL. */
  value?: string
}

/**
 * A QR toggle button. Clicking it opens a popover containing a scannable QR
 * code for the given URL (the current page URL by default). Used in the page
 * header so both paste and file pages can surface a QR for their shareable
 * link.
 */
export default function QrCode({ value }: QrCodeProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const url = value ?? window.location.href

  useEffect(() => {
    if (!open) return

    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Show QR code"
        aria-expanded={open}
        aria-controls={panelId}
        className="bg-transparent border border-surface-border rounded-lg px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/50 whitespace-nowrap max-lg:min-h-[44px] max-lg:min-w-[44px]"
      >
        QR
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="QR code for shareable link"
          className="absolute right-0 top-full mt-2 z-50 flex flex-col items-center gap-2 rounded-lg border border-surface-border bg-surface p-4 shadow-xl"
        >
          <div className="rounded-md bg-white p-3">
            <QRCodeSVG value={url} size={160} marginSize={0} />
          </div>
          <p className="max-w-[200px] break-all text-center font-mono text-[11px] text-muted">
            {url}
          </p>
        </div>
      )}
    </div>
  )
}
