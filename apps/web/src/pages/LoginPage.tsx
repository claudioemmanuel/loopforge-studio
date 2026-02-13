import { Github } from 'lucide-react'
import { useAuthStore } from '../store/auth.store'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function LoginPage() {
  const { user, isLoading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const handleGithubLogin = () => {
    window.location.href = '/api/auth/github'
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Loopforge Studio</h1>
          <p className="text-sm text-muted-foreground">
            Visual AI-assisted coding workflow
          </p>
        </div>

        <button
          onClick={handleGithubLogin}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          <Github className="h-4 w-4" />
          Sign in with GitHub
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Self-hosted · Your code never leaves your infrastructure
        </p>
      </div>
    </div>
  )
}
