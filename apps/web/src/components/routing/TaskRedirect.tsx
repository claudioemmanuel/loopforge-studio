import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { apiClient } from '../../services/api.client'
import type { Task } from '@loopforge/shared'

export function TaskRedirect() {
  const { id } = useParams<{ id: string }>()
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    apiClient
      .get<Task>(`/tasks/${id}`)
      .then(setTask)
      .catch(() => setTask(null))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    )
  }

  if (task?.repositoryId) {
    return <Navigate to={`/repo/${task.repositoryId}/task/${task.id}`} replace />
  }

  // No repository — redirect to dashboard
  return <Navigate to="/" replace />
}
