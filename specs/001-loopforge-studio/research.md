# Loopforge Studio: Technical Architecture Research

**Date**: February 2026
**Scope**: Self-hosted visual workflow UI for AI-assisted coding
**Audience**: Development team, DevOps engineers

---

## 1. Frontend Framework & UI Library

### Decision
**React 18 + TypeScript + shadcn/ui + TailwindCSS**

### Rationale
- **React 18**: Mature, large ecosystem, excellent for real-time streaming updates via concurrent rendering and Suspense boundaries
- **TypeScript**: Type safety critical for UI state managing complex workflow states (7 columns, card interactions, streaming updates)
- **shadcn/ui**: Unstyled, composable components based on Radix UI primitives; perfect for custom Kanban boards
- **TailwindCSS**: Utility-first CSS framework enables rapid customization of Kanban layout and dark mode support for developer audience

**Component Architecture**:
- `<WorkflowBoard>` - Main Kanban container with 7 columns
- `<TaskCard>` - Draggable card with real-time status badges
- `<AIChatPanel>` - Streaming chat interface for Brainstorming column
- `<LogViewer>` - Real-time log streaming with syntax highlighting
- `<ProviderSelector>` - OAuth provider choice UI

**Performance Considerations**:
- Use `React.memo()` on TaskCard to prevent re-renders during column drags
- Virtualize task lists if >100 cards (react-window)
- Stream log updates via WebSocket without re-rendering entire board

### Alternatives Considered

| Alternative | Why Not Chosen |
|------------|----------------|
| **Vue 3** | Smaller ecosystem for AI provider SDKs; less industry standard for teams migrating from other ecosystems |
| **Svelte** | Excellent performance, but smaller hiring pool; component library ecosystem less mature |
| **Angular** | Overkill for a single-page dashboard; steeper learning curve for OSS contributors |
| **Solid.js** | Emerging framework; ecosystem not mature enough for production self-hosted tool |

---

## 2. Backend Framework

### Decision
**Fastify + TypeScript**

### Rationale
- **Fastify**: 2x faster request throughput than Express, built-in JSON schema validation (critical for API contracts)
- **TypeScript**: End-to-end type safety from database to WebSocket messages
- **Plugin Architecture**: Isolate OAuth, streaming, job queue concerns as discrete plugins
- **Request Hooks**: Perfect for intercepting streaming responses and audit logging

**Architecture Pattern**:
```
src/
├── plugins/           # Register OAuth, Database, WebSocket
│   ├── auth.ts       # GitHub OAuth via Fastify plugin
│   ├── db.ts         # Prisma connection pool
│   └── ws.ts         # WebSocket handler (via fastify-websocket)
├── routes/
│   ├── auth/         # POST /auth/github/callback
│   ├── workflows/    # GET/POST /workflows/:id
│   ├── tasks/        # CRUD endpoints
│   └── logs/         # GET /logs/stream (SSE or WS)
├── services/
│   ├── githubOAuth.ts
│   ├── aiProvider.ts (abstraction)
│   ├── encryption.ts (AES-256-GCM)
│   └── jobQueue.ts
└── types/
    └── index.ts      # Shared types
```

**Why Fastify over Express**:
- Built-in schema validation (OpenAPI integration free)
- Excellent streaming support (critical for logs and AI responses)
- Better memory footprint for long-lived WebSocket connections
- Plugin ecosystem mature enough for self-hosted needs

### Alternatives Considered

| Alternative | Why Not Chosen |
|------------|----------------|
| **Express** | Mature but slower; middleware paradigm less ideal for streaming; require additional libraries (helmet, cors, etc.) |
| **Hono** | Excellent for edge/serverless, but Loopforge is self-hosted on dedicated infra (Docker); unnecessary abstraction |
| **NestJS** | Over-engineered for self-hosted tool; dependency injection adds cognitive load without streaming benefits |
| **Koa** | Minimalist, but less opinionated; would require more custom scaffolding for OAuth and streaming |

---

## 3. Database ORM

### Decision
**Prisma ORM**

### Rationale
- **Type-Safe Queries**: TypeScript schema generates types automatically; catch migration errors at compile time
- **Migration System**: `prisma migrate` is superior to SQL-based migrations (no lost `.sql` files)
- **Seed Script**: Built-in `prisma/seed.ts` for seeding test data across environments
- **Query Performance**: Query optimization hints; relations loaded exactly as needed (no N+1 by default)

**Schema Example**:
```prisma
model Workflow {
  id          String   @id @default(cuid())
  title       String
  description String?
  githubRepo  String   // "owner/repo"
  columns     Column[]
  tasks       Task[]
  createdAt   DateTime @default(now())
}

model Task {
  id          String   @id @default(cuid())
  title       String
  columnId    String   // Denormalized for query speed
  status      TaskStatus // ENUM: TODO, BRAINSTORMING, PLANNING, etc.
  workflowId  String
  aiBrainOutput String?  // Streaming text from AI
  aiPlan      Json?      // Structured plan object
  logs        Log[]
}

model Secret {
  id        String @id @default(cuid())
  provider  String // "anthropic", "openai", "google"
  encrypted String // AES-256-GCM encrypted API key + nonce
  userId    String
}
```

**AES-256-GCM Encryption Implementation**:
```typescript
// services/encryption.ts
import crypto from 'crypto';

export function encrypt(plaintext: string, masterKey: Buffer): {
  ciphertext: string;
  nonce: string
} {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, nonce);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted + authTag.toString('hex'),
    nonce: nonce.toString('hex')
  };
}

export function decrypt(ciphertext: string, nonce: string, masterKey: Buffer): string {
  const nonceBuffer = Buffer.from(nonce, 'hex');
  const authTag = Buffer.from(ciphertext.slice(-32), 'hex');
  const encrypted = ciphertext.slice(0, -32);

  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, nonceBuffer);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### Alternatives Considered

| Alternative | Why Not Chosen |
|------------|----------------|
| **Drizzle ORM** | Excellent but younger ecosystem; Prisma's migration tooling more mature for team productivity |
| **TypeORM** | More verbose decorators; Prisma's schema language is more readable in VCS diffs |
| **Raw SQL + node-postgres** | No type safety; migration management burden; not worth it for self-hosted tool |
| **Sequelize** | Legacy feel; poor TypeScript support compared to Prisma |

---

## 4. Real-Time Transport

### Decision
**WebSockets via Socket.io (with HTTP fallback) for logs; Server-Sent Events (SSE) for AI streaming responses**

### Rationale

**WebSockets (Socket.io) - For Kanban Board Real-Time Updates**:
- Column changes (task move between columns)
- Live user presence indicators
- Reason: Bidirectional, low latency, handles reconnection automatically

**Server-Sent Events (SSE) - For AI Streaming**:
- Cost: Single HTTP connection per stream (no bidirectional overhead)
- Simplicity: Browser native `EventSource` API
- Error Handling: Automatic retry with Retry-After header
- Reasons: One-way (AI → Browser), perfect for streaming logs and brainstorming output

**Streaming Log Implementation**:
```typescript
// routes/logs/stream.ts
app.get('/api/tasks/:taskId/logs/stream', async (request, reply) => {
  reply.header('Content-Type', 'text/event-stream');
  reply.header('Cache-Control', 'no-cache');
  reply.header('Connection', 'keep-alive');

  const taskId = request.params.taskId;

  // Fetch historical logs (last 100 lines)
  const historicalLogs = await prisma.log.findMany({
    where: { taskId },
    take: 100,
    orderBy: { createdAt: 'asc' }
  });

  for (const log of historicalLogs) {
    reply.raw.write(`data: ${JSON.stringify(log)}\n\n`);
  }

  // Subscribe to new logs via Redis Pub/Sub or in-process event emitter
  const logListener = (newLog) => {
    reply.raw.write(`data: ${JSON.stringify(newLog)}\n\n`);
  };

  logEmitter.on(`task:${taskId}:log`, logListener);

  request.socket.on('close', () => {
    logEmitter.removeListener(`task:${taskId}:log`, logListener);
  });
});
```

**WebSocket Board Updates** (Socket.io):
```typescript
// plugins/ws.ts
io.on('connection', (socket) => {
  socket.on('join-workflow', (workflowId) => {
    socket.join(`workflow:${workflowId}`);
  });

  // When task moves in database, broadcast to all clients
  socket.on('task:move', async (taskId, columnId) => {
    await prisma.task.update({ where: { id: taskId }, data: { columnId } });

    // Notify all clients in workflow
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    io.to(`workflow:${task.workflowId}`).emit('task:updated', task);
  });
});
```

### Alternatives Considered

| Alternative | Why Not Chosen |
|------------|----------------|
| **Partykit** | Excellent for edge-deployed multi-region apps; Loopforge self-hosted means overkill and vendor lock-in |
| **WebSockets Everywhere** | For streaming logs, SSE is simpler (no ping/pong overhead); true bidirectional not needed |
| **Long-Polling** | Works but inefficient; developers today expect WebSocket/SSE experience |
| **tRPC Subscriptions** | Over-engineered for this use case; Socket.io + SSE sufficient |

---

## 5. Background Job Queue

### Decision
**BullMQ (Bull on Redis)**

### Rationale
- **Delayed Execution**: Queue `executeAITask` jobs for "Ready" → "Executing" transition with retry logic
- **Job Monitoring**: Built-in UI (Bull Board) for ops team to monitor AI worker health
- **Distributed Workers**: Multiple worker processes consume from Redis queue
- **Failure Handling**: Automatic retries with exponential backoff; dead letter queue for stuck tasks
- **Persistence**: Redis durability + Prisma backup ensure no task loss

**Job Queue Architecture**:
```typescript
// services/jobQueue.ts
import Queue from 'bull';
import Redis from 'redis';

const redisClient = new Redis(process.env.REDIS_URL);
const aiExecutionQueue = new Queue('ai-execution', {
  redis: redisClient,
  settings: {
    maxStalledCount: 2,
    lockDuration: 30000,
    lockRenewTime: 15000
  }
});

export async function queueAIExecution(taskId: string, aiPlan: AIPlan) {
  await aiExecutionQueue.add(
    { taskId, aiPlan },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false
    }
  );
}

// Worker process (separate from API server)
aiExecutionQueue.process(async (job) => {
  const { taskId, aiPlan } = job.data;

  try {
    await executeAIWorkflow(taskId, aiPlan);
    return { status: 'completed' };
  } catch (error) {
    // Auto-retry via Bull; max 3 attempts
    throw error;
  }
});
```

**Separate Worker Process** (Dockerfile):
```dockerfile
FROM node:20-alpine

COPY . .
RUN npm ci

# API server
CMD npm run start:api

# Worker process (run as separate container/process)
CMD npm run start:worker
```

### Alternatives Considered

| Alternative | Why Not Chosen |
|------------|----------------|
| **pg-boss** | PostgreSQL-backed queue (advantage: one DB); but less mature UI monitoring than Bull |
| **Quirrel** | Serverless-focused; not ideal for self-hosted long-running workers |
| **Temporal** | Overkill for this use case; heavy operational overhead; designed for microservices |
| **node-cron + Worker Threads** | Custom solution; no persistence, no distributed guarantees |

---

## 6. GitHub OAuth Pattern

### Decision
**Custom Server-Side OAuth Flow with Encrypted Token Storage**

### Rationale
- **Flow**: NextAuth is a library, not a framework; for self-hosted apps, custom OAuth gives more control
- **Server-Side Callback**: Tokens never touch frontend; stored encrypted in PostgreSQL
- **User Session**: JWT stored in HTTP-only cookie; claims include userId and githubUsername
- **Token Refresh**: GitHub personal tokens don't expire; store encrypted API token for background workers

**OAuth Implementation**:
```typescript
// routes/auth/github-callback.ts
import { randomBytes } from 'crypto';

app.get('/auth/github/callback', async (request, reply) => {
  const { code } = request.query;

  // Exchange code for access token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code
    })
  });

  const { access_token } = await tokenResponse.json();

  // Fetch user info
  const userResponse = await fetch('https://api.github.com/user', {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });

  const { id: githubId, login: githubUsername, email } = await userResponse.json();

  // Upsert user in database
  const user = await prisma.user.upsert({
    where: { githubId },
    update: { lastLoginAt: new Date() },
    create: {
      githubId,
      githubUsername,
      email
    }
  });

  // Encrypt and store GitHub token
  const { ciphertext, nonce } = encrypt(access_token, MASTER_KEY);

  await prisma.secret.upsert({
    where: { userId_provider: { userId: user.id, provider: 'github' } },
    update: { encrypted: ciphertext, nonce },
    create: {
      userId: user.id,
      provider: 'github',
      encrypted: ciphertext,
      nonce
    }
  });

  // Create JWT token
  const sessionToken = await reply.jwtSign(
    { userId: user.id, githubUsername },
    { expiresIn: '30d' }
  );

  reply.setCookie('session', sessionToken, {
    httpOnly: true,
    secure: true, // HTTPS only in production
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  });

  reply.redirect('/');
});
```

**Session Middleware**:
```typescript
// plugins/auth.ts
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET
});

app.decorate('authenticate', async function(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});
```

### Alternatives Considered

| Alternative | Why Not Chosen |
|------------|----------------|
| **NextAuth.js** | Designed for Next.js; Loopforge uses Fastify backend; adds unnecessary abstraction |
| **Passport.js** | Middleware-based; less idiomatic with Fastify plugin architecture |
| **Auth0** | Cloud service; violates self-hosted requirement; adds vendor dependency |
| **Clerk** | Same concerns as Auth0; cloud-only solution |

---

## 7. AI Provider SDK Abstraction Pattern

### Decision
**Strategy Pattern with Provider-Specific Adapters**

### Rationale
- **Unified Interface**: Single `IAIProvider` interface for Anthropic, OpenAI, Google
- **Pluggable**: New providers (HuggingFace, etc.) added without changing core code
- **Streaming**: Each adapter handles provider's native streaming format (text/event-stream)
- **Error Handling**: Normalize rate limits, quota errors across providers

**Implementation**:
```typescript
// services/ai/types.ts
export interface IAIProvider {
  chat(prompt: string, systemPrompt?: string): Promise<string>;
  streamChat(prompt: string, systemPrompt?: string): AsyncGenerator<string>;
  getAvailableModels(): Promise<string[]>;
  validateApiKey(apiKey: string): Promise<boolean>;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// services/ai/anthropic.ts
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicProvider implements IAIProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async *streamChat(prompt: string, systemPrompt?: string) {
    const stream = await this.client.messages.stream({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }]
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield chunk.delta.text;
      }
    }
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }]
      });
      return true;
    } catch {
      return false;
    }
  }
}

// services/ai/openai.ts
import OpenAI from 'openai';

export class OpenAIProvider implements IAIProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async *streamChat(prompt: string, systemPrompt?: string) {
    const stream = this.client.beta.messages.stream({
      model: 'gpt-4o',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }]
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        yield event.delta.text;
      }
    }
  }
}

// services/ai/factory.ts
export class AIProviderFactory {
  static create(provider: string, apiKey: string): IAIProvider {
    switch (provider) {
      case 'anthropic':
        return new AnthropicProvider(apiKey);
      case 'openai':
        return new OpenAIProvider(apiKey);
      case 'google':
        return new GoogleProvider(apiKey);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
}
```

**Usage in Routes**:
```typescript
// routes/tasks/brainstorm.ts
app.post('/api/tasks/:taskId/brainstorm', async (request, reply) => {
  const { taskId } = request.params;
  const { userMessage, selectedProvider } = request.body;

  const secret = await prisma.secret.findUnique({
    where: { userId_provider: { userId: request.user.userId, provider: selectedProvider } }
  });

  if (!secret) return reply.code(400).send({ error: 'Provider not configured' });

  const decryptedKey = decrypt(secret.encrypted, secret.nonce, MASTER_KEY);
  const aiProvider = AIProviderFactory.create(selectedProvider, decryptedKey);

  reply.header('Content-Type', 'text/event-stream');

  for await (const chunk of aiProvider.streamChat(userMessage)) {
    reply.raw.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);

    // Also log to database for persistence
    await prisma.log.create({
      data: { taskId, type: 'ai_brainstorm', content: chunk }
    });
  }

  reply.raw.end();
});
```

### Alternatives Considered

| Alternative | Why Not Chosen |
|------------|----------------|
| **LangChain** | Abstraction over abstractions; overkill for 3 providers; adds 50+ dependencies |
| **Vercel AI SDK** | Excellent but tightly coupled to Vercel ecosystem; introduces runtime overhead |
| **OpenRouter** | Works but requires proxying through third party; self-hosted means we control routing |
| **Conditional Imports** | Harder to maintain; no single interface contract |

---

## 8. Monorepo vs Separate Repos

### Decision
**Monorepo (Nx or Turborepo) with 3 Workspaces**

### Rationale
- **Shared Types**: TypeScript types for API contracts (task, workflow objects) shared across frontend/backend
- **Single PR**: Review frontend + backend changes together
- **Deployment**: Docker build can reference both `apps/web` and `apps/api`
- **Testing**: End-to-end tests live in `packages/e2e`

**Repository Structure**:
```
loopforge-studio/
├── package.json          # Root package.json with workspaces
├── nx.json               # Nx configuration
├── docker-compose.yml
├── Dockerfile
├── apps/
│   ├── api/              # Fastify backend
│   │   ├── src/
│   │   │   ├── plugins/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── types/
│   │   ├── tests/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── package.json
│   │
│   └── web/              # React frontend
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── services/
│       │   └── hooks/
│       ├── tests/
│       └── package.json
│
├── packages/
│   ├── types/            # Shared TypeScript types
│   │   └── index.ts      # Export Task, Workflow, etc.
│   │
│   ├── encryption/       # Shared encryption utilities
│   │   └── index.ts      # AES-256-GCM encrypt/decrypt
│   │
│   └── e2e/              # End-to-end tests (Playwright)
│       └── tests/
│
└── .github/
    └── workflows/
        └── deploy.yml    # Build & push to registry
```

**Root package.json**:
```json
{
  "name": "loopforge-studio",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "concurrently \"npm -w apps/api run dev\" \"npm -w apps/web run dev\"",
    "build": "npm -w packages/types && npm -w apps/api run build && npm -w apps/web run build",
    "test": "npm test --workspaces",
    "docker:build": "docker build -t loopforge-studio ."
  },
  "devDependencies": {
    "concurrently": "^8.0.0",
    "nx": "^19.0.0",
    "typescript": "^5.3.3"
  }
}
```

**Build Efficiency**:
- Nx will only rebuild `apps/api` if API files changed
- Nx will only rebuild `apps/web` if web files or `packages/types` changed
- CI/CD only runs tests for affected modules

### Alternatives Considered

| Alternative | Why Not Chosen |
|------------|----------------|
| **Separate Repos** | Type misalignment between frontend/backend; painful to refactor shared contracts |
| **Single Repo** | Hard to reason about; frontend devs don't need API dependencies in node_modules |
| **Pnpm Workspaces** | Nx provides better DX with task automation; pnpm still requires manual script coordination |

---

## 9. Container & Self-Hosted Deployment

### Decision
**Docker Compose for Local Development; Single Docker Image for Production Deployment**

### Rationale
- **One Image**: API server + static web assets bundled; simplifies deployment to any Linux host
- **Docker Compose**: Local dev includes Postgres, Redis, optional Mailhog for OAuth testing
- **Environment Parity**: Dev/staging/prod use same container
- **Volume Mounts**: Developers can mount source code for live reload during development

**Dockerfile** (Multi-Stage Build):
```dockerfile
# Stage 1: Build web app
FROM node:20-alpine AS web-builder
WORKDIR /app

# Copy monorepo root + web app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN npm ci
RUN npm -w apps/web run build

# Stage 2: Build API
FROM node:20-alpine AS api-builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY prisma ./prisma

RUN npm ci
RUN npm -w apps/api run build
RUN npm -w prisma run migrate

# Stage 3: Runtime (combined API + web)
FROM node:20-alpine
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy only production dependencies
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/api/dist ./apps/api/dist
COPY --from=web-builder /app/apps/web/dist ./apps/web/dist

RUN npm ci --omit=dev

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 3000

# Use dumb-init to handle signals
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/index.js"]
```

**docker-compose.yml** (Development):
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: loopforge
      POSTGRES_PASSWORD: dev-password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      target: api-builder
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:dev-password@postgres:5432/loopforge
      REDIS_URL: redis://redis:6379
      GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID}
      GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET}
      JWT_SECRET: dev-secret
      MASTER_KEY: ${MASTER_KEY:-0000000000000000000000000000000000000000000000000000000000000000}
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./apps/api/src:/app/apps/api/src
      - /app/node_modules  # Prevent node_modules overwrite
    command: npm -w apps/api run dev

  web:
    image: node:20-alpine
    working_dir: /app
    environment:
      VITE_API_URL: http://localhost:3000
    ports:
      - "5173:5173"
    depends_on:
      - api
    volumes:
      - ./:/app
      - /app/node_modules
    command: npm -w apps/web run dev

volumes:
  postgres_data:
```

**Deployment to VPS** (e.g., DigitalOcean, AWS EC2):
```bash
# On Linux host
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh

# Clone and setup
git clone https://github.com/your-org/loopforge-studio.git
cd loopforge-studio

# Create .env file
cat > .env <<EOF
GITHUB_CLIENT_ID=your_github_app_id
GITHUB_CLIENT_SECRET=your_github_app_secret
MASTER_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -base64 32)
NODE_ENV=production
EOF

# Build and run
docker build -t loopforge:latest .
docker run -d \
  --name loopforge \
  -p 80:3000 \
  -p 443:3000 \
  --env-file .env \
  -v loopforge_data:/app/data \
  loopforge:latest
```

### Alternatives Considered

| Alternative | Why Not Chosen |
|------------|----------------|
| **Kubernetes** | Too complex for self-hosted single-instance deployments; Docker Compose sufficient |
| **Podman** | Not widely deployed; Docker more familiar to DevOps teams |
| **Systemd Services** | Requires different deployment per OS; Docker abstracts away OS differences |
| **Nixos** | Excellent but learning curve; not standard in industry |

---

## Summary: Tech Stack Decision Matrix

| Category | Decision | Key Rationale |
|----------|----------|---------------|
| **Frontend** | React 18 + TypeScript + shadcn/ui + Tailwind | Type-safe, large ecosystem, perfect for real-time Kanban UI |
| **Backend** | Fastify + TypeScript | 2x faster than Express, excellent streaming, plugin-based architecture |
| **Database** | Prisma ORM + PostgreSQL | Type-safe migrations, automatic code generation, superior query building |
| **Real-Time** | WebSockets (Socket.io) + SSE | Bidirectional board updates via WS; one-way AI streams via SSE |
| **Job Queue** | BullMQ (Redis-backed) | Distributed workers, built-in monitoring (Bull Board), automatic retries |
| **Auth** | Custom OAuth + JWT | Full control, encrypted token storage, no vendor lock-in |
| **AI Abstraction** | Strategy Pattern + Factory | Pluggable providers, unified interface, easy to add new models |
| **Repository** | Monorepo (Nx) | Shared types, single PR review, co-located frontend/backend |
| **Deployment** | Docker Compose + Single Docker Image | Dev/prod parity, works on any Linux host, easy scaling |

---

## Getting Started Checklist

**Phase 0: Environment Setup**
- [ ] Node.js 20+ LTS
- [ ] PostgreSQL 16 (local or Docker)
- [ ] Redis 7 (local or Docker)
- [ ] GitHub OAuth App created (https://github.com/settings/developers)
- [ ] Anthropic API key (for testing)

**Phase 1: Project Scaffold**
```bash
npm create vite@latest apps/web -- --template react-ts
npm init -y -w packages/types
npm init -y -w apps/api
npm install -w apps/api fastify @fastify/websocket @fastify/jwt prisma
npm install -w apps/web react react-dom @radix-ui/react-dialog shadcn-ui tailwindcss
```

**Phase 2: Core Modules**
1. Prisma schema + migrations (Task, Workflow, Secret, Log entities)
2. GitHub OAuth flow (routes/auth/github-callback.ts)
3. WebSocket plugin (plugins/ws.ts)
4. AI Provider abstraction (services/ai/)
5. BullMQ job queue setup

**Phase 3: UI Implementation**
1. Kanban board layout (components/WorkflowBoard.tsx)
2. Task card with drag-and-drop (components/TaskCard.tsx)
3. Log viewer with SSE streaming (components/LogViewer.tsx)
4. Provider selector (components/ProviderSelector.tsx)

---

## References & Additional Notes

**Streaming Best Practices**:
- Use SSE for server → browser streams (logs, AI output)
- Use WebSockets for bidirectional updates (Kanban column changes)
- Always include reconnection logic on client side

**Security Checklist**:
- AES-256-GCM for all API keys at rest
- HTTPS-only cookies in production
- Content-Security-Policy headers
- CORS restricted to frontend domain
- Rate limiting on auth endpoints

**Monitoring & Observability**:
- BullMQ Board UI at `/admin/queues` for job monitoring
- Structured JSON logging to stdout (parse with `docker logs`)
- Health check endpoint at `/health`
- Optional: Datadog/New Relic integration

**Future Enhancements**:
- Multi-worker scaling via Docker Swarm or Kubernetes
- Workflow audit log (who moved task when)
- Webhook support for GitHub events (PR created, code review)
- Cost tracking per provider (token consumption)
- Custom LLM fine-tuning on project-specific patterns
