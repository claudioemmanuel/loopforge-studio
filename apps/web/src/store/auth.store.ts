import { create } from 'zustand'
import { apiClient } from '../services/api.client'
import type { MeResponse } from '@loopforge/shared'

interface AuthState {
  user: MeResponse | null
  isLoading: boolean
  fetchMe: () => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  fetchMe: async () => {
    try {
      const user = await apiClient.get<MeResponse>('/auth/me')
      set({ user, isLoading: false })
    } catch {
      set({ user: null, isLoading: false })
    }
  },

  logout: async () => {
    await apiClient.post('/auth/logout')
    set({ user: null })
    window.location.href = '/login'
  },
}))
