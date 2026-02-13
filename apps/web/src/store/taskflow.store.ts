import { create } from 'zustand'
import { apiClient } from '../services/api.client'
import { onBoardEvent } from '../services/socket.client'
import type { TaskFlowData, TaskStageChangedEvent } from '@loopforge/shared'
import type { Stage } from '@loopforge/shared'

interface TaskFlowState {
  flowData: TaskFlowData | null
  isLoading: boolean
  sidePanelStage: Stage | null
  sidePanelOpen: boolean
  fetchFlow: (taskId: string) => Promise<void>
  openSidePanel: (stage: Stage) => void
  closeSidePanel: () => void
  navigateSidePanel: (direction: 'prev' | 'next') => void
  subscribeToFlowUpdates: (taskId: string) => () => void
}

const STAGE_ORDER: Stage[] = [
  'TODO' as Stage, 'BRAINSTORMING' as Stage, 'PLANNING' as Stage,
  'READY' as Stage, 'EXECUTING' as Stage, 'CODE_REVIEW' as Stage, 'DONE' as Stage,
]

export const useTaskFlowStore = create<TaskFlowState>((set, get) => ({
  flowData: null,
  isLoading: false,
  sidePanelStage: null,
  sidePanelOpen: false,

  fetchFlow: async (taskId: string) => {
    set({ isLoading: true })
    try {
      const flowData = await apiClient.get<TaskFlowData>(`/tasks/${taskId}/flow`)
      set({ flowData })
    } finally {
      set({ isLoading: false })
    }
  },

  openSidePanel: (stage: Stage) => {
    set({ sidePanelStage: stage, sidePanelOpen: true })
  },

  closeSidePanel: () => {
    set({ sidePanelOpen: false })
  },

  navigateSidePanel: (direction: 'prev' | 'next') => {
    const { sidePanelStage } = get()
    if (!sidePanelStage) return

    const currentIdx = STAGE_ORDER.indexOf(sidePanelStage)
    if (currentIdx === -1) return

    const newIdx = direction === 'prev' ? currentIdx - 1 : currentIdx + 1
    if (newIdx >= 0 && newIdx < STAGE_ORDER.length) {
      set({ sidePanelStage: STAGE_ORDER[newIdx] })
    }
  },

  subscribeToFlowUpdates: (taskId: string) => {
    const unsubStage = onBoardEvent('task:stage_changed', (data: TaskStageChangedEvent) => {
      if (data.taskId !== taskId) return

      // Optimistic update: mark old stage completed, new stage active
      set((state) => {
        if (!state.flowData) return state
        return {
          flowData: {
            ...state.flowData,
            task: { ...state.flowData.task, stage: data.toStage },
            stages: state.flowData.stages.map((s) => {
              if (s.stage === data.fromStage) {
                return { ...s, status: 'completed' as const, completedAt: data.at }
              }
              if (s.stage === data.toStage) {
                return { ...s, status: 'active' as const, enteredAt: data.at }
              }
              return s
            }),
            transitions: [
              ...state.flowData.transitions,
              {
                from: data.fromStage,
                to: data.toStage,
                timestamp: data.at,
                direction: 'forward' as const,
              },
            ],
          },
        }
      })

      // Full refetch for consistency
      get().fetchFlow(taskId)
    })

    return () => {
      unsubStage()
    }
  },
}))
