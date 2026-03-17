// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { renderHook, cleanup, act } from '@testing-library/react'

// Track callbacks
let statusCallback: ((event: { status: string }) => void) | null = null
let connectionCloseCallback: ((event: CloseEvent | null) => void) | null = null
const mockProviderDestroy = vi.fn()

let mockAwarenessInstance: any = null

vi.mock('y-websocket', () => {
  return {
    WebsocketProvider: class MockWebsocketProvider {
      awareness: unknown
      shouldConnect = true
      constructor(_url: string, _room: string, _doc: unknown, opts?: { awareness?: unknown }) {
        this.awareness = opts?.awareness ?? {}
        mockAwarenessInstance = this.awareness
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
      setLocalStateField = vi.fn()
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

  it('sets awareness user metadata with color on connection', () => {
    renderHook(() => useCollaboration('test-paste-id'))

    // Simulate connected status
    act(() => {
      statusCallback?.({ status: 'connected' })
    })

    expect(mockAwarenessInstance.setLocalStateField).toHaveBeenCalledWith('user', expect.objectContaining({
      color: expect.any(String),
      colorLight: expect.any(String),
    }))
  })

  it('assigns color from the collaborator cursor palette', () => {
    renderHook(() => useCollaboration('test-paste-id'))

    act(() => {
      statusCallback?.({ status: 'connected' })
    })

    const call = mockAwarenessInstance.setLocalStateField.mock.calls[0]
    expect(call[0]).toBe('user')
    const palette = ['#8B5CF6', '#EC4899', '#F97316', '#14B8A6', '#EAB308']
    expect(palette).toContain(call[1].color)
    expect(call[1].colorLight).toMatch(/^#[0-9A-Fa-f]{6}33$/)
  })

  it('sets not-found status on 4404 close code', () => {
    const { result } = renderHook(() => useCollaboration('test-paste-id'))

    act(() => {
      connectionCloseCallback?.({ code: 4404, reason: 'Paste not found' } as CloseEvent)
    })

    expect(result.current.connectionStatus).toBe('not-found')
  })
})
