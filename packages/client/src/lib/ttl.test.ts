import { describe, it, expect } from 'vitest'
import { expiryLabel } from './ttl'

const NOW = new Date('2026-06-23T12:00:00.000Z')
const DAY = 86_400_000

describe('expiryLabel', () => {
  it('reports the full TTL for freshly created content', () => {
    const createdAt = NOW.toISOString()
    expect(expiryLabel(createdAt, 7, NOW)).toBe('Expires in 7 days')
  })

  it('counts down as time passes', () => {
    const createdAt = new Date(NOW.getTime() - 5 * DAY).toISOString()
    expect(expiryLabel(createdAt, 7, NOW)).toBe('Expires in 2 days')
  })

  it('uses singular wording on the final day', () => {
    const createdAt = new Date(NOW.getTime() - 6.5 * DAY).toISOString()
    expect(expiryLabel(createdAt, 7, NOW)).toBe('Expires in 1 day')
  })

  it('reports expired content past its TTL', () => {
    const createdAt = new Date(NOW.getTime() - 8 * DAY).toISOString()
    expect(expiryLabel(createdAt, 7, NOW)).toBe('Expired')
  })
})
