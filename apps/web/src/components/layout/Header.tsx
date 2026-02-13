import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'
import { useThemeStore } from '../../store/theme.store'
import { Settings, BarChart3, LogOut, Moon, Sun, Menu, X } from 'lucide-react'
import { Breadcrumb } from './Breadcrumb'

const UTILITY_ITEMS = [
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export function Header() {
  const { user, logout } = useAuthStore()
  const { pathname } = useLocation()
  const { theme, toggle } = useThemeStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="border-b bg-background">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4 md:gap-6">
          <Link to="/" className="text-sm font-semibold tracking-tight hover:opacity-80 transition-opacity">
            Loopforge Studio
          </Link>
          <div className="hidden md:block">
            <Breadcrumb />
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <nav className="hidden items-center gap-1 md:flex">
            {UTILITY_ITEMS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  pathname === to
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </nav>

          <button
            onClick={toggle}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {user && (
            <>
              <span className="hidden text-sm text-muted-foreground md:block">{user.username}</span>
              <button
                onClick={logout}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t bg-background px-4 pb-3 md:hidden">
          <div className="py-2">
            <Breadcrumb />
          </div>
          {UTILITY_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                pathname === to
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          {user && (
            <div className="mt-2 border-t pt-2">
              <p className="px-3 py-1 text-xs text-muted-foreground">{user.username}</p>
            </div>
          )}
        </nav>
      )}
    </header>
  )
}
