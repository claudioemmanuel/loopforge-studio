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

export const GithubService = {
  async getUserRepos(userId: string) {
    const token = await getToken(userId)
    const repos = await githubRequest<Array<{
      id: number
      full_name: string
      name: string
      owner: { login: string }
      default_branch: string
    }>>(token, '/user/repos?per_page=100&sort=updated&type=owner')
    return repos
  },

  async getRepoDetails(userId: string, owner: string, repo: string) {
    const token = await getToken(userId)
    return githubRequest<{ id: number; default_branch: string; full_name: string }>(
      token,
      `/repos/${owner}/${repo}`,
    )
  },

  async validateRepoAccess(userId: string, owner: string, repo: string): Promise<boolean> {
    try {
      await GithubService.getRepoDetails(userId, owner, repo)
      return true
    } catch {
      return false
    }
  },

  async createBranch(
    userId: string,
    owner: string,
    repo: string,
    branchName: string,
    fromBranch: string,
  ): Promise<void> {
    const token = await getToken(userId)

    // Guard: never create from or to main/master directly in execution
    if (branchName === 'main' || branchName === 'master') {
      throw new Error('AI execution must not commit to main/master branches')
    }

    // Get SHA of source branch
    const refData = await githubRequest<{ object: { sha: string } }>(
      token,
      `/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`,
    )

    await githubRequest(token, `/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: refData.object.sha,
      }),
    })
  },

  /**
   * Create a commit on a branch using the Git Data API.
   * Stores the AI step output as a markdown file so the commit has real content.
   * Returns the new commit SHA.
   */
  async createCommit(
    userId: string,
    owner: string,
    repo: string,
    branch: string,
    message: string,
    files: Array<{ path: string; content: string }>,
  ): Promise<string> {
    const token = await getToken(userId)

    // Get latest commit SHA on the branch
    const refData = await githubRequest<{ object: { sha: string } }>(
      token,
      `/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    )
    const latestCommitSha = refData.object.sha

    // Get the tree SHA from the latest commit
    const commitData = await githubRequest<{ tree: { sha: string } }>(
      token,
      `/repos/${owner}/${repo}/git/commits/${latestCommitSha}`,
    )

    // Create blobs for each file
    const treeItems = await Promise.all(
      files.map(async (file) => {
        const blob = await githubRequest<{ sha: string }>(
          token,
          `/repos/${owner}/${repo}/git/blobs`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: Buffer.from(file.content).toString('base64'),
              encoding: 'base64',
            }),
          },
        )
        return { path: file.path, mode: '100644', type: 'blob', sha: blob.sha }
      }),
    )

    // Create tree
    const tree = await githubRequest<{ sha: string }>(
      token,
      `/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_tree: commitData.tree.sha, tree: treeItems }),
      },
    )

    // Create commit
    const newCommit = await githubRequest<{ sha: string }>(
      token,
      `/repos/${owner}/${repo}/git/commits`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, tree: tree.sha, parents: [latestCommitSha] }),
      },
    )

    // Update branch ref
    await githubRequest(
      token,
      `/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha: newCommit.sha }),
      },
    )

    return newCommit.sha
  },

  async pushFile(
    userId: string,
    owner: string,
    repo: string,
    branch: string,
    path: string,
    content: string,
    message: string,
    existingSha?: string,
  ): Promise<{ sha: string }> {
    const token = await getToken(userId)
    const body: Record<string, unknown> = {
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
    }
    if (existingSha) body.sha = existingSha

    const result = await githubRequest<{ content: { sha: string } }>(
      token,
      `/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    return { sha: result.content.sha }
  },

  /**
   * Creates a pull request.
   */
  async createPullRequest(
    userId: string,
    owner: string,
    repo: string,
    params: {
      title: string
      body: string
      head: string
      base: string
    }
  ): Promise<{ url: string; number: number }> {
    const token = await getToken(userId)
    const data = await githubRequest<{ html_url: string; number: number }>(
      token,
      `/repos/${owner}/${repo}/pulls`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: params.title,
          body: params.body,
          head: params.head,
          base: params.base,
        }),
      },
    )
    return { url: data.html_url, number: data.number }
  },

  /**
   * Merges a pull request.
   */
  async mergePullRequest(
    userId: string,
    owner: string,
    repo: string,
    prNumber: number,
    mergeMethod: 'merge' | 'squash' | 'rebase' = 'squash'
  ): Promise<void> {
    const token = await getToken(userId)
    await githubRequest(
      token,
      `/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merge_method: mergeMethod }),
      },
    )
  },

  /**
   * Gets the status of a pull request including CI checks.
   */
  async getPullRequestStatus(
    userId: string,
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<{
    state: 'open' | 'closed' | 'merged'
    mergeable: boolean
    checks: { passing: boolean }
  }> {
    const token = await getToken(userId)

    // Get PR details
    const pr = await githubRequest<{
      state: string
      merged: boolean
      mergeable: boolean | null
      head: { sha: string }
    }>(token, `/repos/${owner}/${repo}/pulls/${prNumber}`)

    // Check CI status
    const checks = await githubRequest<{
      check_runs: Array<{ conclusion: string | null; status: string }>
    }>(token, `/repos/${owner}/${repo}/commits/${pr.head.sha}/check-runs`)

    const allComplete = checks.check_runs.every(check => check.status === 'completed')
    const allPassing = checks.check_runs.every(check => check.conclusion === 'success')

    return {
      state: pr.merged ? 'merged' : pr.state as 'open' | 'closed',
      mergeable: pr.mergeable ?? false,
      checks: { passing: allComplete && allPassing },
    }
  },
}
