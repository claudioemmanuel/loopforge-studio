import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface ThemeStore {
  theme: Theme
  toggle: () => void
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

  toggle: () => {
    const next: Theme = get().theme === 'light' ? 'dark' : 'light'
    localStorage.setItem('lf-theme', next)
    applyTheme(next)
    set({ theme: next })
  },

  init: () => {
    const saved = localStorage.getItem('lf-theme') as Theme | null
    const theme: Theme = saved === 'dark' ? 'dark' : 'light'
    applyTheme(theme)
    set({ theme })
  },
}))
