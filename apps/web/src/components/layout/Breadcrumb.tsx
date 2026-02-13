import { Link, useParams, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { useRepositoryStore } from '../../store/repository.store'
import { useTaskFlowStore } from '../../store/taskflow.store'

interface BreadcrumbSegment {
  label: string
  to: string
  icon?: typeof Home
}

export function Breadcrumb() {
  const { repoId, taskId } = useParams()
  const { pathname } = useLocation()
  const { repository } = useRepositoryStore()
  const { flowData } = useTaskFlowStore()

  const segments: BreadcrumbSegment[] = []

  // Always start with dashboard
  segments.push({ label: 'Projects', to: '/', icon: Home })

  // Repository level
  if (repoId) {
    const repoName = repository?.name ?? 'Repository'
    segments.push({ label: repoName, to: `/repo/${repoId}` })
  }

  // Task level
  if (taskId && repoId) {
    const taskTitle = flowData?.task.title ?? 'Task'
    segments.push({ label: taskTitle, to: `/repo/${repoId}/task/${taskId}` })
  }

  // Stage level (from URL)
  if (pathname.includes('/stage/')) {
    const stageMatch = pathname.match(/\/stage\/([A-Z_]+)/)
    if (stageMatch) {
      segments.push({ label: stageMatch[1].replace(/_/g, ' '), to: pathname })
    }
  }

  return (
    <nav className="flex items-center gap-1 text-sm">
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1
        const Icon = segment.icon

        return (
          <div key={segment.to} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
            {isLast ? (
              <span className="flex items-center gap-1 font-medium text-foreground truncate max-w-[200px]">
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {segment.label}
              </span>
            ) : (
              <Link
                to={segment.to}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors truncate max-w-[150px]"
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {segment.label}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}
