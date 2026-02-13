-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('TODO', 'BRAINSTORMING', 'PLANNING', 'READY', 'EXECUTING', 'DONE', 'STUCK');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('ANTHROPIC', 'OPENAI', 'GOOGLE');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'ACTION', 'ERROR', 'COMMIT');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('TASK_CREATED', 'STAGE_CHANGED', 'PLAN_APPROVED', 'PLAN_REJECTED', 'EXECUTION_STARTED', 'EXECUTION_COMPLETED', 'STUCK_DETECTED', 'COMMIT_PUSHED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "githubId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT NOT NULL,
    "encryptedGithubToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "githubRepoId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repositoryId" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "stage" "Stage" NOT NULL DEFAULT 'TODO',
    "featureBranch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_plans" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "rejectionFeedback" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "tokenCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "defaultModel" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_logs" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "level" "LogLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commits" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "filesChanged" INTEGER NOT NULL DEFAULT 0,
    "committedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "repositoryId" TEXT,
    "eventType" "EventType" NOT NULL,
    "fromStage" "Stage",
    "toStage" "Stage",
    "provider" TEXT,
    "model" TEXT,
    "tokensUsed" INTEGER,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_githubId_key" ON "users"("githubId");

-- CreateIndex
CREATE INDEX "repositories_userId_idx" ON "repositories"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_userId_githubRepoId_key" ON "repositories"("userId", "githubRepoId");

-- CreateIndex
CREATE INDEX "tasks_userId_stage_idx" ON "tasks"("userId", "stage");

-- CreateIndex
CREATE INDEX "tasks_repositoryId_stage_idx" ON "tasks"("repositoryId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "execution_plans_taskId_key" ON "execution_plans"("taskId");

-- CreateIndex
CREATE INDEX "chat_messages_taskId_createdAt_idx" ON "chat_messages"("taskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "provider_configs_userId_provider_key" ON "provider_configs"("userId", "provider");

-- CreateIndex
CREATE INDEX "execution_logs_taskId_sequence_idx" ON "execution_logs"("taskId", "sequence");

-- CreateIndex
CREATE INDEX "analytics_events_userId_occurredAt_idx" ON "analytics_events"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_events_repositoryId_occurredAt_idx" ON "analytics_events"("repositoryId", "occurredAt");

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_plans" ADD CONSTRAINT "execution_plans_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_configs" ADD CONSTRAINT "provider_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
