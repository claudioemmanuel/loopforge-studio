import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { GitBranch } from 'lucide-react'
import type { RepositoryDashboardTile } from '@loopforge/shared'
import { StageDistributionBar } from './StageDistributionBar'

interface RepoTileProps {
  tile: RepositoryDashboardTile
}

export function RepoTile({ tile }: RepoTileProps) {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate(`/repo/${tile.id}`)}
      className="group cursor-pointer rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold">{tile.name}</h3>
            <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
              tile.health === 'green' ? 'bg-green-500' :
              tile.health === 'yellow' ? 'bg-yellow-500' :
              'bg-red-500'
            }`} />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{tile.owner}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          <span>{tile.defaultBranch}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-muted/50 px-2 py-1.5">
          <p className="text-lg font-bold">{tile.totalTasks}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-2 py-1.5">
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{tile.activeTasks}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-2 py-1.5">
          <p className="text-lg font-bold text-green-600 dark:text-green-400">{tile.completedTasks}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Done</p>
        </div>
      </div>

      <div className="mt-4">
        <StageDistributionBar
          distribution={tile.stageDistribution}
          total={tile.totalTasks}
        />
      </div>

      {tile.recentActivity && (
        <p className="mt-3 text-xs text-muted-foreground">
          Updated {formatDistanceToNow(new Date(tile.recentActivity), { addSuffix: true })}
        </p>
      )}
    </div>
  )
}
