import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyCookie from '@fastify/cookie'
import fastifySensible from '@fastify/sensible'
import fastifyRateLimit from '@fastify/rate-limit'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  })

  // ── Plugins ────────────────────────────────────────────────────────────────
  await app.register(fastifyCors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  })

  await app.register(fastifyCookie, {
    secret: process.env.JWT_SECRET ?? 'fallback-secret',
  })

  await app.register(fastifySensible)

  await app.register(fastifyRateLimit, {
    max: 60,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // Rate limit by user ID if authenticated, otherwise by IP
      return (request.headers['x-user-id'] as string) ?? request.ip
    },
  })

  // ── Health check ───────────────────────────────────────────────────────────
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

  // ── Global error handler ───────────────────────────────────────────────────
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error)

    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name,
        message: error.message,
      })
    }

    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    })
  })

  // ── Routes ─────────────────────────────────────────────────────────────────
  // Routes are registered lazily so the app can start without all deps
  // Each route module registers itself when imported
  const { registerAuthRoutes } = await import('./auth/github.js')
  const { registerTaskRoutes } = await import('./routes/tasks.js')
  const { registerRepositoryRoutes } = await import('./routes/repositories.js')
  const { registerChatRoutes } = await import('./routes/chat.js')
  const { registerPlanRoutes } = await import('./routes/plans.js')
  const { registerLogRoutes } = await import('./routes/logs.js')
  const { registerSettingsRoutes } = await import('./routes/settings.js')
  const { registerAnalyticsRoutes } = await import('./routes/analytics.js')
  const { registerStatusRoutes } = await import('./routes/status.js')
  const { registerAgentsRoutes } = await import('./routes/agents.js')

  // Register each route group in its own plugin scope so addHook is scoped
  await app.register(async (scope) => { await registerStatusRoutes(scope) })
  await app.register(async (scope) => { await registerAuthRoutes(scope) })
  await app.register(async (scope) => { await registerTaskRoutes(scope) })
  await app.register(async (scope) => { await registerRepositoryRoutes(scope) })
  await app.register(async (scope) => { await registerChatRoutes(scope) })
  await app.register(async (scope) => { await registerPlanRoutes(scope) })
  await app.register(async (scope) => { await registerLogRoutes(scope) })
  await app.register(async (scope) => { await registerSettingsRoutes(scope) })
  await app.register(async (scope) => { await registerAnalyticsRoutes(scope) })
  await app.register(async (scope) => { await registerAgentsRoutes(scope) })

  return app
}
