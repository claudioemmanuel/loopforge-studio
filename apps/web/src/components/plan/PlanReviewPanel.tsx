import { useEffect, useState } from 'react'
import type { Task, ExecutionPlan } from '@loopforge/shared'
import { apiClient } from '../../services/api.client'
import { useBoardStore } from '../../store/board.store'
import { PlanStep } from './PlanStep'
import { PlanRejectDialog } from './PlanRejectDialog'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

interface PlanReviewPanelProps {
  task: Task
}

export function PlanReviewPanel({ task }: PlanReviewPanelProps) {
  const [plan, setPlan] = useState<ExecutionPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showReject, setShowReject] = useState(false)
  const [isActing, setIsActing] = useState(false)
  const { fetchTasks } = useBoardStore()

  useEffect(() => {
    apiClient
      .get<ExecutionPlan>(`/tasks/${task.id}/plan`)
      .then(setPlan)
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [task.id])

  const handleApprove = async () => {
    setIsActing(true)
    try {
      await apiClient.post(`/tasks/${task.id}/plan/approve`)
      await fetchTasks()
    } finally {
      setIsActing(false)
    }
  }

  const handleReject = async (feedback: string) => {
    setIsActing(true)
    try {
      await apiClient.post(`/tasks/${task.id}/plan/reject`, { feedback })
      setShowReject(false)
      await fetchTasks()
    } finally {
      setIsActing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No plan available yet.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="mb-1 text-base font-semibold">Execution Plan</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Review the AI-generated plan. Approve to begin execution, or request changes.
        </p>

        <div className="space-y-1">
          {plan.steps.map((step) => (
            <PlanStep key={step.stepNumber} step={step} />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t p-4">
        <button
          onClick={() => setShowReject(true)}
          disabled={isActing}
          className="flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          <XCircle className="h-4 w-4 text-destructive" />
          Request Changes
        </button>
        <button
          onClick={handleApprove}
          disabled={isActing}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isActing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Approve Plan
        </button>
      </div>

      {showReject && (
        <PlanRejectDialog
          onConfirm={handleReject}
          onCancel={() => setShowReject(false)}
        />
      )}
    </div>
  )
}
