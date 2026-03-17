import { useEffect, useMemo, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { Awareness } from 'y-protocols/awareness'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'not-found'

export interface CollaborationState {
  ytext: Y.Text
  awareness: Awareness
  connectionStatus: ConnectionStatus
  connectedUsers: number
  undoManager: Y.UndoManager
}

export function useCollaboration(pasteId: string): CollaborationState {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [connectedUsers, setConnectedUsers] = useState(0)

  // Recreate Yjs objects when pasteId changes
  const { doc, ytext, undoManager, awareness } = useMemo(() => {
    const d = new Y.Doc()
    const yt = d.getText('content')
    const um = new Y.UndoManager(yt)
    const aw = new Awareness(d)
    return { doc: d, ytext: yt, undoManager: um, awareness: aw }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteId])

  useEffect(() => {
    setConnectionStatus('connecting')

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`

    const provider = new WebsocketProvider(wsUrl, pasteId, doc, {
      connect: true,
      awareness,
    })

    provider.on('status', ({ status }: { status: string }) => {
      setConnectionStatus(status as ConnectionStatus)
    })

    // Detect paste-not-found via WebSocket close code
    const checkClose = (event: CloseEvent | null) => {
      if (event && event.code === 4404) {
        provider.shouldConnect = false
        provider.disconnect()
        setConnectionStatus('not-found')
      }
    }

    provider.on('connection-close', checkClose)

    const updateUsers = () => {
      setConnectedUsers(awareness.getStates().size)
    }
    awareness.on('change', updateUsers)
    updateUsers()

    return () => {
      awareness.off('change', updateUsers)
      provider.destroy()
      undoManager.destroy()
      awareness.destroy()
      doc.destroy()
    }
  }, [pasteId, doc, awareness, undoManager])

  return {
    ytext,
    awareness,
    connectionStatus,
    connectedUsers,
    undoManager,
  }
}
