import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { GitBranch, MessageSquare, AlertTriangle } from 'lucide-react'
import type { TaskListItem } from '@loopforge/shared'
import { STAGE_CONFIG } from '../flow/stage-config'
import { StageProgressDots } from './StageProgressDots'

interface RepoTaskCardProps {
  task: TaskListItem
  repoId: string
}

export function RepoTaskCard({ task, repoId }: RepoTaskCardProps) {
  const navigate = useNavigate()
  const stageConfig = STAGE_CONFIG[task.stage]
  const StageIcon = stageConfig.icon

  return (
    <div
      onClick={() => navigate(`/repo/${repoId}/task/${task.id}`)}
      className="group cursor-pointer rounded-lg border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold truncate">{task.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        </div>

        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${stageConfig.bgColor} ${stageConfig.textColor}`}>
          <StageIcon className="h-3 w-3" />
          {stageConfig.label}
        </span>
      </div>

      <div className="mt-3">
        <StageProgressDots currentStage={task.stage} />
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        {task.chatMessageCount > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {task.chatMessageCount}
          </span>
        )}
        {task.featureBranch && (
          <span className="flex items-center gap-1 truncate">
            <GitBranch className="h-3 w-3" />
            <span className="truncate">{task.featureBranch}</span>
          </span>
        )}
        {task.stage === 'STUCK' && (
          <span className="flex items-center gap-1 text-red-500">
            <AlertTriangle className="h-3 w-3" />
            Blocked
          </span>
        )}
        <span className="ml-auto flex-shrink-0">
          {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
        </span>
      </div>
    </div>
  )
}
