import type { PlanStep } from '@agent-forge/shared'
import { prisma } from '../prisma/client.js'
import { decrypt } from './encryption.service.js'

const GITHUB_API = 'https://api.github.com'

async function getToken(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  return decrypt(user.encryptedGithubToken)
}

async function githubRequest<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw Object.assign(new Error(`GitHub API error: ${res.status} ${body}`), {
      statusCode: res.status === 401 ? 401 : 502,
    })
  }
  return res.json() as Promise<T>
}

export const RepositoryContextService = {
  /**
   * Fetches the file tree for a repository branch.
   */
  async getFileTree(
    userId: string,
    owner: string,
    repo: string,
    branch: string
  ): Promise<string[]> {
    const token = await getToken(userId)

    // GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1
    const data = await githubRequest<{
      tree: Array<{ type: string; path: string }>
      truncated: boolean
    }>(token, `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`)

    return data.tree
      .filter(item => item.type === 'blob')
      .map(item => item.path)
  },

  /**
   * Fetches the content of a specific file.
   */
  async getFileContent(
    userId: string,
    owner: string,
    repo: string,
    path: string,
    branch: string
  ): Promise<string> {
    const token = await getToken(userId)

    // GET /repos/{owner}/{repo}/contents/{path}?ref={branch}
    const data = await githubRequest<{ content?: string; type: string }>(
      token,
      `/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
    )

    if (!data.content) {
      throw new Error(`Path is not a file: ${path}`)
    }

    return Buffer.from(data.content, 'base64').toString('utf-8')
  },

  /**
   * Builds context for AI prompts by fetching relevant files based on plan steps.
   */
  async buildContext(
    userId: string,
    repo: { owner: string; name: string; defaultBranch: string },
    planSteps: PlanStep[]
  ): Promise<string> {
    const fileTree = await this.getFileTree(userId, repo.owner, repo.name, repo.defaultBranch)

    // Extract file patterns from plan steps (looking for file extensions)
    const relevantPatterns = planSteps
      .flatMap(s => [s.description, s.estimatedChanges])
      .join(' ')
      .match(/[\w-/]+\.(ts|tsx|js|jsx|json|prisma)/g) || []

    // Find files that match the patterns mentioned in the plan
    const relevantFiles = fileTree.filter(path =>
      relevantPatterns.some(pattern => path.includes(pattern.replace(/\//g, '/')))
    ).slice(0, 5) // Limit to 5 files to avoid token overflow

    // Build context string
    let context = `## Repository Structure\n\`\`\`\n${fileTree.slice(0, 30).join('\n')}\n...\n\`\`\`\n\n`

    // Fetch and include content of relevant files
    for (const filePath of relevantFiles) {
      try {
        const content = await this.getFileContent(
          userId,
          repo.owner,
          repo.name,
          filePath,
          repo.defaultBranch
        )
        const ext = filePath.split('.').pop() || 'txt'
        const language = ['ts', 'tsx'].includes(ext) ? 'typescript' : ext
        context += `## File: ${filePath}\n\`\`\`${language}\n${content}\n\`\`\`\n\n`
      } catch (error) {
        // Skip files that can't be read
        console.warn(`Failed to fetch ${filePath}:`, error)
      }
    }

    return context
  },
}
