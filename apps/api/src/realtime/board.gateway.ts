import { Server as SocketIOServer } from 'socket.io'
import type { Server as HttpServer } from 'node:http'
import jwt from 'jsonwebtoken'
import type {
  Task,
  Stage,
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskDeletedEvent,
  TaskStageChangedEvent,
} from '@loopforge/shared'

let io: SocketIOServer | null = null

export function initBoardGateway(httpServer: HttpServer): SocketIOServer {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) throw new Error('JWT_SECRET is required')

  const server = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
      credentials: true,
    },
  })

  // Use the /board namespace
  io = server.of('/board') as unknown as SocketIOServer

  // JWT auth middleware on handshake
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ??
      socket.handshake.headers?.cookie
        ?.split(';')
        .find((c) => c.trim().startsWith('auth_token='))
        ?.split('=')[1]

    if (!token) {
      return next(new Error('Authentication required'))
    }

    try {
      const payload = jwt.verify(token, jwtSecret) as { userId: string }
      socket.data.userId = payload.userId
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    const { userId } = socket.data as { userId: string }

    // Join user-scoped room
    socket.join(`user:${userId}`)

    socket.on('board:subscribe', () => {
      socket.join(`user:${userId}`)
    })

    socket.on('board:unsubscribe', () => {
      socket.leave(`user:${userId}`)
    })

    socket.on('disconnect', () => {
      // cleanup handled by Socket.io automatically
    })
  })

  return io
}

export function getBoardGateway(): SocketIOServer {
  if (!io) throw new Error('Board gateway not initialized')
  return io
}

export function emitTaskCreated(userId: string, task: Task): void {
  getBoardGateway().to(`user:${userId}`).emit('task:created', { task } satisfies TaskCreatedEvent)
}

export function emitTaskUpdated(userId: string, task: Task): void {
  getBoardGateway()
    .to(`user:${userId}`)
    .emit('task:updated', {
      taskId: task.id,
      stage: task.stage,
      title: task.title,
      updatedAt: task.updatedAt,
    } satisfies TaskUpdatedEvent)
}

export function emitTaskDeleted(userId: string, taskId: string): void {
  getBoardGateway()
    .to(`user:${userId}`)
    .emit('task:deleted', { taskId } satisfies TaskDeletedEvent)
}

export function emitStageChanged(
  userId: string,
  taskId: string,
  fromStage: Stage,
  toStage: Stage,
): void {
  getBoardGateway()
    .to(`user:${userId}`)
    .emit('task:stage_changed', {
      taskId,
      fromStage,
      toStage,
      at: new Date().toISOString(),
    } satisfies TaskStageChangedEvent)
}
