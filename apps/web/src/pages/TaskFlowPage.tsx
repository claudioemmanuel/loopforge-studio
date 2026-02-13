import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTaskFlowStore } from '../store/taskflow.store'
import { TaskFlowCanvas } from '../components/flow/TaskFlowCanvas'
import { StageSidePanel } from '../components/flow/StageSidePanel'
import { TaskFlowSkeleton } from '../components/skeletons/TaskFlowSkeleton'
import { Breadcrumb } from '../components/layout/Breadcrumb'

export function TaskFlowPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const { flowData, isLoading, fetchFlow, subscribeToFlowUpdates, openSidePanel } =
    useTaskFlowStore()

  useEffect(() => {
    if (taskId) {
      fetchFlow(taskId)
      const unsubscribe = subscribeToFlowUpdates(taskId)
      return unsubscribe
    }
  }, [taskId, fetchFlow, subscribeToFlowUpdates])

  // Auto-select current stage when flow data loads
  useEffect(() => {
    if (flowData) {
      openSidePanel(flowData.task.stage)
    }
  }, [flowData, openSidePanel])

  if (isLoading && !flowData) {
    return <TaskFlowSkeleton />
  }

  if (!flowData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Compact header bar */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <Breadcrumb />
      </div>

      {/* Flow content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Flow Canvas - Left side */}
        <div className="flex-1 relative flex items-center justify-center">
          <TaskFlowCanvas flowData={flowData} />
        </div>

        {/* Sidebar - Right side (fixed, always visible) */}
        <StageSidePanel flowData={flowData} />
      </div>
    </div>
  )
}
