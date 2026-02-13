import { useNavigate, useParams } from 'react-router-dom'
import { Maximize2 } from 'lucide-react'
import { useTaskFlowStore } from '../../store/taskflow.store'
import { STAGE_CONFIG } from './stage-config'
import { StageContent } from './StageContent'
import { StagePanelFooter } from './StagePanelFooter'
import type { TaskFlowData } from '@loopforge/shared'
import type { Task } from '@loopforge/shared'

interface StageSidePanelProps {
  flowData: TaskFlowData
}

export function StageSidePanel({ flowData }: StageSidePanelProps) {
  const { repoId } = useParams()
  const navigate = useNavigate()
  const { sidePanelStage, navigateSidePanel } = useTaskFlowStore()

  // Always show current stage if no specific stage is selected
  const displayStage = sidePanelStage || flowData.task.stage

  const config = STAGE_CONFIG[displayStage]
  const Icon = config.icon

  // Build a Task-like object for stage content components
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

  const handleExpand = () => {
    navigate(`/repo/${repoId}/task/${flowData.task.id}/stage/${displayStage}`)
  }

  return (
    <div className="w-1/2 flex-shrink-0 border-l bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`rounded-md p-1 ${config.bgColor}`}>
            <Icon className={`h-4 w-4 ${config.textColor}`} />
          </div>
          <span className="text-sm font-semibold">{config.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleExpand}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            title="Expand to full page"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        <StageContent task={task} stage={displayStage} />
      </div>

      {/* Footer */}
      <StagePanelFooter currentStage={displayStage} onNavigate={navigateSidePanel} />
    </div>
  )
}
