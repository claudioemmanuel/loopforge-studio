import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface ThemeStore {
  theme: Theme
  sidebarCollapsed: boolean
  toggle: () => void
  toggleSidebar: () => void
  init: () => void
}

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'light',
  sidebarCollapsed: false,

  toggle: () => {
    const next: Theme = get().theme === 'light' ? 'dark' : 'light'
    localStorage.setItem('af-theme', next)
    applyTheme(next)
    set({ theme: next })
  },

  toggleSidebar: () => {
    const next = !get().sidebarCollapsed
    localStorage.setItem('af-sidebar-collapsed', String(next))
    set({ sidebarCollapsed: next })
  },

  init: () => {
    const saved = localStorage.getItem('af-theme') as Theme | null
    const theme: Theme = saved === 'dark' ? 'dark' : 'light'
    applyTheme(theme)

    const sidebarSaved = localStorage.getItem('af-sidebar-collapsed')
    const sidebarCollapsed = sidebarSaved === 'true'

    set({ theme, sidebarCollapsed })
  },
}))
