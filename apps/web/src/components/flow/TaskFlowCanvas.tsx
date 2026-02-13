import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from '@xyflow/react'
import type { NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { StageNode } from './StageNode'
import { StageEdge } from './StageEdge'
import { useFlowLayout } from './useFlowLayout'
import { useTaskFlowStore } from '../../store/taskflow.store'
import type { TaskFlowData } from '@loopforge/shared'
import type { Stage } from '@loopforge/shared'

const nodeTypes = { stage: StageNode }
const edgeTypes = { stage: StageEdge }

interface TaskFlowCanvasProps {
  flowData: TaskFlowData
}

export function TaskFlowCanvas({ flowData }: TaskFlowCanvasProps) {
  const { openSidePanel } = useTaskFlowStore()
  const { nodes: layoutNodes, edges } = useFlowLayout(flowData)

  // Inject click handler into node data
  const nodes = layoutNodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      onClick: (stage: Stage) => openSidePanel(stage),
    },
  }))

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      openSidePanel(node.id as Stage)
    },
    [openSidePanel],
  )

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-background !border-border"
        />
      </ReactFlow>
    </div>
  )
}
