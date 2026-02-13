import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth/middleware.js'
import { prisma } from '../prisma/client.js'
import { GithubService } from '../services/github.service.js'
import { Stage } from '@loopforge/shared'
import type { RepositoryDashboardTile, TaskListItem } from '@loopforge/shared'

export async function registerRepositoryRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // GET /repositories/dashboard — dashboard tiles with aggregated stats
  app.get('/repositories/dashboard', async (request) => {
    const repos = await prisma.repository.findMany({
      where: { userId: request.userId },
      orderBy: { connectedAt: 'desc' },
      include: {
        tasks: {
          select: {
            id: true,
            stage: true,
            updatedAt: true,
          },
        },
      },
    })

    const tiles: RepositoryDashboardTile[] = repos.map((repo) => {
      const tasks = repo.tasks
      const stageDistribution = Object.values(Stage).reduce(
        (acc, stage) => {
          acc[stage] = tasks.filter((t) => t.stage === stage).length
          return acc
        },
        {} as Record<Stage, number>,
      )

      const activeTasks = tasks.filter(
        (t) => t.stage !== Stage.TODO && t.stage !== Stage.DONE && t.stage !== Stage.STUCK,
      ).length
      const completedTasks = tasks.filter((t) => t.stage === Stage.DONE).length
      const stuckTasks = tasks.filter((t) => t.stage === Stage.STUCK).length

      const mostRecentUpdate = tasks.length > 0
        ? tasks.reduce((latest, t) =>
            t.updatedAt > latest.updatedAt ? t : latest
          ).updatedAt.toISOString()
        : null

      let health: 'green' | 'yellow' | 'red' = 'green'
      if (stuckTasks > 0) health = 'red'
      else if (activeTasks > 3) health = 'yellow'

      return {
        id: repo.id,
        fullName: repo.fullName,
        owner: repo.owner,
        name: repo.name,
        defaultBranch: repo.defaultBranch,
        totalTasks: tasks.length,
        activeTasks,
        completedTasks,
        stuckTasks,
        stageDistribution,
        health,
        recentActivity: mostRecentUpdate,
        connectedAt: repo.connectedAt.toISOString(),
      }
    })

    return tiles
  })

  // GET /repositories/:id/tasks — task list with filters
  app.get<{
    Params: { id: string }
    Querystring: { stage?: string; sort?: string; order?: string }
  }>('/repositories/:id/tasks', async (request, reply) => {
    // Verify repo belongs to user
    const repo = await prisma.repository.findFirst({
      where: { id: request.params.id, userId: request.userId },
    })
    if (!repo) {
      return reply.status(404).send({ message: 'Repository not found' })
    }

    const { stage, sort = 'createdAt', order = 'desc' } = request.query
    const where: Record<string, unknown> = {
      repositoryId: request.params.id,
      userId: request.userId,
    }
    if (stage && Object.values(Stage).includes(stage as Stage)) {
      where.stage = stage
    }

    const orderBy: Record<string, string> = {}
    if (['createdAt', 'updatedAt', 'title'].includes(sort)) {
      orderBy[sort] = order === 'asc' ? 'asc' : 'desc'
    } else {
      orderBy.createdAt = 'desc'
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy,
      include: {
        _count: { select: { chatMessages: true } },
        repository: { select: { name: true } },
        executionPlan: { select: { status: true } },
      },
    })

    const items: TaskListItem[] = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      stage: t.stage as Stage,
      featureBranch: t.featureBranch,
      repositoryId: t.repositoryId,
      repositoryName: t.repository?.name ?? null,
      chatMessageCount: t._count.chatMessages,
      executionPlanStatus: (t.executionPlan?.status as import('@loopforge/shared').PlanStatus) ?? null,
      autonomousMode: t.autonomousMode,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }))

    return items
  })

  // GET /repositories — list connected repos
  app.get('/repositories', async (request) => {
    const repos = await prisma.repository.findMany({
      where: { userId: request.userId },
      orderBy: { connectedAt: 'desc' },
    })
    return repos.map((r) => ({
      id: r.id,
      userId: r.userId,
      githubRepoId: r.githubRepoId,
      owner: r.owner,
      name: r.name,
      fullName: r.fullName,
      defaultBranch: r.defaultBranch,
      connectedAt: r.connectedAt.toISOString(),
    }))
  })

  // GET /repositories/github — list repos available to connect
  app.get('/repositories/github', async (request) => {
    const [githubRepos, connected] = await Promise.all([
      GithubService.getUserRepos(request.userId),
      prisma.repository.findMany({
        where: { userId: request.userId },
        select: { githubRepoId: true },
      }),
    ])

    const connectedIds = new Set(connected.map((r) => r.githubRepoId))

    return githubRepos.map((repo) => ({
      githubRepoId: String(repo.id),
      fullName: repo.full_name,
      defaultBranch: repo.default_branch,
      alreadyConnected: connectedIds.has(String(repo.id)),
    }))
  })

  // POST /repositories — connect a repo
  app.post<{ Body: { githubRepoId: string } }>(
    '/repositories',
    async (request, reply) => {
      const { githubRepoId } = request.body
      if (!githubRepoId) {
        return reply.status(400).send({ message: 'githubRepoId is required' })
      }

      // Fetch repo details from GitHub
      const githubRepos = await GithubService.getUserRepos(request.userId)
      const found = githubRepos.find((r) => String(r.id) === String(githubRepoId))
      if (!found) {
        return reply.status(404).send({ message: 'Repository not found or access denied' })
      }

      const repo = await prisma.repository.upsert({
        where: {
          userId_githubRepoId: { userId: request.userId, githubRepoId: String(githubRepoId) },
        },
        update: { defaultBranch: found.default_branch },
        create: {
          userId: request.userId,
          githubRepoId: String(githubRepoId),
          owner: found.owner.login,
          name: found.name,
          fullName: found.full_name,
          defaultBranch: found.default_branch,
        },
      })

      return reply.status(201).send({
        id: repo.id,
        userId: repo.userId,
        githubRepoId: repo.githubRepoId,
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        connectedAt: repo.connectedAt.toISOString(),
      })
    },
  )

  // DELETE /repositories/:id
  app.delete<{ Params: { id: string } }>('/repositories/:id', async (request, reply) => {
    await prisma.repository.delete({
      where: { id: request.params.id, userId: request.userId },
    })
    return reply.status(204).send()
  })
}
