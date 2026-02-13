import { prisma } from '../prisma/client.js'
import { Provider } from '@loopforge/shared'
import { createProvider } from '../providers/provider.interface.js'

export type PlanStep = { stepNumber: number; description: string; estimatedChanges: string }

const FALLBACK_STEPS: PlanStep[] = [
  { stepNumber: 1, description: 'Analyze codebase and understand current structure', estimatedChanges: 'Read-only analysis' },
  { stepNumber: 2, description: 'Implement the requested feature', estimatedChanges: 'Multiple file modifications expected' },
  { stepNumber: 3, description: 'Write tests and verify implementation', estimatedChanges: 'Test files' },
  { stepNumber: 4, description: 'Commit changes with descriptive message', estimatedChanges: 'Git commit' },
]

export async function generatePlanSteps(taskId: string, userId: string): Promise<PlanStep[]> {
  const [task, messages] = await Promise.all([
    prisma.task.findFirstOrThrow({ where: { id: taskId, userId } }),
    prisma.chatMessage.findMany({ where: { taskId }, orderBy: { createdAt: 'asc' }, take: 20 }),
  ])

  const config = await prisma.providerConfig.findFirst({ where: { userId, isDefault: true } })
  const providerEnum = (config?.provider as Provider) ?? Provider.ANTHROPIC

  let aiProvider: Awaited<ReturnType<typeof createProvider>>
  try {
    aiProvider = await createProvider(userId, providerEnum)
  } catch {
    return FALLBACK_STEPS.map((s) => ({ ...s, description: s.stepNumber === 2 ? `Implement: ${task.title}` : s.description }))
  }

  const conversationSummary = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n')

  let planJson = ''
  for await (const chunk of aiProvider.provider.stream(
    [
      {
        role: 'user',
        content: `Based on this brainstorming conversation about "${task.title}", generate a step-by-step execution plan.

Conversation:
${conversationSummary || `Task: ${task.description}`}

Return ONLY a JSON array with this exact format:
[{"stepNumber": 1, "description": "...", "estimatedChanges": "..."}, ...]

Each step should be concrete and actionable. Include 4-8 steps.`,
      },
    ],
    {
      model: aiProvider.defaultModel,
      maxTokens: 2048,
      systemPrompt: 'You are a software architect. Generate precise, actionable implementation plans. Return only valid JSON.',
    },
  )) {
    planJson += chunk
  }

  const match = planJson.match(/\[[\s\S]*\]/)
  if (!match) {
    return FALLBACK_STEPS
  }

  try {
    return JSON.parse(match[0]) as PlanStep[]
  } catch {
    return FALLBACK_STEPS
  }
}
