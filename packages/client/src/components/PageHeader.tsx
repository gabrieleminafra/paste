import { forwardRef } from 'react'
import { Link } from 'react-router'
import ShareLink from './ShareLink'
import type { ShareLinkHandle } from './ShareLink'

const PageHeader = forwardRef<ShareLinkHandle>(function PageHeader(_props, ref) {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:text-primary focus:underline"
      >
        Skip to content
      </a>
      <div className="flex-1 min-w-0 mr-4">
        <ShareLink ref={ref} />
      </div>
      <Link
        to="/"
        className="text-primary hover:underline text-sm whitespace-nowrap transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md max-lg:min-h-[44px] max-lg:min-w-[44px] max-lg:flex max-lg:items-center max-lg:justify-center"
      >
        New Paste
      </Link>
    </header>
  )
})

export default PageHeader
