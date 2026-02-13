import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTaskFlowStore } from '../store/taskflow.store'
import { STAGE_CONFIG } from '../components/flow/stage-config'
import { StageContent } from '../components/flow/StageContent'
import type { Stage, Task } from '@loopforge/shared'

export function StageFullPage() {
  const { repoId, taskId, stage } = useParams<{
    repoId: string
    taskId: string
    stage: string
  }>()
  const navigate = useNavigate()
  const { flowData, fetchFlow } = useTaskFlowStore()

  useEffect(() => {
    if (taskId && !flowData) {
      fetchFlow(taskId)
    }
  }, [taskId, flowData, fetchFlow])

  if (!flowData || !stage) {
    return (
      <div className="flex h-[calc(100vh-57px)] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const stageEnum = stage as Stage
  const config = STAGE_CONFIG[stageEnum]

  if (!config) {
    return (
      <div className="flex h-[calc(100vh-57px)] items-center justify-center">
        <p className="text-muted-foreground">Unknown stage</p>
      </div>
    )
  }

  const Icon = config.icon

  const task: Task = {
    id: flowData.task.id,
    userId: '',
    repositoryId: flowData.task.repositoryId,
    title: flowData.task.title,
    description: flowData.task.description,
    stage: flowData.task.stage,
    featureBranch: flowData.task.featureBranch,
    autonomousMode: flowData.task.autonomousMode,
    pullRequestUrl: flowData.task.pullRequestUrl,
    createdAt: flowData.task.createdAt,
    updatedAt: flowData.task.updatedAt,
    repositoryName: flowData.task.repositoryName ?? undefined,
  }

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3 md:px-6">
        <button
          onClick={() => navigate(`/repo/${repoId}/task/${taskId}`)}
          className="rounded-md p-1 hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className={`rounded-md p-1 ${config.bgColor}`}>
          <Icon className={`h-4 w-4 ${config.textColor}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{flowData.task.title}</p>
          <h1 className="text-base font-semibold">{config.label}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <StageContent task={task} stage={stageEnum} />
      </div>
    </div>
  )
}
