import { forwardRef } from 'react'
import { Link } from 'react-router'
import ShareLink from './ShareLink'
import QrCode from './QrCode'
import type { ShareLinkHandle } from './ShareLink'

const PageHeader = forwardRef<ShareLinkHandle>(function PageHeader(_props, ref) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-2 border-b border-surface-border bg-bg/80 backdrop-blur-md">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:px-4 focus:py-2 focus:text-primary focus:underline focus:rounded-md"
      >
        Skip to content
      </a>
      <div className="flex-1 min-w-0 mr-4">
        <ShareLink ref={ref} />
      </div>
      <div className="mr-2">
        <QrCode />
      </div>
      <Link
        to="/"
        className="text-primary hover:text-primary-hover text-sm whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 max-lg:min-h-[44px] max-lg:min-w-[44px] max-lg:flex max-lg:items-center max-lg:justify-center"
      >
        New Paste
      </Link>
    </header>
  )
})

export default PageHeader
