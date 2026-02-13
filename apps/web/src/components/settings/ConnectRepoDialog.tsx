import { useEffect, useState } from 'react'
import type { Repository, GithubRepositoryOption } from '@loopforge/shared'
import { apiClient } from '../../services/api.client'
import { X, Loader2 } from 'lucide-react'

interface ConnectRepoDialogProps {
  onClose: () => void
  onConnected: (repo: Repository) => void
}

export function ConnectRepoDialog({ onClose, onConnected }: ConnectRepoDialogProps) {
  const [repos, setRepos] = useState<GithubRepositoryOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)

  useEffect(() => {
    apiClient
      .get<GithubRepositoryOption[]>('/repositories/github')
      .then(setRepos)
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  const handleConnect = async (githubRepoId: string) => {
    setConnecting(githubRepoId)
    try {
      const repo = await apiClient.post<Repository>('/repositories', { githubRepoId })
      onConnected(repo)
    } finally {
      setConnecting(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Connect Repository</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
          Loopforge uses GitHub's API — no local clone needed. The AI commits plan artifacts to a
          feature branch on your behalf.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : repos.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No repositories available to connect.
          </p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {repos.map((repo) => (
              <div
                key={repo.githubRepoId}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{repo.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    Branch: {repo.defaultBranch}
                  </p>
                </div>
                {repo.alreadyConnected ? (
                  <span className="text-xs text-muted-foreground">Connected</span>
                ) : (
                  <button
                    onClick={() => handleConnect(repo.githubRepoId)}
                    disabled={connecting === repo.githubRepoId}
                    className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {connecting === repo.githubRepoId ? 'Connecting…' : 'Connect'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
