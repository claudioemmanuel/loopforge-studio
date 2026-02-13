import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import { CheckCircle2 } from 'lucide-react'
import { STAGE_CONFIG } from './stage-config'
import type { Stage } from '@loopforge/shared'
import type { StageNodeData } from '@loopforge/shared'
import { formatDistanceToNow } from 'date-fns'

export type StageNodeType = Node<{
  stageData: StageNodeData
  stats: Record<string, unknown>
  onClick: (stage: Stage) => void
}, 'stage'>

function StageNodeComponent({ data }: NodeProps<StageNodeType>) {
  const { stageData, stats, onClick } = data
  const config = STAGE_CONFIG[stageData.stage]
  const Icon = config.icon

  return (
    <div
      className={`w-[200px] rounded-md border bg-card cursor-pointer transition-shadow hover:shadow-md ${
        stageData.status === 'active' ? config.borderColor : 'border-border'
      }`}
      onClick={() => onClick(stageData.stage)}
    >
      {/* Thin color top border */}
      <div className={`h-[3px] rounded-t-md ${config.color}`} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Icon className={`h-4 w-4 ${config.textColor}`} />
        <span className="text-sm font-medium">{config.label}</span>
      </div>

      {/* Body */}
      <div className="px-3 pb-3 space-y-2">
        {/* Status indicator */}
        <div className="flex items-center gap-1.5">
          {stageData.status === 'completed' && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400">Completed</span>
            </>
          )}
          {stageData.status === 'active' && (
            <>
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              <span className="text-xs text-primary font-medium">Active</span>
            </>
          )}
          {stageData.status === 'pending' && (
            <>
              <span className="h-2.5 w-2.5 rounded-full border-2 border-muted-foreground/30" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </>
          )}
        </div>

        {/* Stage-specific content */}
        <StageDetails stage={stageData.stage} status={stageData.status} stats={stats} />

        {/* Timestamp */}
        {stageData.enteredAt && (
          <p className="text-[10px] text-muted-foreground border-t pt-1.5">
            {formatDistanceToNow(new Date(stageData.enteredAt), { addSuffix: true })}
          </p>
        )}
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-muted-foreground/40" />
    </div>
  )
}

function StageDetails({
  stage,
  status,
  stats,
}: {
  stage: Stage
  status: string
  stats: Record<string, unknown>
}) {
  const chatCount = (stats.chatMessageCount as number) ?? 0
  const logCount = (stats.executionLogCount as number) ?? 0
  const commitCount = (stats.commitCount as number) ?? 0
  const planStepCount = (stats.planStepCount as number) ?? 0
  const planStatus = stats.executionPlanStatus as string | null

  if (status === 'pending') {
    return <p className="text-xs text-muted-foreground italic">Not started</p>
  }

  switch (stage) {
    case 'TODO':
      return <p className="text-xs text-muted-foreground">Task created</p>
    case 'BRAINSTORMING':
      return (
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">{chatCount} message{chatCount !== 1 ? 's' : ''}</p>
        </div>
      )
    case 'PLANNING':
      return (
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">{planStepCount} step{planStepCount !== 1 ? 's' : ''}</p>
          {planStatus && (
            <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
              planStatus === 'APPROVED' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
              planStatus === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
              'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
            }`}>
              {planStatus === 'PENDING_REVIEW' ? 'Review' : planStatus}
            </span>
          )}
        </div>
      )
    case 'READY':
      return <p className="text-xs text-muted-foreground">Queued for execution</p>
    case 'EXECUTING':
      return (
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">{logCount} log entr{logCount !== 1 ? 'ies' : 'y'}</p>
          {commitCount > 0 && (
            <p className="text-xs text-muted-foreground">{commitCount} commit{commitCount !== 1 ? 's' : ''}</p>
          )}
        </div>
      )
    case 'CODE_REVIEW':
      return (
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">PR review</p>
        </div>
      )
    case 'DONE':
      return (
        <div className="space-y-0.5">
          <p className="text-xs text-green-600 dark:text-green-400 font-medium">{commitCount} commit{commitCount !== 1 ? 's' : ''}</p>
        </div>
      )
    case 'STUCK':
      return <p className="text-xs text-red-600 dark:text-red-400">Needs attention</p>
    default:
      return null
  }
}

export const StageNode = memo(StageNodeComponent)
