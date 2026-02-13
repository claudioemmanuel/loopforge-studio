import { useEffect, useState } from 'react'
import { apiClient } from '../../services/api.client'
import {
  CheckCircle2,
  Circle,
  XCircle,
  GitCommit,
  MessageSquare,
  Activity,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface TimelineEntry {
  type: 'analytics' | 'log' | 'commit'
  timestamp: string
  eventType?: string
  level?: string
  message: string
  metadata?: Record<string, unknown>
}

interface TaskTimelineProps {
  taskId: string
}

const getIconForEntry = (entry: TimelineEntry) => {
  if (entry.type === 'commit') {
    return <GitCommit className="h-4 w-4 text-blue-500" />
  }

  if (entry.type === 'log') {
    switch (entry.level) {
      case 'ERROR':
        return <XCircle className="h-4 w-4 text-destructive" />
      case 'INFO':
        return <Circle className="h-4 w-4 text-muted-foreground" />
      case 'ACTION':
        return <Activity className="h-4 w-4 text-primary" />
      case 'COMMIT':
        return <GitCommit className="h-4 w-4 text-green-500" />
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />
    }
  }

  // Analytics events
  switch (entry.eventType) {
    case 'TASK_CREATED':
      return <Circle className="h-4 w-4 text-muted-foreground" />
    case 'STAGE_CHANGED':
      return <Activity className="h-4 w-4 text-primary" />
    case 'PLAN_APPROVED':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'PLAN_REJECTED':
      return <XCircle className="h-4 w-4 text-destructive" />
    case 'EXECUTION_STARTED':
      return <Activity className="h-4 w-4 text-blue-500" />
    case 'EXECUTION_COMPLETED':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'STUCK_DETECTED':
      return <XCircle className="h-4 w-4 text-destructive" />
    case 'COMMIT_PUSHED':
      return <GitCommit className="h-4 w-4 text-green-500" />
    default:
      return <MessageSquare className="h-4 w-4 text-muted-foreground" />
  }
}

export function TaskTimeline({ taskId }: TaskTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set())

  useEffect(() => {
    const fetchTimeline = async () => {
      setIsLoading(true)
      try {
        const data = await apiClient.get<TimelineEntry[]>(`/tasks/${taskId}/timeline`)
        setTimeline(data)
      } catch (err) {
        console.error('Failed to fetch timeline:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTimeline()
  }, [taskId])

  const toggleExpanded = (index: number) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="w-full border-l border-border bg-muted/10 md:w-96">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-bold">Timeline</h2>
        </div>
        <div className="p-4 text-sm text-muted-foreground">Loading timeline...</div>
      </div>
    )
  }

  if (timeline.length === 0) {
    return (
      <div className="w-full border-l border-border bg-muted/10 md:w-96">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-bold">Timeline</h2>
        </div>
        <div className="p-4 text-sm text-muted-foreground">No timeline events yet</div>
      </div>
    )
  }

  return (
    <div className="w-full border-l border-border bg-muted/10 md:w-96 overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur p-4">
        <h2 className="text-lg font-bold">Timeline</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{timeline.length} events</p>
      </div>

      <div className="p-4 space-y-4">
        {timeline.map((entry, index) => {
          const isExpanded = expandedEntries.has(index)
          const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0

          return (
            <div key={index} className="flex gap-3">
              {/* Icon */}
              <div className="shrink-0 mt-0.5">{getIconForEntry(entry)}</div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{entry.message}</p>
                  {hasMetadata && (
                    <button
                      onClick={() => toggleExpanded(index)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                </p>

                {/* Expanded metadata */}
                {isExpanded && hasMetadata && (
                  <div className="mt-2 rounded-md bg-muted p-2 text-xs font-mono">
                    {Object.entries(entry.metadata!).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="break-all">{JSON.stringify(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
