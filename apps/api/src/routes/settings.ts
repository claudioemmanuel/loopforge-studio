import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth/middleware.js'
import { prisma } from '../prisma/client.js'
import { Provider } from '@loopforge/shared'
import { encrypt } from '../services/encryption.service.js'

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // GET /settings/providers
  app.get('/settings/providers', async (request) => {
    const configs = await prisma.providerConfig.findMany({
      where: { userId: request.userId },
    })
    return configs.map((c) => ({
      id: c.id,
      userId: c.userId,
      provider: c.provider,
      defaultModel: c.defaultModel,
      isDefault: c.isDefault,
      hasKey: Boolean(c.encryptedApiKey),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))
  })

  // PUT /settings/providers/:provider
  app.put<{
    Params: { provider: string }
    Body: { apiKey: string; defaultModel?: string; isDefault?: boolean }
  }>('/settings/providers/:provider', async (request, reply) => {
    const providerEnum = request.params.provider as Provider
    if (!Object.values(Provider).includes(providerEnum)) {
      return reply.status(400).send({ message: 'Invalid provider' })
    }

    const { apiKey, defaultModel, isDefault } = request.body

    const existing = await prisma.providerConfig.findUnique({
      where: { userId_provider: { userId: request.userId, provider: providerEnum } },
    })

    if (!apiKey?.trim() && !existing?.encryptedApiKey) {
      return reply.status(400).send({ message: 'apiKey is required' })
    }

    // If setting as default, unset all others
    if (isDefault) {
      await prisma.providerConfig.updateMany({
        where: { userId: request.userId, provider: { not: providerEnum } },
        data: { isDefault: false },
      })
    }

    const DEFAULT_MODELS: Record<Provider, string> = {
      [Provider.ANTHROPIC]: 'claude-sonnet-4-5-20250929',
      [Provider.OPENAI]: 'gpt-4o',
      [Provider.GOOGLE]: 'gemini-2.5-pro',
    }

    const encryptedKey = apiKey?.trim() ? encrypt(apiKey) : existing!.encryptedApiKey

    const config = await prisma.providerConfig.upsert({
      where: { userId_provider: { userId: request.userId, provider: providerEnum } },
      update: {
        encryptedApiKey: encryptedKey,
        defaultModel: defaultModel ?? DEFAULT_MODELS[providerEnum],
        isDefault: isDefault ?? false,
      },
      create: {
        userId: request.userId,
        provider: providerEnum,
        encryptedApiKey: encryptedKey,
        defaultModel: defaultModel ?? DEFAULT_MODELS[providerEnum],
        isDefault: isDefault ?? false,
      },
    })

    return {
      id: config.id,
      userId: config.userId,
      provider: config.provider,
      defaultModel: config.defaultModel,
      isDefault: config.isDefault,
      hasKey: true,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    }
  })

  // DELETE /settings/providers/:provider
  app.delete<{ Params: { provider: string } }>(
    '/settings/providers/:provider',
    async (request, reply) => {
      const providerEnum = request.params.provider as Provider
      if (!Object.values(Provider).includes(providerEnum)) {
        return reply.status(400).send({ message: 'Invalid provider' })
      }

      await prisma.providerConfig.deleteMany({
        where: { userId: request.userId, provider: providerEnum },
      })

      return reply.status(204).send()
    },
  )
}
