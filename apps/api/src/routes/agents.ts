import type { FastifyInstance } from 'fastify'
import { AgentService } from '../services/agent.service.js'
import { AgentExecutionService } from '../services/agent-execution.service.js'
import { requireAuth } from '../auth/middleware.js'

export async function registerAgentsRoutes(fastify: FastifyInstance) {
  // Require authentication for all routes
  fastify.addHook('onRequest', requireAuth)

  // List all agents
  fastify.get('/agents', async (request, reply) => {
    const { category } = request.query as { category?: string }
    const agents = await AgentService.list(category as any)
    return reply.send({ agents })
  })

  // Get agent by ID
  fastify.get('/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const agent = await AgentService.getById(id)

    if (!agent) {
      return reply.status(404).send({ error: 'Agent not found' })
    }

    return reply.send({ agent })
  })

  // Get project agent settings
  fastify.get('/repositories/:repositoryId/agents', async (request, reply) => {
    const { repositoryId } = request.params as { repositoryId: string }
    const settings = await AgentService.getProjectSettings(repositoryId)
    return reply.send({ settings })
  })

  // Update project agent settings
  fastify.put('/repositories/:repositoryId/agents/:agentId', async (request, reply) => {
    const { repositoryId, agentId } = request.params as { repositoryId: string; agentId: string }
    const body = request.body as { isEnabled: boolean; customPrompt?: string; config?: Record<string, unknown> }

    await AgentService.updateProjectSettings(repositoryId, agentId, body)
    return reply.send({ success: true })
  })

  // List agent executions for a task
  fastify.get('/tasks/:taskId/agent-executions', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const executions = await AgentExecutionService.listByTask(taskId)
    return reply.send({ executions })
  })

  // Get agent execution details
  fastify.get('/agent-executions/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const execution = await AgentExecutionService.getById(id)

    if (!execution) {
      return reply.status(404).send({ error: 'Execution not found' })
    }

    return reply.send({ execution })
  })

  // Stream agent execution logs (SSE)
  fastify.get('/agent-executions/:id/logs/stream', async (request, reply) => {
    const { id } = request.params as { id: string }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })

    try {
      for await (const log of AgentExecutionService.streamLogs(id)) {
        const data = JSON.stringify({
          id: log.id,
          level: log.level,
          message: log.message,
          timestamp: log.timestamp.toISOString(),
          sequenceNum: log.sequenceNum,
        })
        reply.raw.write(`data: ${data}\n\n`)
      }
    } catch (error) {
      console.error('Error streaming logs:', error)
    } finally {
      reply.raw.end()
    }
  })
}
