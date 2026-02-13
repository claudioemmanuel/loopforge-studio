# Contributing to Loopforge Studio

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/loopforge-studio.git`
3. **Install** dependencies: `pnpm install`
4. **Start** the dev environment: `./start.sh`
5. **Create a branch**: `git checkout -b feature/your-feature`

## Development Setup

See [SETUP.md](./SETUP.md) for detailed environment setup instructions.

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL and Redis)
- A GitHub OAuth App for authentication

## How to Contribute

### Reporting Bugs

- Search [existing issues](https://github.com/claudioemmanuel/loopforge-studio/issues) first
- If not found, [open a new issue](https://github.com/claudioemmanuel/loopforge-studio/issues/new?template=bug_report.md)
- Include steps to reproduce, expected behavior, and actual behavior
- Include browser/OS/Node.js version information

### Suggesting Features

- [Open a feature request](https://github.com/claudioemmanuel/loopforge-studio/issues/new?template=feature_request.md)
- Describe the problem your feature would solve
- Suggest an implementation approach if possible

### Submitting Pull Requests

1. **Branch** from `main`
2. **Follow** the existing code style (Prettier + ESLint are configured)
3. **Write** descriptive commit messages
4. **Test** your changes locally
5. **Push** your branch and open a PR against `main`

### PR Guidelines

- Keep PRs focused on a single change
- Update documentation if your change affects the public API
- Add screenshots for UI changes
- Reference related issues in the PR description

## Code Style

This project uses:

- **TypeScript** — strict mode, no `any` where avoidable
- **Prettier** — auto-formatting (run `pnpm format`)
- **ESLint** — linting (run `pnpm lint`)
- **Tailwind CSS** — utility-first styling

The CI pipeline checks types, linting, and builds on every PR.

## Project Structure

```
apps/api/     → Fastify backend (REST API, WebSocket, workers)
apps/web/     → React frontend (Vite, TailwindCSS, Zustand)
packages/shared/ → Shared TypeScript types and contracts
```

### Key Conventions

- **Stores** use Zustand with the `create` pattern
- **API routes** are registered in `apps/api/src/routes/`
- **Components** are grouped by feature domain
- **Types** shared between frontend/backend live in `packages/shared`

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
