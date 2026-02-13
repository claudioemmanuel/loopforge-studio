import { create } from 'zustand'
import { apiClient } from '../services/api.client'
import type { RepositoryDashboardTile } from '@loopforge/shared'

interface DashboardState {
  tiles: RepositoryDashboardTile[]
  isLoading: boolean
  fetchDashboard: () => Promise<void>
}

export const useDashboardStore = create<DashboardState>((set) => ({
  tiles: [],
  isLoading: false,

  fetchDashboard: async () => {
    set({ isLoading: true })
    try {
      const tiles = await apiClient.get<RepositoryDashboardTile[]>('/repositories/dashboard')
      set({ tiles })
    } finally {
      set({ isLoading: false })
    }
  },
}))
