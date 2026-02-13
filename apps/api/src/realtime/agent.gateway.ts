import { getBoardGateway } from './board.gateway.js'
import type {
  AgentExecutionStartedEvent,
  AgentExecutionLogEvent,
  AgentExecutionCompletedEvent,
  AgentExecutionFailedEvent,
  AgentQualityUpdatedEvent,
} from '@loopforge/shared'

/**
 * Emit agent execution started event
 */
export function emitAgentExecutionStarted(
  taskId: string,
  event: AgentExecutionStartedEvent
) {
  try {
    const io = getBoardGateway()
    io.to(`task:${taskId}`).emit('agent:execution:started', event)
  } catch (error) {
    console.error('Failed to emit agent execution started event:', error)
  }
}

/**
 * Emit agent execution log event
 */
export function emitAgentExecutionLog(taskId: string, event: AgentExecutionLogEvent) {
  try {
    const io = getBoardGateway()
    io.to(`task:${taskId}`).emit('agent:execution:log', event)
  } catch (error) {
    console.error('Failed to emit agent execution log event:', error)
  }
}

/**
 * Emit agent execution completed event
 */
export function emitAgentExecutionCompleted(
  taskId: string,
  event: AgentExecutionCompletedEvent
) {
  try {
    const io = getBoardGateway()
    io.to(`task:${taskId}`).emit('agent:execution:completed', event)
  } catch (error) {
    console.error('Failed to emit agent execution completed event:', error)
  }
}

/**
 * Emit agent execution failed event
 */
export function emitAgentExecutionFailed(
  taskId: string,
  event: AgentExecutionFailedEvent
) {
  try {
    const io = getBoardGateway()
    io.to(`task:${taskId}`).emit('agent:execution:failed', event)
  } catch (error) {
    console.error('Failed to emit agent execution failed event:', error)
  }
}

/**
 * Emit quality metrics updated event
 */
export function emitAgentQualityUpdated(
  taskId: string,
  event: AgentQualityUpdatedEvent
) {
  try {
    const io = getBoardGateway()
    io.to(`task:${taskId}`).emit('agent:quality:updated', event)
  } catch (error) {
    console.error('Failed to emit quality updated event:', error)
  }
}
