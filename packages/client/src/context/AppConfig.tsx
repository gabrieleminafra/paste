import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppConfig } from 'shared'

const AppConfigContext = createContext<AppConfig | null>(null)

/**
 * Fetches the server's runtime config once and makes it available app-wide.
 * Consumers get `null` until it loads (and if the request fails), so UI that
 * depends on it should render conditionally.
 */
export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.data) setConfig(json.data)
      })
      .catch(() => {
        // Non-fatal: dependent UI simply stays hidden.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return <AppConfigContext.Provider value={config}>{children}</AppConfigContext.Provider>
}

export function useAppConfig(): AppConfig | null {
  return useContext(AppConfigContext)
}
