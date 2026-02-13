import type { PlanStep as PlanStepType } from '@loopforge/shared'

interface PlanStepProps {
  step: PlanStepType
}

export function PlanStep({ step }: PlanStepProps) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {step.stepNumber}
      </div>
      <div className="flex-1 pb-4">
        <p className="text-sm font-medium">{step.description}</p>
        {step.estimatedChanges && (
          <p className="mt-1 text-xs text-muted-foreground">{step.estimatedChanges}</p>
        )}
      </div>
    </div>
  )
}
