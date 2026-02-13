import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { FolderGit2 } from 'lucide-react'
import type { RepositoryDashboardTile } from '@loopforge/shared'
import { StageDistributionBar } from './StageDistributionBar'

interface RepoListRowProps {
  tile: RepositoryDashboardTile
}

export function RepoListRow({ tile }: RepoListRowProps) {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate(`/repo/${tile.id}`)}
      className="group flex items-center gap-4 px-6 py-3.5 cursor-pointer transition-colors hover:bg-muted/30"
    >
      {/* Left: icon + name + health + owner */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <FolderGit2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
              {tile.name}
            </span>
            <span className={`h-2 w-2 rounded-full shrink-0 ${
              tile.health === 'green' ? 'bg-green-500' :
              tile.health === 'yellow' ? 'bg-amber-500' :
              'bg-red-500'
            }`} />
          </div>
          <p className="text-xs text-muted-foreground truncate">{tile.owner}</p>
        </div>
      </div>

      {/* Middle: compact stage distribution */}
      <div className="hidden sm:block w-32 shrink-0">
        <StageDistributionBar
          distribution={tile.stageDistribution}
          total={tile.totalTasks}
        />
      </div>

      {/* Right: task stats inline + timestamp */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
        <span className="tabular-nums" title="Total tasks">{tile.totalTasks} tasks</span>
        <span className="tabular-nums text-teal-600 dark:text-teal-400" title="Active">{tile.activeTasks} active</span>
        <span className="tabular-nums text-green-600 dark:text-green-400" title="Done">{tile.completedTasks} done</span>
        {tile.recentActivity && (
          <span className="w-[100px] text-right text-muted-foreground/70 hidden md:block">
            {formatDistanceToNow(new Date(tile.recentActivity), { addSuffix: true })}
          </span>
        )}
      </div>
    </div>
  )
}
