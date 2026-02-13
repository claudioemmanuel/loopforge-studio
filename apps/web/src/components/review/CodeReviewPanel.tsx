import { ExternalLink } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Stage, type Task } from '@loopforge/shared'
import { useBoardStore } from '../../store/board.store'
import { toast } from 'sonner'

export function CodeReviewPanel({ task }: { task: Task }) {
  const { transitionTaskStage } = useBoardStore()

  const handleApproveAndMerge = async () => {
    try {
      await transitionTaskStage(task.id, Stage.DONE)
      toast.success('PR approved and merged', {
        description: 'Task moved to Done',
      })
    } catch (error) {
      toast.error('Failed to approve PR', {
        description: (error as Error).message,
      })
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Code Review</h2>
        {task.autonomousMode && (
          <Badge variant="default" className="bg-blue-600">
            Autonomous Mode: ON
          </Badge>
        )}
      </div>

      {task.pullRequestUrl ? (
        <div className="space-y-4">
          <a
            href={task.pullRequestUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline"
          >
            View Pull Request <ExternalLink className="h-4 w-4" />
          </a>

          {task.autonomousMode ? (
            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-medium">Autonomous Mode Enabled</p>
              <p className="mt-1 text-blue-700">
                This PR will be automatically merged once CI checks pass. No manual action required.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Review the changes in the pull request. Once you're satisfied, approve and merge manually.
              </p>
              <Button onClick={handleApproveAndMerge} variant="default">
                Approve & Merge
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Pull request is being created...</p>
      )}
    </div>
  )
}
