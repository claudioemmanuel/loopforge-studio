import { Stage } from '@loopforge/shared'
import { STAGE_CONFIG, STAGE_ORDER } from '../flow/stage-config'
import { ArrowUpDown } from 'lucide-react'

interface TaskFilterBarProps {
  stageFilter: Stage | null
  sort: string
  order: 'asc' | 'desc'
  onStageChange: (stage: Stage | null) => void
  onSortChange: (sort: string) => void
  onOrderToggle: () => void
}

export function TaskFilterBar({
  stageFilter,
  sort,
  order,
  onStageChange,
  onSortChange,
  onOrderToggle,
}: TaskFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => onStageChange(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            stageFilter === null
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          All
        </button>
        {[...STAGE_ORDER, Stage.STUCK].map((stage) => {
          const config = STAGE_CONFIG[stage]
          return (
            <button
              key={stage}
              onClick={() => onStageChange(stage)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                stageFilter === stage
                  ? `${config.bgColor} ${config.textColor}`
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {config.label}
            </button>
          )
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-xs outline-none"
        >
          <option value="createdAt">Created</option>
          <option value="updatedAt">Updated</option>
          <option value="title">Title</option>
        </select>

        <button
          onClick={onOrderToggle}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          title={order === 'asc' ? 'Ascending' : 'Descending'}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
