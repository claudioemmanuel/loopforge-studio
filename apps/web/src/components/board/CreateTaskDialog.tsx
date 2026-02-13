import { useState, useEffect } from 'react'
import { useBoardStore } from '../../store/board.store'
import { apiClient } from '../../services/api.client'
import type { Repository } from '@loopforge/shared'
import { X } from 'lucide-react'

interface CreateTaskDialogProps {
  onClose: () => void
}

export function CreateTaskDialog({ onClose }: CreateTaskDialogProps) {
  const { createTask } = useBoardStore()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [repositoryId, setRepositoryId] = useState('')
  const [autonomousMode, setAutonomousMode] = useState(false)
  const [repos, setRepos] = useState<Repository[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    apiClient.get<Repository[]>('/repositories').then(setRepos).catch(console.error)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim()) return

    setIsSubmitting(true)
    try {
      await createTask({
        title: title.trim(),
        description: description.trim(),
        repositoryId: repositoryId || undefined,
        autonomousMode,
      })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-md border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Task</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Add user authentication"
              maxLength={200}
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you want to build…"
              rows={4}
              required
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {repos.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium">Repository (optional)</label>
              <select
                value={repositoryId}
                onChange={(e) => setRepositoryId(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">No repository selected</option>
                {repos.map((repo) => (
                  <option key={repo.id} value={repo.id}>
                    {repo.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-start space-x-2 rounded-md border border-warning/30 bg-warning/10 p-3">
            <input
              type="checkbox"
              id="autonomousMode"
              checked={autonomousMode}
              onChange={(e) => setAutonomousMode(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="autonomousMode" className="flex-1 text-sm">
              <span className="font-medium text-foreground">Enable Autonomous Mode</span>
              <p className="mt-1 text-xs text-muted-foreground">
                PRs will be automatically merged after passing CI checks. Use with caution!
              </p>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !description.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
