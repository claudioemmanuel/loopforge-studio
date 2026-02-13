FROM node:20-alpine

RUN apk add --no-cache openssl && \
    corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Build shared + generate Prisma client + build API
RUN pnpm --filter @loopforge/shared build && \
    pnpm --filter @loopforge/api exec prisma generate && \
    pnpm --filter @loopforge/api build

WORKDIR /app

EXPOSE 3001

CMD ["sh", "-c", "/app/apps/api/node_modules/.bin/prisma migrate deploy --schema=/app/apps/api/prisma/schema.prisma && node /app/apps/api/dist/index.js"]
