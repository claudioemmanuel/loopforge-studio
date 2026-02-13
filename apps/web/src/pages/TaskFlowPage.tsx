import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTaskFlowStore } from '../store/taskflow.store'
import { TaskFlowCanvas } from '../components/flow/TaskFlowCanvas'
import { StageSidePanel } from '../components/flow/StageSidePanel'
import { TaskFlowSkeleton } from '../components/skeletons/TaskFlowSkeleton'

export function TaskFlowPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const { flowData, isLoading, sidePanelOpen, fetchFlow, subscribeToFlowUpdates } =
    useTaskFlowStore()

  useEffect(() => {
    if (taskId) {
      fetchFlow(taskId)
      const unsubscribe = subscribeToFlowUpdates(taskId)
      return unsubscribe
    }
  }, [taskId, fetchFlow, subscribeToFlowUpdates])

  if (isLoading && !flowData) {
    return <TaskFlowSkeleton />
  }

  if (!flowData) {
    return (
      <div className="flex h-[calc(100vh-57px)] items-center justify-center">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-57px)]">
      <div className="flex-1 relative">
        <TaskFlowCanvas flowData={flowData} />
      </div>
      {sidePanelOpen && <StageSidePanel flowData={flowData} />}
    </div>
  )
}
