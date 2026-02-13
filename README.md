<p align="center">
  <h1 align="center">Loopforge Studio</h1>
  <p align="center">
    AI-powered workflow automation with node-based flow visualization
  </p>
</p>

<p align="center">
  <a href="https://github.com/claudioemmanuel/loopforge-studio/actions/workflows/ci.yml"><img src="https://github.com/claudioemmanuel/loopforge-studio/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/claudioemmanuel/loopforge-studio/blob/main/LICENSE"><img src="https://img.shields.io/github/license/claudioemmanuel/loopforge-studio" alt="License" /></a>
  <a href="https://github.com/claudioemmanuel/loopforge-studio/stargazers"><img src="https://img.shields.io/github/stars/claudioemmanuel/loopforge-studio" alt="Stars" /></a>
  <img src="https://img.shields.io/badge/TypeScript-5.4-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-20-339933" alt="Node.js" />
</p>

---

Loopforge Studio is an open-source platform that automates software development workflows using AI agents. It takes a task description and guides it through a structured pipeline — from brainstorming and planning to code generation, review, and merge — all visualized on an interactive node-based flow canvas.

## Features

- **Node-based flow canvas** — Visualize task progress through stages with ReactFlow, animated edges, and real-time status updates
- **Multi-stage workflow** — TODO, Brainstorming, Planning, Ready, Executing, Code Review, Done (+ Stuck recovery)
- **AI-powered brainstorming** — Chat with AI (Anthropic, OpenAI, Google) to refine requirements with streaming responses
- **Automated planning** — AI generates execution plans with step-by-step implementation details
- **Code generation** — Autonomous code generation with real commits to GitHub repositories
- **PR automation** — Auto-creates pull requests with optional autonomous merge after CI passes
- **Multi-agent orchestration** — Pluggable agent system for code review, testing, and security scanning
- **Real-time updates** — WebSocket-powered live updates across all connected clients
- **Repository dashboard** — Rich tiles with task stats, stage distribution, and health indicators
- **Dark/light mode** — Full theme support across the entire UI
- **GitHub OAuth** — Secure authentication via GitHub

## Architecture

```
loopforge-studio/
├── apps/
│   ├── api/          # Fastify REST API + WebSocket + BullMQ workers
│   └── web/          # React SPA (Vite + TailwindCSS + Zustand)
└── packages/
    └── shared/       # TypeScript types and contracts
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Zustand, ReactFlow, Radix UI |
| **Backend** | Node.js, Fastify, Prisma ORM, Socket.io, BullMQ |
| **Database** | PostgreSQL 16, Redis 7 |
| **AI Providers** | Anthropic Claude, OpenAI GPT, Google Gemini |
| **Infrastructure** | Docker Compose, GitHub Actions CI |

### Workflow Pipeline

```
TODO → Brainstorming → Planning → Ready → Executing → Code Review → Done
                                              ↓
                                            Stuck → (re-queue to Brainstorming)
```

Each stage has dedicated UI panels:
- **Brainstorming** — Real-time AI chat with streaming
- **Planning** — Plan review with approve/reject flow
- **Executing** — Live log streaming with progress tracking
- **Code Review** — PR review with merge controls
- **Stuck** — Error details with re-queue action

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- [Docker](https://www.docker.com/) (for PostgreSQL and Redis)
- A [GitHub OAuth App](https://github.com/settings/developers) (callback URL: `http://localhost:3001/auth/github/callback`)

### 1. Clone and install

```bash
git clone https://github.com/claudioemmanuel/loopforge-studio.git
cd loopforge-studio
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your GitHub OAuth credentials and generate security keys:

```bash
# Generate secrets
openssl rand -base64 64  # JWT_SECRET
openssl rand -base64 32  # ENCRYPTION_KEY
```

### 3. Start everything

```bash
./start.sh
```

Or step by step:

```bash
pnpm docker:up          # Start PostgreSQL + Redis + API
pnpm --filter @loopforge/api health   # Wait for services
pnpm --filter @loopforge/api db:setup # Run migrations
pnpm --filter @loopforge/web dev      # Start frontend
```

### 4. Open the app

Navigate to **http://localhost:3000**, sign in with GitHub, connect a repository, and create your first task.

## Development

### Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services in parallel |
| `pnpm dev:init` | Full initialization + start |
| `pnpm docker:up` | Start Docker services |
| `pnpm docker:down` | Stop Docker services |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm format` | Format code with Prettier |

### Database

| Command | Description |
|---------|-------------|
| `pnpm --filter @loopforge/api db:setup` | Run migrations + generate client |
| `pnpm --filter @loopforge/api db:migrate` | Create new migration |
| `pnpm --filter @loopforge/api db:reset` | Reset database (destroys data) |

### Project Structure

```
apps/api/
├── src/
│   ├── agents/         # Agent definitions (markdown)
│   ├── auth/           # GitHub OAuth + JWT middleware
│   ├── config/         # Feature flags
│   ├── prisma/         # Database client
│   ├── providers/      # AI provider integrations
│   ├── realtime/       # Socket.io gateway
│   ├── routes/         # REST API endpoints
│   ├── services/       # Business logic
│   └── workers/        # BullMQ job processors
├── prisma/
│   └── schema.prisma   # Database schema
└── Dockerfile.dev

apps/web/
├── src/
│   ├── components/
│   │   ├── board/      # Task creation dialog
│   │   ├── chat/       # Brainstorming panel
│   │   ├── dashboard/  # Repository dashboard tiles
│   │   ├── flow/       # ReactFlow canvas, stage nodes, side panel
│   │   ├── layout/     # Header, breadcrumb, auth guard
│   │   ├── logs/       # Execution logs, stuck panel
│   │   ├── plan/       # Plan review panel
│   │   ├── repository/ # Task cards, filters, progress dots
│   │   ├── review/     # Code review panel
│   │   └── ui/         # Radix UI primitives
│   ├── pages/          # Route pages
│   ├── services/       # API, Socket, SSE clients
│   └── store/          # Zustand state management
└── index.html

packages/shared/
└── src/
    ├── types.ts        # Domain entities and enums
    └── contracts.ts    # Request/response DTOs
```

## Agent System

Loopforge includes a pluggable multi-agent orchestration system (behind feature flag `ENABLE_AGENT_ORCHESTRATION`):

- **Code Reviewer** — Automated code quality analysis
- **Test Runner** — Test execution and coverage reporting
- **Security Auditor** — Vulnerability scanning (OWASP Top 10)

Agents run in parallel via BullMQ queues with real-time log streaming. See [AGENT_SYSTEM_STATUS.md](./AGENT_SYSTEM_STATUS.md) for details.

## Services

| Service | Port | Description |
|---------|------|-------------|
| Web (Vite) | 3000 | React frontend |
| API (Fastify) | 3001 | REST API + WebSocket |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Job queue + caching |

## Environment Variables

See [`.env.example`](./.env.example) for all available configuration options.

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth App client secret |
| `JWT_SECRET` | Yes | JWT signing key (min 32 chars) |
| `ENCRYPTION_KEY` | Yes | AES-256-GCM key for stored secrets |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `ENABLE_AGENT_ORCHESTRATION` | No | Enable multi-agent system (default: false) |

## Contributing

Contributions are welcome! Please read the [Contributing Guide](./CONTRIBUTING.md) and [Code of Conduct](./CODE_OF_CONDUCT.md) before submitting a PR.

## Security

If you discover a security vulnerability, please follow our [Security Policy](./SECURITY.md).

## License

This project is licensed under the [MIT License](./LICENSE).
