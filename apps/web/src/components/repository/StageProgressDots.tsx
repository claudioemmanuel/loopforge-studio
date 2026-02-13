import { Stage } from '@loopforge/shared'
import { STAGE_CONFIG, STAGE_ORDER } from '../flow/stage-config'

interface StageProgressDotsProps {
  currentStage: Stage
}

export function StageProgressDots({ currentStage }: StageProgressDotsProps) {
  const currentIdx = STAGE_ORDER.indexOf(currentStage)
  const isStuck = currentStage === Stage.STUCK

  return (
    <div className="flex items-center gap-0.5">
      {STAGE_ORDER.map((stage, i) => {
        const config = STAGE_CONFIG[stage]
        let bgClass: string

        if (isStuck) {
          bgClass = 'bg-red-400'
        } else if (i < currentIdx) {
          bgClass = 'bg-green-500'
        } else if (i === currentIdx) {
          bgClass = config.color
        } else {
          bgClass = 'bg-muted-foreground/20'
        }

        return (
          <div
            key={stage}
            className={`h-1.5 w-3 first:rounded-l last:rounded-r ${bgClass}`}
            title={config.label}
          />
        )
      })}
    </div>
  )
}
