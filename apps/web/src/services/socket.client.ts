import { io, type Socket } from 'socket.io-client'
import type {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskDeletedEvent,
  TaskStageChangedEvent,
} from '@loopforge/shared'

type BoardEvents = {
  'task:created': (data: TaskCreatedEvent) => void
  'task:updated': (data: TaskUpdatedEvent) => void
  'task:deleted': (data: TaskDeletedEvent) => void
  'task:stage_changed': (data: TaskStageChangedEvent) => void
}

let socket: Socket | null = null

export function connectBoardSocket(): Socket {
  if (socket?.connected) return socket

  socket = io('/board', {
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  })

  socket.on('connect', () => {
    socket?.emit('board:subscribe')
  })

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message)
  })

  return socket
}

export function disconnectBoardSocket(): void {
  if (socket) {
    socket.emit('board:unsubscribe')
    socket.disconnect()
    socket = null
  }
}

export function onBoardEvent<K extends keyof BoardEvents>(
  event: K,
  handler: BoardEvents[K],
): () => void {
  const s = connectBoardSocket()
  s.on(event as string, handler as (...args: unknown[]) => void)
  return () => {
    s.off(event as string, handler as (...args: unknown[]) => void)
  }
}

export function getBoardSocket(): Socket | null {
  return socket
}
