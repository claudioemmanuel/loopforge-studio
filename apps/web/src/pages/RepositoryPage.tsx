import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useRepositoryStore } from '../store/repository.store'
import { RepoTaskListItem } from '../components/repository/RepoTaskListItem'
import { TaskFilterBar } from '../components/repository/TaskFilterBar'
import { CreateTaskDialog } from '../components/board/CreateTaskDialog'
import { Plus, Inbox } from 'lucide-react'
import { Skeleton } from '../components/ui/skeleton'
import { Breadcrumb } from '../components/layout/Breadcrumb'
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
    <div className="flex h-full flex-col">
      <div className="page-header">
        <Breadcrumb />
        <div className="mt-2 flex items-center justify-between">
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
            className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
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

      <div className="flex-1 overflow-y-auto">
        {isLoading && tasks.length === 0 ? (
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-5 px-6 py-3.5">
                <div>
                  <Skeleton className="h-4 w-[60%]" />
                  <Skeleton className="mt-1.5 h-3 w-[80%]" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-24 rounded" />
                  <Skeleton className="h-2 w-16" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-[140px]" />
                </div>
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No tasks found</p>
          </div>
        ) : (
          <div className="divide-y">
            {tasks.map((task) => (
              <RepoTaskListItem key={task.id} task={task} repoId={repoId!} />
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateTaskDialog onClose={() => setShowCreate(false)} />}
    </div>
  )
}
