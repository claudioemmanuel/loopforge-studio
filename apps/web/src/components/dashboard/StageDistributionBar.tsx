import { Stage } from '@loopforge/shared'
import { STAGE_CONFIG, STAGE_ORDER } from '../flow/stage-config'

interface StageDistributionBarProps {
  distribution: Record<Stage, number>
  total: number
}

export function StageDistributionBar({ distribution, total }: StageDistributionBarProps) {
  if (total === 0) {
    return (
      <div className="h-2 w-full rounded-full bg-muted" />
    )
  }

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      {[...STAGE_ORDER, Stage.STUCK].map((stage) => {
        const count = distribution[stage] ?? 0
        if (count === 0) return null
        const width = (count / total) * 100
        return (
          <div
            key={stage}
            className={`${STAGE_CONFIG[stage].color} transition-all`}
            style={{ width: `${width}%` }}
            title={`${STAGE_CONFIG[stage].label}: ${count}`}
          />
        )
      })}
    </div>
  )
}
