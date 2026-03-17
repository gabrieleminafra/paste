import { useState, useRef, useEffect } from 'react'

export default function ShareLink() {
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

  const buttonText = copyFailed ? 'Failed' : copied ? 'Copied!' : 'Copy'
  const buttonColor = copyFailed
    ? 'text-red-600'
    : copied
      ? 'text-green-600'
      : 'text-primary hover:bg-blue-50'

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        readOnly
        value={window.location.href}
        aria-label="Shareable paste link"
        className="font-mono text-sm bg-transparent border border-border rounded-md px-2 py-1 text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-w-0 flex-1"
      />
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy link to clipboard"
        className={`bg-transparent border border-border rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap ${buttonColor}`}
      >
        {buttonText}
      </button>
    </div>
  )
}
