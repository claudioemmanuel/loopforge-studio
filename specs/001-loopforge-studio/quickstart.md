# Quickstart: Loopforge Studio

**Estimated time**: 5–10 minutes from clone to running

---

## Prerequisites

- Docker & Docker Compose (v2+)
- A GitHub OAuth App (see step 1)
- At least one AI provider API key (Anthropic, OpenAI, or Google)

---

## Step 1: Create a GitHub OAuth App

1. Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
2. Set:
   - **Application name**: Loopforge Studio (Local)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3001/auth/github/callback`
3. Copy the **Client ID** and generate a **Client Secret**

---

## Step 2: Configure Environment

```bash
git clone <your-fork-or-repo>
cd loopforge-studio
cp .env.example .env
```

Edit `.env`:

```env
# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# Security — generate with: openssl rand -base64 32
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_32_byte_base64_key

# Database
DATABASE_URL=postgresql://loopforge:loopforge@db:5432/loopforge

# Redis
REDIS_URL=redis://redis:6379

# App
API_PORT=3001
WEB_PORT=3000
NODE_ENV=development
```

---

## Step 3: Start the Application

```bash
docker compose up --build
```

This starts:
- `web` — Frontend at http://localhost:3000
- `api` — Backend API at http://localhost:3001
- `db` — PostgreSQL (port 5432)
- `redis` — Redis for BullMQ (port 6379)

First startup runs database migrations automatically.

---

## Step 4: Verify It Works

1. Open http://localhost:3000
2. Click **Sign in with GitHub** → complete OAuth
3. You should land on the Kanban board

---

## Step 5: Run the Full Workflow

1. **Connect a repo**: Settings → Repositories → Connect → select a GitHub repo
2. **Add AI provider**: Settings → Providers → Anthropic → enter API key → Save
3. **Create a task**: Click `+ New Task` → enter title and description → Create
4. **Brainstorm**: Drag task to Brainstorming column → open chat → describe what you want
5. **Review plan**: After AI generates a plan, review it in the Planning column → Approve
6. **Watch execution**: Task moves to Executing → live logs stream in the UI
7. **Check GitHub**: A new feature branch appears on your connected repo with a commit

---

## Validation Checklist

- [ ] Board shows 7 columns
- [ ] GitHub OAuth login completes successfully
- [ ] Repository appears in connected repos after connection
- [ ] AI chat responds within 5 seconds
- [ ] Approving a plan moves task to Ready
- [ ] Execution logs stream in real time
- [ ] Commit appears on a feature branch (not main)
- [ ] Analytics page shows task and token data after completion

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| OAuth callback fails | Callback URL mismatch | Verify GitHub app callback URL matches `http://localhost:3001/auth/github/callback` |
| AI chat returns 401 | Invalid or missing API key | Settings → Providers → re-enter key |
| No logs streaming | Task not in EXECUTING stage | Check task stage; ensure worker is running (`docker compose ps`) |
| Commit missing | Branch protection on main | Expected — AI commits to feature branch only |
| Worker not starting | Redis not ready | Run `docker compose restart api` after Redis is healthy |
