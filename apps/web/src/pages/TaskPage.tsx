import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBoardStore } from '../store/board.store'
import { Stage } from '@loopforge/shared'
import { BrainstormingPanel } from '../components/chat/BrainstormingPanel'
import { PlanReviewPanel } from '../components/plan/PlanReviewPanel'
import { ExecutionLogPanel } from '../components/logs/ExecutionLogPanel'
import { StuckPanel } from '../components/logs/StuckPanel'
import { CodeReviewPanel } from '../components/review/CodeReviewPanel'
import { TaskTimeline } from '../components/task/TaskTimeline'
import { ArrowLeft, History } from 'lucide-react'

export function TaskPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tasks, fetchTasks } = useBoardStore()
  const [showTimeline, setShowTimeline] = useState(true)

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const task = tasks.find((t) => t.id === id)

  if (!task) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="rounded-md p-1 hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {task.stage}
            </p>
            <h1 className="text-base font-semibold">{task.title}</h1>
          </div>
        </div>
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className="rounded-md p-2 hover:bg-muted md:hidden"
          title="Toggle timeline"
        >
          <History className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {task.stage === Stage.BRAINSTORMING && <BrainstormingPanel task={task} />}
          {task.stage === Stage.PLANNING && <PlanReviewPanel task={task} />}
          {task.stage === Stage.CODE_REVIEW && <CodeReviewPanel task={task} />}
          {(task.stage === Stage.READY || task.stage === Stage.EXECUTING || task.stage === Stage.DONE) && (
            <div className="flex h-full flex-col">
              {task.stage === Stage.READY && (
                <div className="mx-auto w-full max-w-3xl px-4 pt-4">
                  <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
                    Your plan is approved and queued for execution. No action needed — the worker will
                    start automatically.
                  </p>
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <ExecutionLogPanel task={task} />
              </div>
            </div>
          )}
          {task.stage === Stage.STUCK && <StuckPanel task={task} />}
          {task.stage === Stage.TODO && (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <p className="w-full max-w-3xl text-muted-foreground">{task.description}</p>
              <button
                onClick={async () => {
                  const { transitionTaskStage } = useBoardStore.getState()
                  await transitionTaskStage(task.id, Stage.BRAINSTORMING)
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Start Brainstorming
              </button>
            </div>
          )}
        </div>

        {/* Timeline sidebar - hidden on mobile unless toggled, always visible on desktop */}
        {showTimeline && (
          <div className="absolute right-0 top-0 bottom-0 md:relative md:flex">
            <TaskTimeline taskId={task.id} />
          </div>
        )}
      </div>
    </div>
  )
}
