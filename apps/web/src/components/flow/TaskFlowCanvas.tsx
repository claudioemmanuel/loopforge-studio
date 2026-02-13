import { useCallback } from 'react'
import { ReactFlow, Background, BackgroundVariant, useReactFlow, ReactFlowProvider } from '@xyflow/react'
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

function FlowContent({ flowData }: { flowData: TaskFlowData }) {
  const { openSidePanel } = useTaskFlowStore()
  const { nodes: layoutNodes, edges } = useFlowLayout(flowData)
  const { fitView } = useReactFlow()

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
      // Zoom into the clicked node
      setTimeout(() => {
        fitView({
          nodes: [{ id: node.id }],
          duration: 400,
          padding: 0.3,
          maxZoom: 1.0,
        })
      }, 50)
    },
    [openSidePanel, fitView],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={onNodeClick}
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 0.85 }}
      minZoom={0.3}
      maxZoom={1.2}
      defaultZoom={0.8}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
    </ReactFlow>
  )
}

interface TaskFlowCanvasProps {
  flowData: TaskFlowData
}

export function TaskFlowCanvas({ flowData }: TaskFlowCanvasProps) {
  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <FlowContent flowData={flowData} />
      </ReactFlowProvider>
    </div>
  )
}
