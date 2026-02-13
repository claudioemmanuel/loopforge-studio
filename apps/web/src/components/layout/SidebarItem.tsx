import { Link, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

interface SidebarItemProps {
  to: string
  icon: LucideIcon
  label: string
  collapsed: boolean
  badge?: number
}

export function SidebarItem({ to, icon: Icon, label, collapsed, badge }: SidebarItemProps) {
  const { pathname } = useLocation()
  const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)

  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        collapsed && 'justify-center px-0',
        isActive
          ? 'bg-sidebar-hover text-white'
          : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-white',
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-sidebar-accent" />
      )}
      <Icon className={cn('h-4 w-4 shrink-0', collapsed ? 'mx-auto' : '')} />
      {!collapsed && (
        <>
          <span className="truncate">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="ml-auto rounded bg-sidebar-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-sidebar-accent">
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  )
}
