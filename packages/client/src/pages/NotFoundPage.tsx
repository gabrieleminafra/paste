import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
        <p className="text-muted mb-4">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          to="/"
          className="text-primary hover:text-primary-hover underline"
        >
          Create a new paste
        </Link>
      </div>
    </main>
  )
}
