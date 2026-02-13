import { useEffect } from 'react'
import { useDashboardStore } from '../store/dashboard.store'
import { RepoListRow } from '../components/dashboard/RepoListRow'
import { DashboardSkeleton } from '../components/skeletons/DashboardSkeleton'
import { FolderGit2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Breadcrumb } from '../components/layout/Breadcrumb'

export function DashboardPage() {
  const { tiles, isLoading, fetchDashboard } = useDashboardStore()
  const navigate = useNavigate()

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  if (isLoading && tiles.length === 0) {
    return <DashboardSkeleton />
  }

  if (tiles.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <FolderGit2 className="h-12 w-12 text-muted-foreground/50" />
        <div>
          <h2 className="text-lg font-semibold">No repositories connected</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect a repository in Settings to get started.
          </p>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Go to Settings
        </button>
      </div>
    )
  }

  return (
    <div className="h-full">
      <div className="page-header">
        <Breadcrumb />
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Projects</h1>
            <p className="text-sm text-muted-foreground">
              {tiles.length} connected repositor{tiles.length === 1 ? 'y' : 'ies'}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y">
        {tiles.map((tile) => (
          <RepoListRow key={tile.id} tile={tile} />
        ))}
      </div>
    </div>
  )
}
