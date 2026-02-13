import { useMemo } from 'react'
import { Stage } from '@loopforge/shared'
import type { TaskFlowData } from '@loopforge/shared'
import type { Node, Edge } from '@xyflow/react'
import { STAGE_ORDER } from './stage-config'

// Vertical layout (top to bottom): TODO at top (lower y), DONE at bottom (higher y)
const Y_SPACING = 280
const PRIMARY_X = 200
const STUCK_X = 520
const START_Y = 0 // Starting Y for TODO (top)

export function useFlowLayout(flowData: TaskFlowData | null) {
  return useMemo(() => {
    if (!flowData) return { nodes: [], edges: [] }

    const nodes: Node[] = []
    const edges: Edge[] = []

    // Find current stage index to determine which stages to show
    const currentStageIdx = STAGE_ORDER.indexOf(flowData.task.stage)

    // Check if STUCK was visited
    const visitedStuck = flowData.transitions.some(
      (t) => t.from === Stage.STUCK || t.to === Stage.STUCK,
    ) || flowData.task.stage === Stage.STUCK

    // Position primary stages top-to-bottom (vertically) - show all stages up to current
    STAGE_ORDER.forEach((stage, i) => {
      const stageData = flowData.stages.find((s) => s.stage === stage)
      if (!stageData) return

      // Show all stages up to and including current stage
      if (i <= currentStageIdx) {
        nodes.push({
          id: stage,
          type: 'stage',
          position: { x: PRIMARY_X, y: START_Y + i * Y_SPACING },
          data: {
            stageData,
            stats: flowData.stats,
            onClick: () => {},
          },
        })
      }
    })

    // Position STUCK to the right of EXECUTING - only if visited
    const stuckData = flowData.stages.find((s) => s.stage === Stage.STUCK)
    if (stuckData && visitedStuck) {
      const executingIdx = STAGE_ORDER.indexOf(Stage.EXECUTING)
      nodes.push({
        id: Stage.STUCK,
        type: 'stage',
        position: { x: STUCK_X, y: START_Y + executingIdx * Y_SPACING },
        data: {
          stageData: stuckData,
          stats: flowData.stats,
          onClick: () => {},
        },
      })
    }

    // Forward edges between consecutive primary stages
    for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
      let edgeStatus: 'completed' | 'active' | 'pending' = 'pending'

      if (i < currentStageIdx) {
        edgeStatus = 'completed'
      } else if (i === currentStageIdx) {
        edgeStatus = 'active'
      }

      edges.push({
        id: `${STAGE_ORDER[i]}-${STAGE_ORDER[i + 1]}`,
        source: STAGE_ORDER[i],
        target: STAGE_ORDER[i + 1],
        type: 'stage',
        data: {
          status: edgeStatus,
          direction: 'forward',
        },
      })
    }

    // Edge from EXECUTING to STUCK
    const isStuck = flowData.task.stage === Stage.STUCK
    edges.push({
      id: `${Stage.EXECUTING}-${Stage.STUCK}`,
      source: Stage.EXECUTING,
      target: Stage.STUCK,
      type: 'stage',
      data: {
        status: isStuck ? 'active' : 'pending',
        direction: 'forward',
      },
    })

    // Backward edges from transition history
    for (const transition of flowData.transitions) {
      if (transition.direction === 'backward') {
        const edgeId = `backward-${transition.from}-${transition.to}-${transition.timestamp}`
        // Don't duplicate existing forward edges
        if (!edges.some((e) => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: transition.from,
            target: transition.to,
            type: 'stage',
            data: {
              status: 'completed',
              direction: 'backward',
            },
          })
        }
      }
    }

    return { nodes, edges }
  }, [flowData])
}
