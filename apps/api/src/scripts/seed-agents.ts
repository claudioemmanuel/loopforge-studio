import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { AgentService } from '../services/agent.service.js'
import { AgentCategory } from '@loopforge/shared'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface AgentDefinition {
  file: string
  category: AgentCategory
}

const SAMPLE_AGENTS: AgentDefinition[] = [
  { file: 'code-reviewer.md', category: AgentCategory.QUALITY_SECURITY },
  { file: 'test-runner.md', category: AgentCategory.QUALITY_SECURITY },
  { file: 'security-auditor.md', category: AgentCategory.QUALITY_SECURITY },
]

async function seedAgents() {
  console.log('🌱 Seeding sample agents...')

  let createdCount = 0
  let skippedCount = 0

  for (const { file, category } of SAMPLE_AGENTS) {
    try {
      const agentsDir = join(__dirname, '..', 'agents')
      const filePath = join(agentsDir, file)
      const markdown = readFileSync(filePath, 'utf-8')

      await AgentService.seedFromMarkdown(markdown, category)
      console.log(`  ✓ Created agent from ${file}`)
      createdCount++
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log(`  ⊘ Skipped ${file} (already exists)`)
        skippedCount++
      } else {
        console.error(`  ✗ Failed to create agent from ${file}:`, error)
        throw error
      }
    }
  }

  console.log(`\n✅ Seeding complete: ${createdCount} created, ${skippedCount} skipped`)
}

seedAgents()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seeding failed:', error)
    process.exit(1)
  })
