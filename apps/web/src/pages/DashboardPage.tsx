import { useEffect } from 'react'
import { useDashboardStore } from '../store/dashboard.store'
import { RepoTile } from '../components/dashboard/RepoTile'
import { DashboardSkeleton } from '../components/skeletons/DashboardSkeleton'
import { FolderGit2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

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
      <div className="flex h-[calc(100vh-57px)] flex-col items-center justify-center gap-4 p-8 text-center">
        <FolderGit2 className="h-12 w-12 text-muted-foreground/50" />
        <div>
          <h2 className="text-lg font-semibold">No repositories connected</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect a repository in Settings to get started.
          </p>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Go to Settings
        </button>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Repositories</h1>
        <p className="text-sm text-muted-foreground">
          {tiles.length} connected repositor{tiles.length === 1 ? 'y' : 'ies'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <RepoTile key={tile.id} tile={tile} />
        ))}
      </div>
    </div>
  )
}
