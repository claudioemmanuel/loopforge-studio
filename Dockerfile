# syntax=docker/dockerfile:1

# ============================================
# Base stage - shared dependencies
# ============================================
FROM node:22-alpine AS base

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# ============================================
# Dependencies stage - install all dependencies
# ============================================
FROM base AS deps

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ============================================
# Builder stage - build the application
# ============================================
FROM base AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Dummy DATABASE_URL for build-time (Next.js static generation needs this)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

# Build the application
RUN npm run build

# ============================================
# Migration tools stage - cacheable migration dependencies
# ============================================
FROM base AS migration-tools

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production deps + migration tools in cacheable layer
# --ignore-scripts avoids husky prepare script failing (husky is a devDependency)
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts && \
    npm install --no-save drizzle-kit@0.30.2 tsx@4.19.2 drizzle-orm @neondatabase/serverless pg

# ============================================
# Runner stage - production image
# ============================================
FROM node:22-alpine AS runner

WORKDIR /app

# Install postgresql-client for pg_isready and curl for health checks
RUN apk add --no-cache postgresql-client curl

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy drizzle migrations and config
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Copy lib directory for seed script
COPY --from=builder /app/lib ./lib

# Copy package.json and tsconfig for npm scripts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Copy pre-installed migration tools from migration-tools stage
COPY --from=migration-tools /app/node_modules ./node_modules

# Copy entrypoint script
COPY scripts/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create data directory
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check - verify app responds to requests
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
