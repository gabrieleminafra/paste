import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'

export interface ShareLinkHandle {
  triggerCopy: () => void
}

const ShareLink = forwardRef<ShareLinkHandle>(function ShareLink(_props, ref) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopyFailed(false)
      setCopied(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
      setCopyFailed(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopyFailed(false), 2000)
    }
  }

  useImperativeHandle(ref, () => ({ triggerCopy: handleCopy }), [])

  const buttonText = copyFailed ? 'Failed' : copied ? 'Copied!' : 'Copy link'
  const buttonColor = copyFailed
    ? 'text-red-400 border-red-400/30'
    : copied
      ? 'text-green-400 border-green-400/30'
      : 'text-primary border-surface-border hover:bg-surface hover:border-primary/30'

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        readOnly
        value={window.location.href}
        aria-label="Shareable paste link"
        className="font-mono text-sm bg-surface border border-surface-border rounded-lg px-2 py-1 text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary min-w-0 flex-1 max-md:hidden"
      />
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy link to clipboard"
        className={`bg-transparent border rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 whitespace-nowrap max-lg:min-h-[44px] max-lg:min-w-[44px] max-md:flex-1 ${buttonColor}`}
      >
        {buttonText}
      </button>
    </div>
  )
})

export default ShareLink
