import { buildApp } from './app.js'
import { initBoardGateway } from './realtime/board.gateway.js'
import { startExecutionWorkers, recoverOrphanedTasks } from './workers/execution.worker.js'

const port = parseInt(process.env.API_PORT ?? '3001', 10)
const host = process.env.HOST ?? '0.0.0.0'

const app = await buildApp()

try {
  await app.listen({ port, host })

  // Initialize Socket.io board gateway
  initBoardGateway(app.server)

  // Start BullMQ execution workers
  startExecutionWorkers()

  // Recover any orphaned tasks stuck in READY/EXECUTING stages
  await recoverOrphanedTasks()

  console.log(`Loopforge API listening on ${host}:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
