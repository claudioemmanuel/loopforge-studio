# Loopforge Studio Setup Guide

This guide walks you through setting up Loopforge Studio locally.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker** and **Docker Compose** - [Install Docker](https://docs.docker.com/get-docker/)
- **A GitHub account** - [Create an account](https://github.com/signup)
- **An AI provider API key** (at least one of the following):
  - Anthropic (Claude)
  - OpenAI (GPT)
  - Google (Gemini)

## Quick Start (Recommended)

The easiest way to get started is with our one-command setup script:

```bash
# Clone the repository
git clone https://github.com/claudioemmanuel/loopforge-studio.git
cd loopforge-studio

# Run the setup script
./scripts/start.sh
```

The script will:

1. Check that Docker and other prerequisites are installed
2. Prompt you for GitHub OAuth credentials (if not already configured)
3. Generate required secrets (`NEXTAUTH_SECRET`, `ENCRYPTION_KEY`)
4. Build and start all Docker containers
5. Run database migrations
6. Wait for services to be healthy

Once complete, open http://localhost:3000 and sign in with GitHub.

### Creating a GitHub OAuth App

> **⚠️ Important Security Notice**
>
> Each user must create their **own** GitHub OAuth App. Your Client Secret is sensitive - treat it like a password:
>
> - **Never** commit it to version control
> - **Never** share it publicly or in issues/discussions
> - **Never** use someone else's OAuth credentials
>
> The `.env` file is already in `.gitignore` to protect your credentials.

When the setup script prompts for GitHub credentials:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in:
   - **Application name**: `Loopforge Studio` (or any name you prefer)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click **"Register application"**
5. Copy the **Client ID** (this is public, safe to share)
6. Click **"Generate a new client secret"** and copy it immediately
   - ⚠️ The secret is only shown once - save it securely
   - ⚠️ This secret is private - never share it

---

## Advanced Setup

For more control over the setup process, you can configure things manually.

### Manual Environment Configuration

```bash
# Copy the environment template
cp .env.example .env

# Edit .env and add your GitHub OAuth credentials
# GITHUB_CLIENT_ID=your_client_id
# GITHUB_CLIENT_SECRET=your_client_secret

# Generate secrets manually
openssl rand -base64 32  # Use for NEXTAUTH_SECRET
openssl rand -hex 32     # Use for ENCRYPTION_KEY
```

### Running Without Docker

If you prefer to run services locally:

```bash
# Install dependencies
npm install

# Start PostgreSQL and Redis (required)
docker compose up -d db redis

# Run database migrations
npm run db:migrate

# Start development server
npm run dev

# In a separate terminal, start the background worker
npm run worker
```

### Using Make Commands

```bash
make help       # Show all available commands
make start      # Run the one-command setup
make dev        # Start development server (requires Redis)
make dev-docker # Start Redis via Docker, then dev server
```

---

## Adding Your AI Provider API Key

After starting Loopforge Studio:

1. Sign in with GitHub
2. Go to **Settings > Integrations**
3. Add your API key for Anthropic, OpenAI, or Google
4. Select your preferred model

Your API key is encrypted at rest and never logged.

### Getting API Keys

**Anthropic (Claude)**

1. Go to [Anthropic Console](https://console.anthropic.com)
2. Navigate to **Settings** → **API Keys**
3. Click **"Create Key"**

**OpenAI (GPT)**

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Click **"Create new secret key"**

**Google (Gemini)**

1. Go to [Google AI Studio](https://aistudio.google.com/app/api-keys)
2. Click **"Create API Key"**

---

## Troubleshooting

### GitHub OAuth Errors

**"redirect_uri_mismatch" error**

- Verify the callback URL in your GitHub OAuth app matches exactly:
  ```
  http://localhost:3000/api/auth/callback/github
  ```

**"Bad credentials" error**

- Regenerate your GitHub Client Secret
- Update `GITHUB_CLIENT_SECRET` in your `.env` file
- Restart: `docker compose restart`

### Docker Issues

**"Port already in use" error**

```bash
# Check what's using port 3000
lsof -i :3000
```

**"Cannot connect to Docker daemon"**

- Ensure Docker Desktop is running

**Container keeps restarting**

```bash
# Check container logs
docker compose logs -f

# Rebuild containers
docker compose down && docker compose build && docker compose up
```

### Database Issues

**"Connection refused" error**

```bash
# Ensure PostgreSQL container is running
docker compose ps

# Check database logs
docker compose logs db
```

**Migration errors**

```bash
# Run migrations manually
docker compose exec web npm run db:migrate
```

---

## Getting Help

If you encounter issues not covered here:

1. Check the [GitHub Issues](https://github.com/claudioemmanuel/loopforge-studio/issues) for similar problems
2. Open a new issue with:
   - Your environment (OS, Docker version)
   - Steps to reproduce
   - Error messages and logs
