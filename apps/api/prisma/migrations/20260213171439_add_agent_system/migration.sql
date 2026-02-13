-- CreateEnum
CREATE TYPE "AgentCategory" AS ENUM ('META_ORCHESTRATION', 'CORE_DEVELOPMENT', 'QUALITY_SECURITY', 'LANGUAGE_SPECIALIST', 'INFRASTRUCTURE', 'DATA_AI', 'DEVELOPER_EXPERIENCE', 'SPECIALIZED_DOMAIN', 'BUSINESS_PRODUCT', 'RESEARCH_ANALYSIS');

-- CreateEnum
CREATE TYPE "AgentExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "AgentCategory" NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "systemPrompt" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_agent_settings" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "customPrompt" TEXT,
    "config" JSONB,

    CONSTRAINT "project_agent_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_executions" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "stage" "Stage" NOT NULL,
    "status" "AgentExecutionStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "contextKey" TEXT NOT NULL,
    "output" JSONB,
    "metrics" JSONB,

    CONSTRAINT "agent_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_logs" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequenceNum" INTEGER NOT NULL,

    CONSTRAINT "agent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agents_category_isActive_idx" ON "agents"("category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "agents_name_version_key" ON "agents"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "project_agent_settings_repositoryId_agentId_key" ON "project_agent_settings"("repositoryId", "agentId");

-- CreateIndex
CREATE INDEX "agent_executions_taskId_stage_idx" ON "agent_executions"("taskId", "stage");

-- CreateIndex
CREATE INDEX "agent_executions_agentId_status_idx" ON "agent_executions"("agentId", "status");

-- CreateIndex
CREATE INDEX "agent_logs_executionId_sequenceNum_idx" ON "agent_logs"("executionId", "sequenceNum");

-- AddForeignKey
ALTER TABLE "project_agent_settings" ADD CONSTRAINT "project_agent_settings_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_agent_settings" ADD CONSTRAINT "project_agent_settings_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_executions" ADD CONSTRAINT "agent_executions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_executions" ADD CONSTRAINT "agent_executions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_logs" ADD CONSTRAINT "agent_logs_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "agent_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
