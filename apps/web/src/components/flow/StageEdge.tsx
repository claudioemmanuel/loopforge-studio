import { memo } from 'react'
import { BaseEdge, getBezierPath } from '@xyflow/react'
import type { EdgeProps, Edge } from '@xyflow/react'

export type StageEdgeType = Edge<{
  status: 'completed' | 'active' | 'pending'
  direction: 'forward' | 'backward'
}, 'stage'>

function StageEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<StageEdgeType>) {
  const status = data?.status ?? 'pending'
  const direction = data?.direction ?? 'forward'

  const isBackward = direction === 'backward'

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: isBackward ? 1.5 : 0.25,
  })

  let stroke: string
  let strokeDasharray: string | undefined
  let animation: string | undefined

  switch (status) {
    case 'completed':
      stroke = '#22c55e'
      break
    case 'active':
      stroke = '#14b8a6'
      strokeDasharray = '5 5'
      animation = 'dash 1s linear infinite'
      break
    case 'pending':
    default:
      stroke = '#9ca3af'
      break
  }

  if (isBackward) {
    stroke = '#ef4444'
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke,
          strokeWidth: isBackward ? 1.5 : 2,
          strokeDasharray,
          animation,
        }}
      />
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -10;
          }
        }
      `}</style>
    </>
  )
}

export const StageEdge = memo(StageEdgeComponent)
