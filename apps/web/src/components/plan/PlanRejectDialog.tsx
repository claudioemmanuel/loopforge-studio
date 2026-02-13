import { useState } from 'react'
import { X } from 'lucide-react'

interface PlanRejectDialogProps {
  onConfirm: (feedback: string) => void
  onCancel: () => void
}

export function PlanRejectDialog({ onConfirm, onCancel }: PlanRejectDialogProps) {
  const [feedback, setFeedback] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Request Changes</h2>
          <button onClick={onCancel} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Describe what should be changed. The AI will use your feedback in the next brainstorming session.
        </p>

        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="e.g. Please add error handling for edge cases, and split the auth logic into a separate service…"
          rows={4}
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(feedback.trim())}
            disabled={!feedback.trim()}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
          >
            Reject Plan
          </button>
        </div>
      </div>
    </div>
  )
}
