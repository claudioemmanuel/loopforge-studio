import { ChevronLeft, ChevronRight } from 'lucide-react'
import { STAGE_CONFIG, STAGE_ORDER } from './stage-config'
import type { Stage } from '@loopforge/shared'

interface StagePanelFooterProps {
  currentStage: Stage
  onNavigate: (direction: 'prev' | 'next') => void
}

export function StagePanelFooter({ currentStage, onNavigate }: StagePanelFooterProps) {
  const idx = STAGE_ORDER.indexOf(currentStage)
  const hasPrev = idx > 0
  const hasNext = idx < STAGE_ORDER.length - 1 && idx !== -1

  const prevStage = hasPrev ? STAGE_ORDER[idx - 1] : null
  const nextStage = hasNext ? STAGE_ORDER[idx + 1] : null

  return (
    <div className="flex items-center justify-between border-t px-4 py-2">
      <button
        disabled={!hasPrev}
        onClick={() => onNavigate('prev')}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {prevStage && STAGE_CONFIG[prevStage].label}
      </button>
      <button
        disabled={!hasNext}
        onClick={() => onNavigate('next')}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {nextStage && STAGE_CONFIG[nextStage].label}
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
