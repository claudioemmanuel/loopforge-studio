import { create } from 'zustand'
import { apiClient } from '../services/api.client'
import type { TaskListItem, Repository } from '@loopforge/shared'
import type { Stage } from '@loopforge/shared'

interface RepositoryState {
  tasks: TaskListItem[]
  repository: Repository | null
  isLoading: boolean
  filters: {
    stage: Stage | null
    sort: string
    order: 'asc' | 'desc'
  }
  fetchRepoTasks: (repoId: string) => Promise<void>
  fetchRepository: (repoId: string) => Promise<void>
  setFilter: (filters: Partial<RepositoryState['filters']>) => void
}

export const useRepositoryStore = create<RepositoryState>((set, get) => ({
  tasks: [],
  repository: null,
  isLoading: false,
  filters: {
    stage: null,
    sort: 'createdAt',
    order: 'desc',
  },

  fetchRepoTasks: async (repoId: string) => {
    set({ isLoading: true })
    try {
      const { stage, sort, order } = get().filters
      const params = new URLSearchParams()
      if (stage) params.set('stage', stage)
      params.set('sort', sort)
      params.set('order', order)
      const qs = params.toString()
      const tasks = await apiClient.get<TaskListItem[]>(
        `/repositories/${repoId}/tasks${qs ? `?${qs}` : ''}`,
      )
      set({ tasks })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchRepository: async (repoId: string) => {
    const repos = await apiClient.get<Repository[]>('/repositories')
    const repo = repos.find((r) => r.id === repoId) ?? null
    set({ repository: repo })
  },

  setFilter: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }))
  },
}))
