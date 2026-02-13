import { prisma } from '../prisma/client.js'
import { AgentCategory, AgentExecutionStatus } from '@loopforge/shared'
import type { Agent, ProjectAgentSettings, Prisma } from '@prisma/client'

// ── DTOs ───────────────────────────────────────────────────────────────────────

interface CreateAgentDTO {
  name: string
  displayName: string
  description: string
  category: AgentCategory
  version?: string
  systemPrompt: string
  capabilities: Prisma.InputJsonValue
  isCore?: boolean
  isActive?: boolean
}

interface UpdateAgentDTO {
  displayName?: string
  description?: string
  systemPrompt?: string
  capabilities?: Prisma.InputJsonValue
  isActive?: boolean
}

interface AgentSettingsDTO {
  isEnabled: boolean
  customPrompt?: string | null
  config?: Prisma.InputJsonValue | null
}

interface MarkdownAgent {
  name: string
  displayName: string
  description: string
  systemPrompt: string
  capabilities: string[]
}

// ── Helper Functions ───────────────────────────────────────────────────────────

function toAgentDto(agent: Agent) {
  return {
    id: agent.id,
    name: agent.name,
    displayName: agent.displayName,
    description: agent.description,
    category: agent.category as AgentCategory,
    version: agent.version,
    systemPrompt: agent.systemPrompt,
    capabilities: agent.capabilities as Record<string, unknown>,
    isActive: agent.isActive,
    isCore: agent.isCore,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  }
}

/**
 * Parse agent definition from markdown content
 * Expected format:
 * # Agent Name
 * Description paragraph
 *
 * ## System Prompt
 * The actual prompt
 *
 * ## Capabilities
 * - capability 1
 * - capability 2
 */
function parseAgentMarkdown(content: string): MarkdownAgent {
  const lines = content.split('\n')

  let name = ''
  let displayName = ''
  let description = ''
  let systemPrompt = ''
  let capabilities: string[] = []

  let section: 'header' | 'description' | 'system-prompt' | 'capabilities' | 'none' = 'none'

  for (const line of lines) {
    const trimmed = line.trim()

    // Parse header
    if (trimmed.startsWith('# ')) {
      displayName = trimmed.substring(2).trim()
      // Generate name from display name (lowercase, hyphenated)
      name = displayName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      section = 'description'
      continue
    }

    // Parse sections
    if (trimmed.startsWith('## System Prompt')) {
      section = 'system-prompt'
      continue
    }

    if (trimmed.startsWith('## Capabilities')) {
      section = 'capabilities'
      continue
    }

    // Skip other headings
    if (trimmed.startsWith('##')) {
      section = 'none'
      continue
    }

    // Collect content based on section
    switch (section) {
      case 'description':
        if (trimmed) {
          description += (description ? ' ' : '') + trimmed
        }
        break

      case 'system-prompt':
        if (trimmed) {
          systemPrompt += (systemPrompt ? '\n' : '') + trimmed
        }
        break

      case 'capabilities':
        if (trimmed.startsWith('- ')) {
          capabilities.push(trimmed.substring(2).trim())
        }
        break
    }
  }

  return {
    name,
    displayName,
    description,
    systemPrompt,
    capabilities,
  }
}

// ── Service ────────────────────────────────────────────────────────────────────

export const AgentService = {
  /**
   * List all agents with optional category filter
   */
  async list(category?: AgentCategory) {
    const agents = await prisma.agent.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ isCore: 'desc' }, { name: 'asc' }],
    })
    return agents.map(toAgentDto)
  },

  /**
   * Get agent by ID
   */
  async getById(agentId: string) {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    })
    return agent ? toAgentDto(agent) : null
  },

  /**
   * Get agent by name and version
   */
  async getByName(name: string, version = '1.0.0') {
    const agent = await prisma.agent.findUnique({
      where: { name_version: { name, version } },
    })
    return agent ? toAgentDto(agent) : null
  },

  /**
   * Create a new agent
   */
  async create(data: CreateAgentDTO) {
    const agent = await prisma.agent.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        category: data.category,
        version: data.version ?? '1.0.0',
        systemPrompt: data.systemPrompt,
        capabilities: data.capabilities,
        isCore: data.isCore ?? false,
        isActive: data.isActive ?? true,
      },
    })
    return toAgentDto(agent)
  },

  /**
   * Update an agent
   */
  async update(agentId: string, data: UpdateAgentDTO) {
    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.systemPrompt !== undefined && { systemPrompt: data.systemPrompt }),
        ...(data.capabilities !== undefined && { capabilities: data.capabilities }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })
    return toAgentDto(agent)
  },

  /**
   * Delete an agent (only if not core)
   */
  async delete(agentId: string) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } })
    if (!agent) {
      throw Object.assign(new Error('Agent not found'), { statusCode: 404 })
    }
    if (agent.isCore) {
      throw Object.assign(new Error('Cannot delete core agents'), { statusCode: 403 })
    }
    await prisma.agent.delete({ where: { id: agentId } })
  },

  // ── Project Settings ─────────────────────────────────────────────────────────

  /**
   * Get all agent settings for a repository
   */
  async getProjectSettings(repositoryId: string) {
    const settings = await prisma.projectAgentSettings.findMany({
      where: { repositoryId },
      include: { agent: true },
    })
    return settings.map((s) => ({
      id: s.id,
      repositoryId: s.repositoryId,
      agentId: s.agentId,
      isEnabled: s.isEnabled,
      customPrompt: s.customPrompt,
      config: s.config as Record<string, unknown> | null,
      agent: toAgentDto(s.agent),
    }))
  },

  /**
   * Update project-specific agent settings
   */
  async updateProjectSettings(
    repositoryId: string,
    agentId: string,
    settings: AgentSettingsDTO
  ) {
    // Verify repository and agent exist
    await prisma.repository.findFirstOrThrow({ where: { id: repositoryId } })
    await prisma.agent.findFirstOrThrow({ where: { id: agentId } })

    // Upsert settings
    const result = await prisma.projectAgentSettings.upsert({
      where: {
        repositoryId_agentId: { repositoryId, agentId },
      },
      create: {
        repositoryId,
        agentId,
        isEnabled: settings.isEnabled,
        customPrompt: settings.customPrompt ?? null,
        config: (settings.config ?? null) as any,
      },
      update: {
        isEnabled: settings.isEnabled,
        customPrompt: settings.customPrompt ?? null,
        config: (settings.config ?? null) as any,
      },
    })

    return result
  },

  /**
   * Get enabled agents for a project at a specific stage
   */
  async getEnabledAgentsForProject(repositoryId: string, stage: string) {
    // Get project settings
    const settings = await prisma.projectAgentSettings.findMany({
      where: { repositoryId, isEnabled: true },
      include: { agent: true },
    })

    // Filter active agents
    const enabledAgents = settings
      .filter((s) => s.agent.isActive)
      .map((s) => ({
        ...toAgentDto(s.agent),
        customPrompt: s.customPrompt,
        config: s.config as Record<string, unknown> | null,
      }))

    // TODO: Filter by stage-appropriate agents
    // For now, return all enabled agents
    return enabledAgents
  },

  // ── Seeding ──────────────────────────────────────────────────────────────────

  /**
   * Seed an agent from markdown content
   */
  async seedFromMarkdown(
    markdownContent: string,
    category: AgentCategory
  ) {
    const parsed = parseAgentMarkdown(markdownContent)

    // Check if agent already exists
    const existing = await this.getByName(parsed.name)
    if (existing) {
      throw Object.assign(new Error(`Agent ${parsed.name} already exists`), {
        statusCode: 409,
      })
    }

    return this.create({
      name: parsed.name,
      displayName: parsed.displayName,
      description: parsed.description,
      category,
      systemPrompt: parsed.systemPrompt,
      capabilities: { list: parsed.capabilities },
      isCore: true,
      isActive: true,
    })
  },
}
