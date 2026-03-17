import { Link } from 'react-router'
import ShareLink from './ShareLink'

export default function PageHeader() {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:text-primary focus:underline"
      >
        Skip to content
      </a>
      <div className="flex-1 min-w-0 mr-4">
        <ShareLink />
      </div>
      <Link
        to="/"
        className="text-primary hover:underline text-sm whitespace-nowrap transition-colors duration-150"
      >
        New Paste
      </Link>
    </header>
  )
}
