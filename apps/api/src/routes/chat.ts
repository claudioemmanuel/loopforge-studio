import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth/middleware.js'
import { prisma } from '../prisma/client.js'
import { createProvider } from '../providers/provider.interface.js'
import { Provider } from '@loopforge/shared'
import type { AIMessage } from '../providers/provider.interface.js'
import { EventType } from '@loopforge/shared'

export async function registerChatRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // GET /tasks/:id/chat
  app.get<{ Params: { id: string } }>('/tasks/:id/chat', async (request) => {
    const messages = await prisma.chatMessage.findMany({
      where: { taskId: request.params.id, task: { userId: request.userId } },
      orderBy: { createdAt: 'asc' },
    })
    return messages.map((m) => ({
      id: m.id,
      taskId: m.taskId,
      role: m.role,
      content: m.content,
      provider: m.provider,
      model: m.model,
      tokenCount: m.tokenCount,
      createdAt: m.createdAt.toISOString(),
    }))
  })

  // POST /tasks/:id/chat/stream — SSE streaming
  app.post<{
    Params: { id: string }
    Body: { content: string; provider?: string; model?: string }
  }>('/tasks/:id/chat/stream', async (request, reply) => {
    const { id: taskId } = request.params
    const { content, provider: providerStr, model: modelOverride } = request.body

    // Validate task belongs to user
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId: request.userId },
    })
    if (!task) {
      return reply.status(404).send({ message: 'Task not found' })
    }

    // Validate provider
    const providerEnum = (providerStr as Provider) ?? Provider.ANTHROPIC
    if (!Object.values(Provider).includes(providerEnum)) {
      return reply.status(400).send({ message: 'Invalid provider' })
    }

    // Save user message
    await prisma.chatMessage.create({
      data: {
        taskId,
        role: 'USER',
        content,
      },
    })

    // Get provider
    let aiProvider: Awaited<ReturnType<typeof createProvider>>
    try {
      aiProvider = await createProvider(request.userId, providerEnum)
    } catch (err) {
      return reply
        .header('Content-Type', 'text/event-stream')
        .header('Cache-Control', 'no-cache')
        .header('Connection', 'keep-alive')
        .send(`data: ${JSON.stringify({ type: 'error', message: (err as Error).message })}\n\n`)
    }

    const model = modelOverride ?? aiProvider.defaultModel

    // Build message history
    const history = await prisma.chatMessage.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    })

    const messages: AIMessage[] = history.map((m) => ({
      role: m.role === 'USER' ? 'user' : 'assistant',
      content: m.content,
    }))

    // Set up SSE response
    reply
      .header('Content-Type', 'text/event-stream')
      .header('Cache-Control', 'no-cache')
      .header('Connection', 'keep-alive')
      .header('X-Accel-Buffering', 'no')

    const systemPrompt = `You are an expert software engineer helping with: "${task.title}".
Be concise and focus on implementation details. Discuss approaches before writing code.`

    let accumulatedContent = ''
    let tokenCount = 0

    try {
      for await (const chunk of aiProvider.provider.stream(messages, {
        model,
        systemPrompt,
        maxTokens: 4096,
      })) {
        accumulatedContent += chunk
        tokenCount += Math.ceil(chunk.length / 4) // rough estimate
        reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
      }

      // Save assistant response
      await prisma.chatMessage.create({
        data: {
          taskId,
          role: 'ASSISTANT',
          content: accumulatedContent,
          provider: providerEnum,
          model,
          tokenCount,
        },
      })

      // Record analytics
      await prisma.analyticsEvent.create({
        data: {
          userId: request.userId,
          taskId,
          eventType: EventType.STAGE_CHANGED,
          provider: providerEnum,
          model,
          tokensUsed: tokenCount,
        },
      })

      reply.raw.write(`data: ${JSON.stringify({ type: 'done', tokenCount })}\n\n`)
    } catch (err) {
      reply.raw.write(
        `data: ${JSON.stringify({ type: 'error', message: (err as Error).message })}\n\n`,
      )
    } finally {
      reply.raw.end()
    }
  })
}
