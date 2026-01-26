# Contributing to Loopforge Studio

Thank you for your interest in contributing to Loopforge Studio! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/loopforge-studio.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Run tests: `npm run test:run`
6. Commit your changes with a clear message
7. Push to your fork and submit a Pull Request

## Development Setup

```bash
# Install dependencies
npm install

# Start services
docker compose up -d postgres redis

# Run migrations
npm run db:migrate

# Start dev server
npm run dev

# Start worker (in separate terminal)
npm run worker
```

## Code Guidelines

- Use TypeScript with strict mode
- Follow existing code patterns
- Write tests for new features
- Keep commits focused and atomic
- Use clear, descriptive commit messages

## Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Add a clear description of changes
4. Link any related issues
5. Wait for review and address feedback

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- Provide clear reproduction steps for bugs
- Include relevant environment information

## Questions?

Open a Discussion on GitHub if you have questions about contributing.
