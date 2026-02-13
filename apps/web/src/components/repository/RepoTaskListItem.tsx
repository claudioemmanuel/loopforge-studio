import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { GitBranch, MessageSquare, AlertTriangle, Clock } from 'lucide-react'
import type { TaskListItem } from '@loopforge/shared'
import { STAGE_CONFIG } from '../flow/stage-config'
import { StageProgressDots } from './StageProgressDots'

interface RepoTaskListItemProps {
  task: TaskListItem
  repoId: string
}

export function RepoTaskListItem({ task, repoId }: RepoTaskListItemProps) {
  const navigate = useNavigate()
  const stageConfig = STAGE_CONFIG[task.stage]
  const StageIcon = stageConfig.icon

  return (
    <div
      onClick={() => navigate(`/repo/${repoId}/task/${task.id}`)}
      className="group grid grid-cols-[1fr_auto_auto] items-center gap-x-5 border-b px-6 py-3.5 cursor-pointer transition-colors hover:bg-muted/30"
    >
      {/* Column 1: Title + Description */}
      <div className="min-w-0">
        <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
          {task.title}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground truncate">{task.description}</p>
      </div>

      {/* Column 2: Stage Badge + Progress Dots */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${stageConfig.bgColor} ${stageConfig.textColor}`}
        >
          <StageIcon className="h-3.5 w-3.5" />
          {stageConfig.label}
        </span>
        <StageProgressDots currentStage={task.stage} />
      </div>

      {/* Column 3: Metadata (branch, messages, timestamp) */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
        {task.chatMessageCount > 0 && (
          <span className="flex items-center gap-1" title={`${task.chatMessageCount} messages`}>
            <MessageSquare className="h-3.5 w-3.5" />
            {task.chatMessageCount}
          </span>
        )}
        {task.featureBranch && (
          <span className="flex items-center gap-1 max-w-[280px]" title={task.featureBranch}>
            <GitBranch className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate font-mono text-[11px]">{task.featureBranch}</span>
          </span>
        )}
        {task.stage === 'STUCK' && (
          <span className="flex items-center gap-1 text-red-500 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            Blocked
          </span>
        )}
        <span className="flex items-center gap-1 w-[140px] justify-end whitespace-nowrap text-muted-foreground/70">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
        </span>
      </div>
    </div>
  )
}
