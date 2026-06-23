const DAY_MS = 86_400_000

/**
 * Human-readable expiry for a piece of content, given when it was created and
 * its TTL in days. Rounds up, so freshly created content reads as its full TTL.
 */
export function expiryLabel(
  createdAt: string,
  ttlDays: number,
  now: Date = new Date(),
): string {
  const expiresAt = new Date(createdAt).getTime() + ttlDays * DAY_MS
  const remaining = expiresAt - now.getTime()
  if (remaining <= 0) return 'Expired'
  const days = Math.ceil(remaining / DAY_MS)
  return days === 1 ? 'Expires in 1 day' : `Expires in ${days} days`
}
