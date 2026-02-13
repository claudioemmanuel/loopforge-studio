import { Stage } from '@loopforge/shared'
import type { Task } from '@loopforge/shared'
import { BrainstormingPanel } from '../chat/BrainstormingPanel'
import { PlanReviewPanel } from '../plan/PlanReviewPanel'
import { ExecutionLogPanel } from '../logs/ExecutionLogPanel'
import { CodeReviewPanel } from '../review/CodeReviewPanel'
import { StuckPanel } from '../logs/StuckPanel'
import { useBoardStore } from '../../store/board.store'

interface StageContentProps {
  task: Task
  stage: Stage
}

export function StageContent({ task, stage }: StageContentProps) {
  switch (stage) {
    case Stage.TODO:
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-sm text-muted-foreground">{task.description}</p>
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
      )

    case Stage.BRAINSTORMING:
      return <BrainstormingPanel task={task} />

    case Stage.PLANNING:
      return <PlanReviewPanel task={task} />

    case Stage.READY:
      return (
        <div className="flex h-full flex-col">
          <div className="px-4 pt-4">
            <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
              Your plan is approved and queued for execution. No action needed — the worker will
              start automatically.
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <ExecutionLogPanel task={task} />
          </div>
        </div>
      )

    case Stage.EXECUTING:
    case Stage.DONE:
      return <ExecutionLogPanel task={task} />

    case Stage.CODE_REVIEW:
      return <CodeReviewPanel task={task} />

    case Stage.STUCK:
      return <StuckPanel task={task} />

    default:
      return <p className="p-4 text-sm text-muted-foreground">No content for this stage.</p>
  }
}
