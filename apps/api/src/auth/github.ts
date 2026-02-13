import type { FastifyInstance } from 'fastify'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma/client.js'
import { encrypt } from '../services/encryption.service.js'

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_URL = 'https://api.github.com/user'

// Simple in-memory state store (use Redis in production for multi-instance)
const stateStore = new Map<string, number>()

function generateState(): string {
  const state = crypto.randomUUID()
  stateStore.set(state, Date.now() + 10 * 60 * 1000) // 10 min TTL
  return state
}

function validateState(state: string): boolean {
  const expiry = stateStore.get(state)
  if (!expiry || Date.now() > expiry) return false
  stateStore.delete(state)
  return true
}

function issueJwt(userId: string): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')
  return jwt.sign({ userId }, secret, { expiresIn: '7d' })
}

export async function registerAuthRoutes(app: FastifyInstance) {
  // GET /auth/github — redirect to GitHub OAuth
  app.get('/auth/github', async (_request, reply) => {
    const clientId = process.env.GITHUB_CLIENT_ID
    if (!clientId) return reply.status(500).send({ message: 'GITHUB_CLIENT_ID not configured' })

    const state = generateState()
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${process.env.API_URL ?? 'http://localhost:3001'}/auth/github/callback`,
      scope: 'repo user:email',
      state,
    })

    return reply.redirect(`${GITHUB_OAUTH_URL}?${params}`)
  })

  // GET /auth/github/callback — exchange code for token, issue JWT
  app.get<{ Querystring: { code?: string; state?: string } }>(
    '/auth/github/callback',
    async (request, reply) => {
      const { code, state } = request.query

      if (!code || !state || !validateState(state)) {
        return reply.status(400).send({ message: 'Invalid OAuth state or missing code' })
      }

      const clientId = process.env.GITHUB_CLIENT_ID!
      const clientSecret = process.env.GITHUB_CLIENT_SECRET!
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'

      // Exchange code for access token
      const tokenRes = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
      })

      const tokenData = (await tokenRes.json()) as {
        access_token?: string
        error?: string
        error_description?: string
      }

      if (!tokenData.access_token) {
        return reply
          .status(401)
          .send({ message: tokenData.error_description ?? 'GitHub OAuth failed' })
      }

      // Fetch GitHub user
      const userRes = await fetch(GITHUB_USER_URL, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Loopforge-Studio',
        },
      })

      if (!userRes.ok) {
        return reply.status(502).send({ message: `GitHub user fetch failed: ${userRes.status}` })
      }

      const githubUser = (await userRes.json()) as {
        id: number
        login: string
        avatar_url: string
      }

      if (!githubUser.id || !githubUser.login) {
        return reply.status(502).send({ message: 'GitHub user response missing required fields' })
      }

      // Upsert user in database
      const user = await prisma.user.upsert({
        where: { githubId: String(githubUser.id) },
        update: {
          username: githubUser.login,
          avatarUrl: githubUser.avatar_url,
          encryptedGithubToken: encrypt(tokenData.access_token),
        },
        create: {
          githubId: String(githubUser.id),
          username: githubUser.login,
          avatarUrl: githubUser.avatar_url,
          encryptedGithubToken: encrypt(tokenData.access_token),
        },
      })

      const jwtToken = issueJwt(user.id)

      return reply
        .setCookie('auth_token', jwtToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60, // 7 days
        })
        .redirect(frontendUrl)
    },
  )

  // GET /auth/me
  app.get('/auth/me', { preHandler: [async (req, rep) => { const { requireAuth } = await import('./middleware.js'); await requireAuth(req, rep) }] }, async (request) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.userId } })
    return { id: user.id, username: user.username, avatarUrl: user.avatarUrl }
  })

  // POST /auth/logout
  app.post('/auth/logout', async (_request, reply) => {
    return reply
      .clearCookie('auth_token', { path: '/' })
      .status(204)
      .send()
  })
}
