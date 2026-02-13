import { useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'
import { Header } from './Header'

export function AuthGuard() {
  const { user, isLoading, fetchMe } = useAuthStore()

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <>
      <Header />
      <Outlet />
    </>
  )
}
