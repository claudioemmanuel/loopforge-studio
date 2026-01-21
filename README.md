<p align="center">
  <img src="public/logo.png" alt="Loopforge Logo" width="200">
</p>

<h1 align="center">Loopforge</h1>

<p align="center">
  <strong>AI-Powered Autonomous Development Platform</strong>
</p>

<p align="center">
  Transform ideas into code with autonomous AI agents that understand your codebase and execute tasks directly.
</p>

<p align="center">
  <a href="https://github.com/your-org/loopforge/actions"><img src="https://img.shields.io/github/actions/workflow/status/your-org/loopforge/ci.yml?branch=main&style=flat-square" alt="Build Status"></a>
  <a href="https://github.com/your-org/loopforge/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js 15">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
</p>

<p align="center">
  <a href="#features">Features</a> |
  <a href="#tech-stack">Tech Stack</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#environment-variables">Configuration</a> |
  <a href="#api-reference">API</a> |
  <a href="#contributing">Contributing</a>
</p>

---

## Overview

Loopforge is a hosted SaaS platform that connects AI coding agents to your GitHub repositories. Using a visual Kanban interface, you can create tasks, watch AI brainstorm and plan solutions, and see commits pushed directly to your branches.

**How it works:**

1. **Create a Task** - Describe what you want to build or fix
2. **AI Brainstorms** - Ralph (the AI agent) analyzes your codebase and plans the approach
3. **Review the Plan** - Approve, modify, or reject the proposed changes
4. **Execute** - Watch AI implement the plan in real-time
5. **Review & Merge** - Check the commits and merge when ready

---

## Features

### Visual Kanban Board

Drag-and-drop task management with intelligent workflow columns:

| Column | Description |
|--------|-------------|
| **Todo** | Tasks waiting to be started |
| **Brainstorming** | AI is analyzing and planning |
| **Planning** | Reviewing the proposed approach |
| **Ready** | Approved and queued for execution |
| **Executing** | AI is actively writing code |
| **Done** | Completed tasks |
| **Stuck** | Tasks requiring human intervention |

### Multi-Provider AI Support

Choose from multiple AI providers based on your preference:

| Provider | Models Available |
|----------|-----------------|
| **Anthropic (Claude)** | Claude Sonnet 4, Claude Opus 4, Claude Haiku 3 |
| **OpenAI (GPT)** | GPT-4o, GPT-4 Turbo, GPT-4o Mini |
| **Google (Gemini)** | Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash |

### AI-Powered Execution

- **Autonomous coding** with your preferred AI model
- **Real-time streaming** of AI thoughts and actions
- **Intelligent context gathering** from your codebase
- **Automatic commit generation** with clear messages
- **Iterative loop execution** with stuck detection

### GitHub Integration

- **OAuth authentication** - One-click login with GitHub
- **Repository selection** - Choose which repos to connect
- **Secure token storage** - AES-256-GCM encrypted at rest
- **Branch isolation** - AI works on feature branches, never main
- **Direct commits** - Changes pushed to your repository

### Analytics Dashboard

- **Task metrics** - Total, completed, executing, stuck counts
- **Success rate** tracking with average completion time
- **Token usage** monitoring (input/output tokens)
- **Cost breakdown** with per-task averages
- **Repository activity** tables with commits and task completion
- **Export** analytics data as JSON

### Flexible Billing

- **BYOK (Bring Your Own Key)** - Use your own AI provider API keys
- **Managed** - Subscribe and use platform-provided AI credits
- **Stripe integration** for subscription management

### Security

- **Encrypted credentials** - GitHub tokens and API keys encrypted with AES-256-GCM
- **Row-level isolation** - Users only access their own data
- **No plaintext secrets** - Tokens never logged or exposed
- **Revocable access** - Disconnect anytime from GitHub settings

---

## Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| **Next.js 15** | React framework with App Router |
| **React 19** | UI library |
| **TypeScript 5.7** | Type-safe JavaScript |
| **Tailwind CSS 3.4** | Utility-first styling |
| **Radix UI** | Accessible component primitives |
| **Recharts** | Data visualization |
| **dnd-kit** | Drag and drop for Kanban |
| **Lucide React** | Icon library |

### Backend

| Technology | Purpose |
|------------|---------|
| **Next.js API Routes** | REST API endpoints |
| **NextAuth.js v5** | Authentication with GitHub OAuth |
| **Drizzle ORM** | Type-safe database queries |
| **PostgreSQL 16** | Primary database |
| **Redis 7** | Job queue backend |
| **BullMQ** | Background job processing |
| **Zod** | Schema validation |

### AI Integration

| Provider | SDK |
|----------|-----|
| **Anthropic** | @anthropic-ai/sdk |
| **OpenAI** | openai |
| **Google** | @google/generative-ai |

### DevOps

| Tool | Purpose |
|------|---------|
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |
| **Vitest** | Unit and integration testing |

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js** 18.x or higher
- **PostgreSQL** 16.x (or use Docker)
- **Redis** 7.x (or use Docker)
- **Docker & Docker Compose** (recommended for local development)
- **GitHub Account** for OAuth authentication
- **AI Provider API Key** (Anthropic, OpenAI, or Google)

---

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/loopforge.git
cd loopforge

# Copy environment template
cp .env.example .env

# Edit .env with your configuration (see Environment Variables section)

# Start all services
docker compose up -d

# View logs
docker compose logs -f
```

Visit http://localhost:3000 and complete the setup wizard.

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/your-org/loopforge.git
cd loopforge

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your configuration

# Start PostgreSQL and Redis (if not using Docker)
# Ensure they are running on their default ports

# Run database migrations
npm run db:generate
npm run db:migrate

# Start development server
npm run dev

# In a separate terminal, start the worker
npm run worker
```

Visit http://localhost:3000 to access the application.

---

## Environment Variables

Create a `.env` file (for Docker) or `.env.local` file (for local development) with the following variables:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | `Iv1.abc123...` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret | `abc123...` |
| `NEXTAUTH_SECRET` | Random string for session encryption | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Base URL of your deployment | `http://localhost:3000` |
| `ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM | Generate with `openssl rand -hex 32` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/loopforge` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `POSTGRES_PASSWORD` | PostgreSQL password (Docker) | `postgres` |
| `APP_ANTHROPIC_API_KEY` | Platform-wide Anthropic key (for managed billing) | - |
| `STRIPE_SECRET_KEY` | Stripe API secret key | - |
| `STRIPE_PUBLISHABLE_KEY` | Stripe API publishable key | - |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | - |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe price ID for Pro monthly | - |
| `STRIPE_PRICE_PRO_YEARLY` | Stripe price ID for Pro yearly | - |
| `STRIPE_PRICE_TEAM_MONTHLY` | Stripe price ID for Team monthly | - |
| `STRIPE_PRICE_TEAM_YEARLY` | Stripe price ID for Team yearly | - |

### Generate Secrets

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate ENCRYPTION_KEY (32 bytes = 64 hex characters)
openssl rand -hex 32
```

---

## GitHub OAuth App Setup

Create a GitHub OAuth App for authentication:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the details:

| Field | Value |
|-------|-------|
| **Application name** | `Loopforge` |
| **Homepage URL** | `http://localhost:3000` (or your production URL) |
| **Authorization callback URL** | `http://localhost:3000/api/auth/callback/github` |

4. Copy the **Client ID** and generate a **Client Secret**
5. Add them to your `.env` file

### Required OAuth Scopes

The OAuth App requests these permissions:

- `read:user` - Read user profile information
- `user:email` - Access email addresses
- `repo` - Full access to public and private repositories

---

## Development

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run worker` | Start background job worker |

### Database Commands

| Script | Description |
|--------|-------------|
| `npm run db:generate` | Generate migrations from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio (database GUI) |
| `npm run db:seed` | Seed database with initial data |

### Docker Commands

| Script | Description |
|--------|-------------|
| `npm run docker:dev` | Start development environment |
| `npm run docker:build` | Build Docker images |
| `npm run docker:up` | Start all containers |
| `npm run docker:down` | Stop all containers |
| `npm run docker:logs` | View container logs |
| `npm run docker:prod` | Start production environment |

---

## Testing

Loopforge uses [Vitest](https://vitest.dev/) for testing.

```bash
# Run tests in watch mode
npm run test

# Run tests once
npm run test:run

# Run tests with coverage
npm run test:coverage
```

### Test Files

Tests are located in the `__tests__/` directory:

- `ai.test.ts` - AI client tests
- `billing.test.ts` - Subscription and billing tests
- `brainstorm-chat.test.ts` - Brainstorm conversation tests
- `crypto.test.ts` - Encryption/decryption tests
- `queue.test.ts` - Job queue tests
- `ralph.test.ts` - AI loop execution tests
- `schema.test.ts` - Database schema tests
- `utils.test.ts` - Utility function tests

---

## Project Structure

```
loopforge/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Authentication pages
│   │   ├── login/                # Login page
│   │   ├── onboarding/           # New user onboarding
│   │   ├── setup/                # Initial setup wizard
│   │   └── welcome/              # Welcome page
│   ├── (dashboard)/              # Main application
│   │   ├── analytics/            # Analytics dashboard
│   │   ├── dashboard/            # Home dashboard
│   │   ├── repos/[repoId]/       # Repository task board
│   │   ├── settings/             # User settings
│   │   │   ├── account/          # Account settings
│   │   │   ├── danger-zone/      # Danger zone settings
│   │   │   ├── integrations/     # AI & GitHub integrations
│   │   │   └── preferences/      # User preferences
│   │   └── subscription/         # Subscription management
│   └── api/                      # API routes
│       ├── analytics/            # Analytics endpoints
│       ├── auth/                 # NextAuth.js endpoints
│       ├── github/               # GitHub API proxy
│       ├── repos/                # Repository management
│       ├── settings/             # User settings API
│       ├── stripe/               # Stripe webhooks
│       └── tasks/                # Task management
├── components/                   # React components
│   ├── analytics/                # Analytics charts
│   ├── dashboard/                # Dashboard components
│   ├── kanban/                   # Kanban board components
│   ├── settings/                 # Settings page components
│   └── ui/                       # shadcn/ui components
├── lib/                          # Shared utilities
│   ├── ai/                       # AI client implementations
│   │   ├── clients/              # Provider-specific clients
│   │   ├── brainstorm.ts         # Brainstorming logic
│   │   ├── client.ts             # AI client factory
│   │   └── plan.ts               # Plan generation
│   ├── api/                      # API utilities
│   ├── crypto/                   # Encryption utilities
│   ├── db/                       # Database configuration
│   │   ├── index.ts              # Drizzle client
│   │   ├── schema.ts             # Database schema
│   │   └── seed.ts               # Database seeding
│   ├── github/                   # GitHub API client
│   ├── queue/                    # BullMQ configuration
│   ├── ralph/                    # AI loop implementation
│   │   ├── loop.ts               # Main execution loop
│   │   ├── prompt-generator.ts   # Prompt templates
│   │   └── types.ts              # Type definitions
│   ├── stripe/                   # Stripe client
│   ├── auth.ts                   # NextAuth.js configuration
│   └── utils.ts                  # General utilities
├── workers/                      # Background workers
│   └── execution-worker.ts       # Task execution worker
├── drizzle/                      # Database migrations
├── public/                       # Static assets
├── __tests__/                    # Test files
├── docker-compose.yml            # Docker Compose config
├── Dockerfile                    # Web app Dockerfile
└── Dockerfile.worker             # Worker Dockerfile
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           Loopforge                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │   Next.js   │    │   BullMQ    │    │ PostgreSQL  │        │
│   │   Web App   │───▶│   Worker    │───▶│  Database   │        │
│   │  (Port 3000)│    │             │    │             │        │
│   └─────────────┘    └─────────────┘    └─────────────┘        │
│         │                  │                                    │
│         │                  │                                    │
│         ▼                  ▼                                    │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │   GitHub    │    │  AI Models  │    │    Redis    │        │
│   │   API       │    │  (Claude,   │    │   (Queue)   │        │
│   │             │    │   GPT, etc) │    │             │        │
│   └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Web App** | Next.js 15, React 19 | User interface, API routes, authentication |
| **Worker** | BullMQ, Node.js | Background job processing, AI execution |
| **Database** | PostgreSQL + Drizzle ORM | Data persistence, encrypted token storage |
| **Queue** | Redis + BullMQ | Job queue for async task execution |
| **AI** | Multiple providers | Code analysis, planning, and generation |

---

## API Reference

### Authentication

All API routes require authentication via NextAuth.js session.

### Repositories

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/repos` | List connected repositories |
| `GET` | `/api/repos/[repoId]` | Get repository details |
| `DELETE` | `/api/repos/[repoId]` | Disconnect repository |
| `GET` | `/api/repos/[repoId]/tasks` | List tasks for repository |
| `GET` | `/api/github/repos` | List user's GitHub repositories |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks/[taskId]` | Get task details |
| `PATCH` | `/api/tasks/[taskId]` | Update task (status, title, etc.) |
| `POST` | `/api/tasks/[taskId]/brainstorm` | Start AI brainstorming |
| `POST` | `/api/tasks/[taskId]/plan` | Generate execution plan |
| `POST` | `/api/tasks/[taskId]/execute` | Execute the plan |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics?range=week` | Get analytics data |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/settings` | Get user settings |
| `POST` | `/api/settings/api-key` | Save AI provider API key |
| `DELETE` | `/api/settings/api-key` | Remove API key |
| `POST` | `/api/settings/provider` | Set preferred AI provider |
| `POST` | `/api/settings/model` | Set preferred model |

---

## Deployment

### Docker (Recommended)

```bash
# Production build
docker compose up -d

# With custom environment file
docker compose --env-file .env.production up -d

# View logs
docker compose logs -f web worker
```

### Manual Deployment

1. Build the Next.js application:
   ```bash
   npm run build
   ```

2. Set up PostgreSQL and Redis servers

3. Run database migrations:
   ```bash
   npm run db:migrate
   ```

4. Start the web server:
   ```bash
   npm run start
   ```

5. Start the worker (separate process):
   ```bash
   npm run worker
   ```

### Platform Deployment

- **Vercel** - Deploy the Next.js app
- **Railway** - Deploy Redis, PostgreSQL, and worker
- **Render** - Full-stack deployment option

---

## Troubleshooting

### "UntrustedHost" Error

Ensure `AUTH_TRUST_HOST=true` is set in your environment and `trustHost: true` is configured in NextAuth.

### GitHub Login 404

Verify that `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are correctly set (not placeholder values).

### Worker Not Processing Jobs

```bash
# Check Redis connection
docker compose logs redis

# Check worker logs
docker compose logs worker
```

### Database Migration Errors

```bash
# Reset database (development only!)
docker compose down -v
docker compose up -d
npm run db:migrate
```

### AI Provider Errors

- Verify your API key is valid and has sufficient credits
- Check the provider's status page for outages
- Ensure the selected model is available in your region

---

## Security Considerations

### Token Encryption

GitHub tokens and API keys are encrypted using AES-256-GCM:

- Each token has a unique initialization vector (IV)
- Encryption key is stored in environment variables
- Decryption only happens when needed for API calls

### What Loopforge Can Access

When you authorize Loopforge:

- **Clones repositories** to analyze code
- **Creates branches** for isolated changes
- **Commits code** with clear commit messages
- **Pushes commits** to your branches

### What Loopforge Cannot Do

- Merge to main/master without your approval
- Access repositories you haven't connected
- Share your code or tokens with third parties
- Retain code after task completion

---

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Use conventional commit messages

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with Next.js, Claude AI, and a passion for developer productivity.
</p>
