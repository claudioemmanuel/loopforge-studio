import { create } from 'zustand'
import { apiClient } from '../services/api.client'
import { onBoardEvent } from '../services/socket.client'
import type {
  Task,
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskDeletedEvent,
  TaskStageChangedEvent,
} from '@loopforge/shared'
import { Stage } from '@loopforge/shared'
import type { CreateTaskRequest, UpdateTaskRequest } from '@loopforge/shared'

interface BoardState {
  tasks: Task[]
  isLoading: boolean
  fetchTasks: () => Promise<void>
  createTask: (data: CreateTaskRequest) => Promise<Task>
  updateTask: (id: string, data: UpdateTaskRequest) => Promise<Task>
  deleteTask: (id: string) => Promise<void>
  transitionTaskStage: (id: string, stage: Stage, feedback?: string, resetData?: boolean) => Promise<Task>
  subscribeToBoard: () => () => void
}

export const useBoardStore = create<BoardState>((set, _get) => ({
  tasks: [],
  isLoading: false,

  fetchTasks: async () => {
    set({ isLoading: true })
    try {
      const tasks = await apiClient.get<Task[]>('/tasks')
      set({ tasks })
    } finally {
      set({ isLoading: false })
    }
  },

  createTask: async (data: CreateTaskRequest) => {
    const task = await apiClient.post<Task>('/tasks', data)
    set((state) => ({ tasks: [...state.tasks, task] }))
    return task
  },

  updateTask: async (id: string, data: UpdateTaskRequest) => {
    const task = await apiClient.patch<Task>(`/tasks/${id}`, data)
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? task : t)),
    }))
    return task
  },

  deleteTask: async (id: string) => {
    await apiClient.delete(`/tasks/${id}`)
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }))
  },

  transitionTaskStage: async (id: string, stage: Stage, feedback?: string, resetData?: boolean) => {
    const url = resetData ? `/tasks/${id}/stage?resetData=true` : `/tasks/${id}/stage`
    const task = await apiClient.post<Task>(url, { stage, feedback })
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? task : t)),
    }))
    return task
  },

  subscribeToBoard: () => {
    const unsubCreate = onBoardEvent('task:created', (data: TaskCreatedEvent) => {
      set((state) => {
        const exists = state.tasks.some((t) => t.id === data.task.id)
        if (exists) return state
        return { tasks: [...state.tasks, data.task] }
      })
    })

    const unsubUpdate = onBoardEvent('task:updated', (data: TaskUpdatedEvent) => {
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === data.taskId
            ? { ...t, stage: data.stage, title: data.title, updatedAt: data.updatedAt }
            : t,
        ),
      }))
    })

    const unsubDelete = onBoardEvent('task:deleted', (data: TaskDeletedEvent) => {
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== data.taskId),
      }))
    })

    const unsubStage = onBoardEvent('task:stage_changed', (data: TaskStageChangedEvent) => {
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === data.taskId ? { ...t, stage: data.toStage } : t,
        ),
      }))
    })

    return () => {
      unsubCreate()
      unsubUpdate()
      unsubDelete()
      unsubStage()
    }
  },
}))

// Re-export Stage for convenience
export { Stage }
