// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { renderHook, cleanup, act } from '@testing-library/react'

// Track callbacks
let statusCallback: ((event: { status: string }) => void) | null = null
let connectionCloseCallback: ((event: CloseEvent | null) => void) | null = null
const mockProviderDestroy = vi.fn()

vi.mock('y-websocket', () => {
  return {
    WebsocketProvider: class MockWebsocketProvider {
      awareness: unknown
      shouldConnect = true
      constructor(_url: string, _room: string, _doc: unknown, opts?: { awareness?: unknown }) {
        this.awareness = opts?.awareness ?? {}
      }
      on(event: string, cb: unknown) {
        if (event === 'status') statusCallback = cb as typeof statusCallback
        if (event === 'connection-close') connectionCloseCallback = cb as typeof connectionCloseCallback
      }
      off() { /* noop */ }
      disconnect() { /* noop */ }
      destroy = mockProviderDestroy
    },
  }
})

vi.mock('y-protocols/awareness', () => {
  return {
    Awareness: class MockAwareness {
      on = vi.fn()
      off = vi.fn()
      destroy = vi.fn()
      getStates() { return new Map([[1, {}]]) }
    },
  }
})

import { useCollaboration } from './useCollaboration'

describe('useCollaboration', () => {
  beforeEach(() => {
    statusCallback = null
    connectionCloseCallback = null
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('returns ytext, awareness, connectionStatus, connectedUsers, and undoManager', () => {
    const { result } = renderHook(() => useCollaboration('test-paste-id'))

    expect(result.current.ytext).toBeDefined()
    expect(result.current.awareness).toBeDefined()
    expect(result.current.connectionStatus).toBe('connecting')
    expect(result.current.connectedUsers).toBe(1)
    expect(result.current.undoManager).toBeDefined()
  })

  it('creates Y.Doc with empty text', () => {
    const { result } = renderHook(() => useCollaboration('test-paste-id'))
    expect(result.current.ytext.toString()).toBe('')
  })

  it('updates connectionStatus on provider status events', () => {
    const { result } = renderHook(() => useCollaboration('test-paste-id'))

    expect(result.current.connectionStatus).toBe('connecting')

    act(() => {
      statusCallback?.({ status: 'connected' })
    })

    expect(result.current.connectionStatus).toBe('connected')
  })

  it('cleans up provider on unmount', () => {
    const { unmount } = renderHook(() => useCollaboration('test-paste-id'))
    unmount()
    expect(mockProviderDestroy).toHaveBeenCalled()
  })

  it('sets not-found status on 4404 close code', () => {
    const { result } = renderHook(() => useCollaboration('test-paste-id'))

    act(() => {
      connectionCloseCallback?.({ code: 4404, reason: 'Paste not found' } as CloseEvent)
    })

    expect(result.current.connectionStatus).toBe('not-found')
  })
})
