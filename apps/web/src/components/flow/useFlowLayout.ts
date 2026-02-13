import { useMemo } from 'react'
import { Stage } from '@loopforge/shared'
import type { TaskFlowData } from '@loopforge/shared'
import type { Node, Edge } from '@xyflow/react'
import { STAGE_ORDER } from './stage-config'

const X_SPACING = 280
const PRIMARY_Y = 200
const STUCK_Y = 450
const START_X = 50

export function useFlowLayout(flowData: TaskFlowData | null) {
  return useMemo(() => {
    if (!flowData) return { nodes: [], edges: [] }

    const nodes: Node[] = []
    const edges: Edge[] = []

    // Position primary stages left-to-right
    STAGE_ORDER.forEach((stage, i) => {
      const stageData = flowData.stages.find((s) => s.stage === stage)
      if (!stageData) return

      nodes.push({
        id: stage,
        type: 'stage',
        position: { x: START_X + i * X_SPACING, y: PRIMARY_Y },
        data: {
          stageData,
          stats: flowData.stats,
          onClick: () => {},
        },
      })
    })

    // Position STUCK below EXECUTING
    const stuckData = flowData.stages.find((s) => s.stage === Stage.STUCK)
    if (stuckData) {
      const executingIdx = STAGE_ORDER.indexOf(Stage.EXECUTING)
      nodes.push({
        id: Stage.STUCK,
        type: 'stage',
        position: { x: START_X + executingIdx * X_SPACING, y: STUCK_Y },
        data: {
          stageData: stuckData,
          stats: flowData.stats,
          onClick: () => {},
        },
      })
    }

    // Forward edges between consecutive primary stages
    const currentStage = flowData.task.stage
    const currentStageIdx = STAGE_ORDER.indexOf(currentStage)

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
    const isStuck = currentStage === Stage.STUCK
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
