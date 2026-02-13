import type { FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'

interface JwtPayload {
  userId: string
  iat: number
  exp: number
}

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')

  const token = request.cookies?.auth_token

  if (!token) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    })
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload
    request.userId = payload.userId
  } catch {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid or expired session',
    })
  }
}
