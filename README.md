<p align="center">
  <img src="public/logo.png" alt="Loopforge Studio Logo" width="200">
</p>

<h1 align="center">Loopforge Studio</h1>

<p align="center">
  <strong>The Visual GUI for AI-Powered Coding</strong>
</p>

<p align="center">
  A self-hosted web interface for autonomous AI coding agents.<br>
  Like Claude Code or Cursor, but with a visual Kanban workflow you can run anywhere.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js 15">
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Self--Hosted-Yes-green?style=flat-square" alt="Self-Hosted">
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> |
  <a href="#features">Features</a> |
  <a href="#requirements">Requirements</a> |
  <a href="#configuration">Configuration</a> |
  <a href="#development">Development</a> |
  <a href="#roadmap">Roadmap</a>
</p>

---

## Why Loopforge Studio?

CLI-based AI coding tools are powerful but can feel opaque. Loopforge Studio gives you:

- **Visual workflow** - See your tasks move through Brainstorming, Planning, and Execution
- **Full control** - Review and approve AI plans before any code is written
- **Self-hosted** - Your code never leaves your infrastructure
- **Bring Your Own Key** - Use your own AI provider API keys (Anthropic, OpenAI, Google)

---

## Quick Start

Get Loopforge Studio running with one command:

```bash
# Clone the repository
git clone https://github.com/claudioemmanuel/loopforge-studio.git
cd loopforge-studio

# Run the setup script (handles everything)
./scripts/start.sh
```

The script will:

- Check prerequisites (Docker, openssl)
- Prompt for GitHub OAuth credentials (if not configured)
- Generate required secrets automatically
- Start all services via Docker
- Run database migrations
- Wait for health checks

Open http://localhost:3000, sign in with GitHub, and add your AI provider API key in Settings.

---

## Features

### Visual Kanban Workflow

Drag-and-drop task management with intelligent workflow columns:

| Column            | Description                                           |
| ----------------- | ----------------------------------------------------- |
| **Todo**          | Tasks waiting to be started                           |
| **Brainstorming** | AI is analyzing your codebase and discussing approach |
| **Planning**      | Review the proposed implementation plan               |
| **Ready**         | Approved and queued for execution                     |
| **Executing**     | AI is actively writing code                           |
| **Done**          | Completed tasks with commits pushed                   |
| **Stuck**         | Tasks requiring your intervention                     |

### Interactive AI Brainstorming

Chat with the AI about your task before any code is written:

- Discuss implementation approaches
- Clarify requirements
- Get suggestions based on your codebase
- Finalize the plan together

### Multi-Provider AI Support

Choose your preferred AI provider and model:

| Provider      | Models Available                                   |
| ------------- | -------------------------------------------------- |
| **Anthropic** | Claude Sonnet 4, Claude Opus 4, Claude Haiku 3     |
| **OpenAI**    | GPT-4o, GPT-4 Turbo, GPT-4o Mini                   |
| **Google**    | Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash |

### GitHub Integration

- **OAuth authentication** - Secure login with GitHub
- **Repository connection** - Choose which repos to work on
- **Branch isolation** - AI works on feature branches, never main
- **Direct commits** - Changes pushed automatically to your repository
- **Secure storage** - Tokens encrypted with AES-256-GCM

### Real-Time Execution

Watch the AI work in real-time:

- Live streaming of AI thoughts and actions
- Step-by-step execution logs
- Automatic commit generation with clear messages
- Stuck detection with actionable feedback

### Analytics Dashboard

Track your AI-assisted development:

- Task completion metrics and success rates
- Token usage monitoring
- Per-repository activity tracking

---

## Screenshots

> **Note:** Screenshots coming soon! We're preparing visual examples of the Kanban board, brainstorm panel, and analytics dashboard.

<!-- Uncomment when screenshots are available:
![Kanban Board](./docs/images/kanban.png)
*Drag-and-drop task management with intelligent workflow columns*

![Brainstorm Panel](./docs/images/brainstorm.png)
*Interactive AI chat for discussing implementation approaches*

![Analytics Dashboard](./docs/images/analytics.png)
*Track task completion metrics and token usage*
-->

---

## Requirements

Before you begin, you need:

1. **Docker & Docker Compose** - For running Loopforge Studio and its dependencies
2. **GitHub OAuth App** - For authentication ([create one here](https://github.com/settings/developers))
3. **AI Provider API Key** - From Anthropic, OpenAI, or Google

That's it. PostgreSQL and Redis run inside Docker.

---

## Configuration

### Required Environment Variables

Only 2 variables are required in your `.env` file:

| Variable               | Description                    | How to Get                                                 |
| ---------------------- | ------------------------------ | ---------------------------------------------------------- |
| `GITHUB_CLIENT_ID`     | GitHub OAuth App Client ID     | [Create OAuth App](https://github.com/settings/developers) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret | Same as above                                              |

### Auto-Generated Secrets

These are automatically created by `./scripts/init-secrets.sh`:

| Variable          | Description                       |
| ----------------- | --------------------------------- |
| `NEXTAUTH_SECRET` | Session encryption key            |
| `ENCRYPTION_KEY`  | AES-256-GCM key for token storage |

### GitHub OAuth App Setup

> **⚠️ Security Notice:** Each user must create their **own** GitHub OAuth App. Never share or commit your Client Secret to version control. The `.env` file is already in `.gitignore` for your protection.

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: `Loopforge Studio` (or any name you prefer)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click **Register application**
5. Copy the **Client ID**
6. Click **Generate a new client secret** and copy it immediately (it won't be shown again)
7. Add both to your `.env` file or enter them when prompted by `./scripts/start.sh`

### Adding Your AI Provider API Key

After starting Loopforge Studio:

1. Sign in with GitHub
2. Go to **Settings > Integrations**
3. Add your API key for Anthropic, OpenAI, or Google
4. Select your preferred model

Your API key is encrypted at rest and never logged.

---

## Development

### Hybrid Development Mode (Recommended)

Run infrastructure in Docker while running the web server locally for fast hot-reload:

```bash
# Install dependencies
npm install

# Copy environment template (first time only)
cp .env.local.example .env.local
# Edit .env.local and add your secrets

# Start infrastructure (postgres, redis, worker, bull-board)
npm run docker:infra

# In another terminal, start the web server locally
npm run dev

# Access:
# - Web UI: http://localhost:3000
# - Bull Board: http://localhost:3002
# - Worker Health: http://localhost:3001/health
```

To stop infrastructure:

```bash
npm run docker:infra:down
```

### Full Docker Mode

Run everything in Docker (use for testing production-like environment):

```bash
npm run docker:full
```

### Available Scripts

| Script                      | Description                                      |
| --------------------------- | ------------------------------------------------ |
| `npm run dev:setup`         | Start infrastructure + dev server in one command |
| `npm run docker:infra`      | Start only infrastructure (postgres, redis, etc) |
| `npm run docker:infra:logs` | View logs from infrastructure containers         |
| `npm run docker:infra:down` | Stop infrastructure containers                   |
| `npm run docker:full`       | Start all services in Docker (full mode)         |
| `npm run dev`               | Start dev server (auto-runs migrations)          |
| `npm run dev:skip-migrate`  | Start dev server without migration check         |
| `npm run build`             | Build for production                             |
| `npm run worker`            | Start background job worker locally              |
| `npm run test`              | Run tests in watch mode                          |
| `npm run test:run`          | Run tests once                                   |
| `npm run lint`              | Run ESLint                                       |

### Database Commands

| Script                | Description                             |
| --------------------- | --------------------------------------- |
| `npm run db:generate` | Generate migrations from schema changes |
| `npm run db:migrate`  | Apply pending migrations (manual)       |
| `npm run db:studio`   | Open Drizzle Studio (database GUI)      |

**Automatic Migrations:** The dev server automatically checks for and applies pending migrations on startup. This prevents "column does not exist" errors during development. If the database is not available, the check is skipped gracefully.

### Project Structure

```
loopforge-studio/
├── app/                      # Next.js App Router
│   ├── (auth)/               # Authentication pages
│   ├── (dashboard)/          # Main application
│   │   ├── analytics/        # Analytics dashboard
│   │   ├── dashboard/        # Home dashboard
│   │   ├── repos/[repoId]/   # Repository task board
│   │   ├── settings/         # User settings
│   │   └── workers/          # Worker status
│   └── api/                  # API routes
├── components/               # React components
│   ├── kanban/               # Kanban board
│   ├── brainstorm/           # Brainstorming UI
│   ├── analytics/            # Charts and metrics
│   └── ui/                   # shadcn/ui components
├── lib/                      # Shared utilities
│   ├── ai/                   # AI provider clients
│   ├── db/                   # Database schema (Drizzle)
│   ├── github/               # GitHub API client
│   ├── queue/                # BullMQ job queues
│   └── ralph/                # AI execution loop
├── workers/                  # Background workers
└── __tests__/                # Test files
```

### Tech Stack

| Technology     | Purpose                         |
| -------------- | ------------------------------- |
| Next.js 15     | React framework with App Router |
| React 19       | UI library                      |
| TypeScript     | Type-safe JavaScript            |
| Tailwind CSS   | Styling                         |
| PostgreSQL     | Database                        |
| Redis + BullMQ | Background job processing       |
| Drizzle ORM    | Type-safe database queries      |
| NextAuth.js v5 | Authentication                  |

### Architecture Overview

Loopforge Studio follows a task-driven architecture where AI work flows through defined stages:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Browser                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ Kanban Board │───▶│  Task Modal  │───▶│  Live View   │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Next.js Application                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  API Routes  │───▶│   Auth.js    │───▶│  Drizzle ORM │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
         │                                          │
         ▼                                          ▼
┌─────────────────┐                      ┌─────────────────┐
│      Redis      │◀────────────────────▶│   PostgreSQL    │
│   (Job Queue)   │                      │   (Database)    │
└─────────────────┘                      └─────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Background Worker                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ Ralph Loop   │───▶│  AI Client   │───▶│ GitHub Client│          │
│  │ (Execution)  │    │ (API Calls)  │    │  (Commits)   │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

**Task Flow:**

1. **Todo** → User creates task describing the work
2. **Brainstorming** → AI analyzes codebase, user chats to refine approach
3. **Planning** → AI generates step-by-step execution plan
4. **Ready** → User approves plan, task queued for execution
5. **Executing** → Background worker runs AI loop, commits to GitHub
6. **Done** → Changes pushed to feature branch

---

## Roadmap

We're building Loopforge Studio in the open. Here's what's coming:

### Near Term

- [ ] **More AI providers** - Ollama, local models
- [ ] **Team workspaces** - Shared repositories and tasks
- [ ] **Custom prompts** - Fine-tune AI behavior per project
- [ ] **Webhooks** - Integrate with your existing tools

### Future

- [ ] **Multi-agent collaboration** - Multiple AIs working together
- [ ] **Test execution** - Run tests before committing
- [ ] **Issue tracker integration** - Sync with Jira, Linear, GitHub Issues
- [ ] **PR creation** - Automatically open pull requests

Have ideas? [Open an issue](https://github.com/claudioemmanuel/loopforge-studio/issues) or join the discussion!

---

## Contributing

We welcome contributions! See our workflow:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run tests: `npm run test:run`
5. Push and open a Pull Request

### Development Guidelines

- Follow existing code patterns
- Write tests for new features
- Use conventional commit messages
- Update documentation as needed

For detailed guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Troubleshooting

### Database Schema Issues

If you encounter errors like "column does not exist" during login or other operations:

1. **Check health endpoint:**

   ```bash
   curl http://localhost:3000/api/health | jq .
   ```

   If `schemaValid` is `false`, run:

   ```bash
   npm run db:migrate
   ```

2. **Database not available:**

   ```bash
   docker compose -f docker-compose.dev.yml up -d postgres redis
   ```

3. **Migrations failing:**
   - Check `drizzle/meta/_journal.json` for registered migrations
   - Verify database connection with `DATABASE_URL` environment variable
   - Review migration files in `drizzle/` directory

### Migration Check Issues

If the automatic migration check is causing problems:

- **Skip migration check:** Use `npm run dev:skip-migrate`
- **Run migrations manually:** Use `npm run db:migrate`
- **Check database connectivity:** Ensure PostgreSQL is running on the configured port

---

## Contributors

Thanks to everyone who has contributed to Loopforge Studio!

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

Want to contribute? Check out our [good first issues](https://github.com/claudioemmanuel/loopforge-studio/labels/good%20first%20issue)!

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with Next.js and a passion for developer productivity.<br>
  <a href="https://github.com/claudioemmanuel/loopforge-studio">Star us on GitHub</a>
</p>
