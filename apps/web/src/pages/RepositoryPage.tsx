import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useRepositoryStore } from '../store/repository.store'
import { RepoTaskCard } from '../components/repository/RepoTaskCard'
import { TaskFilterBar } from '../components/repository/TaskFilterBar'
import { CreateTaskDialog } from '../components/board/CreateTaskDialog'
import { Plus, Inbox } from 'lucide-react'
import { Skeleton } from '../components/ui/skeleton'
import type { Stage } from '@loopforge/shared'

export function RepositoryPage() {
  const { repoId } = useParams<{ repoId: string }>()
  const { tasks, repository, isLoading, filters, fetchRepoTasks, fetchRepository, setFilter } =
    useRepositoryStore()
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    if (repoId) {
      fetchRepository(repoId)
      fetchRepoTasks(repoId)
    }
  }, [repoId, fetchRepository, fetchRepoTasks])

  const handleStageChange = useCallback(
    (stage: Stage | null) => {
      setFilter({ stage })
      if (repoId) fetchRepoTasks(repoId)
    },
    [setFilter, fetchRepoTasks, repoId],
  )

  const handleSortChange = useCallback(
    (sort: string) => {
      setFilter({ sort })
      if (repoId) fetchRepoTasks(repoId)
    },
    [setFilter, fetchRepoTasks, repoId],
  )

  const handleOrderToggle = useCallback(() => {
    setFilter({ order: filters.order === 'asc' ? 'desc' : 'asc' })
    if (repoId) fetchRepoTasks(repoId)
  }, [setFilter, filters.order, fetchRepoTasks, repoId])

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div>
          {repository ? (
            <>
              <h1 className="text-lg font-semibold">{repository.name}</h1>
              <p className="text-xs text-muted-foreground">{repository.fullName}</p>
            </>
          ) : (
            <>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-1 h-4 w-56" />
            </>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New Task
        </button>
      </div>

      <div className="border-b px-6 py-3">
        <TaskFilterBar
          stageFilter={filters.stage}
          sort={filters.sort}
          order={filters.order}
          onStageChange={handleStageChange}
          onSortChange={handleSortChange}
          onOrderToggle={handleOrderToggle}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && tasks.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[140px] rounded-lg" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No tasks found</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tasks.map((task) => (
              <RepoTaskCard key={task.id} task={task} repoId={repoId!} />
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateTaskDialog onClose={() => setShowCreate(false)} />}
    </div>
  )
}
