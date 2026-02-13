import { useEffect } from 'react'
import { useAuthStore } from '../../store/auth.store'
import { useThemeStore } from '../../store/theme.store'
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  Moon,
  Sun,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  X,
} from 'lucide-react'
import { SidebarItem } from './SidebarItem'
import { cn } from '../../lib/utils'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { user, logout } = useAuthStore()
  const { theme, toggle, sidebarCollapsed, toggleSidebar } = useThemeStore()

  // Keyboard shortcut: Ctrl+B to toggle sidebar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar])

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={cn(
        'flex h-14 items-center border-b border-sidebar-border px-4',
        sidebarCollapsed && 'justify-center px-2',
      )}>
        {sidebarCollapsed ? (
          <span className="text-base font-bold text-white">AF</span>
        ) : (
          <span className="text-sm font-semibold tracking-tight text-white">Agent Forge</span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {NAV_ITEMS.map((item) => (
          <SidebarItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            collapsed={sidebarCollapsed}
          />
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-hover hover:text-white',
            sidebarCollapsed && 'justify-center px-0',
          )}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {!sidebarCollapsed && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
        </button>

        {/* User info & logout */}
        {user && (
          <div className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2',
            sidebarCollapsed && 'justify-center px-0',
          )}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent/20 text-xs font-medium text-sidebar-accent">
              {user.username.charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-1 items-center justify-between min-w-0">
                <span className="truncate text-sm text-sidebar-foreground">{user.username}</span>
                <button
                  onClick={logout}
                  title="Sign out"
                  className="text-sidebar-foreground/60 hover:text-white transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'hidden md:flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-hover hover:text-white',
            sidebarCollapsed && 'justify-center px-0',
          )}
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-sidebar transition-[width] duration-200 ease-in-out',
          sidebarCollapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={onMobileClose}
          />
          <aside className="fixed inset-y-0 left-0 z-40 flex w-sidebar flex-col bg-sidebar md:hidden">
            <button
              onClick={onMobileClose}
              className="absolute right-3 top-4 text-sidebar-foreground hover:text-white"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  )
}
