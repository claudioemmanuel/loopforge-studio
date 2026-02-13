import { useState, useEffect } from 'react'
import { ProviderConfigCard } from '../components/settings/ProviderConfigCard'
import type { ProviderCardState } from '../components/settings/ProviderConfigCard'
import { ConnectRepoDialog } from '../components/settings/ConnectRepoDialog'
import { Provider } from '@loopforge/shared'
import { apiClient } from '../services/api.client'
import type { Repository, ProviderConfig } from '@loopforge/shared'
import type { SaveProviderConfigRequest } from '@loopforge/shared'
import { Loader2, Save } from 'lucide-react'
import { SystemStatusPanel } from '../components/settings/SystemStatusPanel'

const PROVIDERS = [Provider.ANTHROPIC, Provider.OPENAI, Provider.GOOGLE]

const DEFAULT_MODELS: Record<string, string> = {
  ANTHROPIC: 'claude-sonnet-4-5-20250929',
  OPENAI: 'gpt-4o',
  GOOGLE: 'gemini-2.5-pro',
}

function makeInitialState(provider: Provider): ProviderCardState {
  return { apiKey: '', model: DEFAULT_MODELS[provider] ?? '', isDefault: false, config: null }
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'providers' | 'repositories' | 'system'>('providers')
  const [repos, setRepos] = useState<Repository[]>([])
  const [showConnect, setShowConnect] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [providerStates, setProviderStates] = useState<Record<Provider, ProviderCardState>>({
    [Provider.ANTHROPIC]: makeInitialState(Provider.ANTHROPIC),
    [Provider.OPENAI]: makeInitialState(Provider.OPENAI),
    [Provider.GOOGLE]: makeInitialState(Provider.GOOGLE),
  })

  useEffect(() => {
    apiClient
      .get<ProviderConfig[]>('/settings/providers')
      .then((configs) => {
        setProviderStates((prev) => {
          const next = { ...prev }
          for (const cfg of configs) {
            const p = cfg.provider as Provider
            next[p] = { apiKey: '', model: cfg.defaultModel, isDefault: cfg.isDefault, config: cfg }
          }
          return next
        })
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (activeTab === 'repositories') {
      apiClient.get<Repository[]>('/repositories').then(setRepos).catch(console.error)
    }
  }, [activeTab])

  const handleDisconnect = async (repoId: string) => {
    await apiClient.delete(`/repositories/${repoId}`)
    setRepos((prev) => prev.filter((r) => r.id !== repoId))
  }

  const handleSaveAll = async () => {
    setIsSaving(true)
    try {
      await Promise.all(
        PROVIDERS.map(async (provider) => {
          const state = providerStates[provider]
          if (!state.apiKey.trim() && !state.config?.hasKey) return
          const body: SaveProviderConfigRequest = {
            apiKey: state.apiKey,
            defaultModel: state.model,
            isDefault: state.isDefault,
          }
          const updated = await apiClient.put<ProviderConfig>(`/settings/providers/${provider}`, body)
          setProviderStates((prev) => ({
            ...prev,
            [provider]: { ...prev[provider], apiKey: '', config: updated },
          }))
        }),
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (provider: Provider) => {
    if (!confirm(`Remove ${provider} configuration?`)) return
    await apiClient.delete(`/settings/providers/${provider}`)
    setProviderStates((prev) => ({
      ...prev,
      [provider]: makeInitialState(provider),
    }))
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <div className="mb-6 flex w-full gap-4 border-b">
        {(['providers', 'repositories', 'system'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 text-sm font-medium capitalize ${
              activeTab === tab
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'providers' && (
        <div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PROVIDERS.map((provider) => (
              <ProviderConfigCard
                key={provider}
                provider={provider}
                value={providerStates[provider]}
                onChange={(next) => setProviderStates((prev) => ({ ...prev, [provider]: next }))}
                onDelete={() => handleDelete(provider)}
              />
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saved ? 'Saved!' : isSaving ? 'Saving…' : 'Save All'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'system' && <SystemStatusPanel />}

      {activeTab === 'repositories' && (
        <div className="space-y-4">
          <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
            Loopforge uses GitHub's API — no local clone needed. The AI commits plan artifacts to a
            feature branch on your behalf.
          </p>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {repos.length} connected {repos.length === 1 ? 'repository' : 'repositories'}
            </p>
            <button
              onClick={() => setShowConnect(true)}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              + Connect Repo
            </button>
          </div>

          {repos.map((repo) => (
            <div key={repo.id} className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">{repo.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  Default branch: {repo.defaultBranch}
                </p>
              </div>
              <button
                onClick={() => handleDisconnect(repo.id)}
                className="text-sm text-destructive hover:underline"
              >
                Disconnect
              </button>
            </div>
          ))}

          {repos.length === 0 && (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No repositories connected. Click "Connect Repo" to get started.
            </p>
          )}

          {showConnect && (
            <ConnectRepoDialog
              onClose={() => setShowConnect(false)}
              onConnected={(repo) => {
                setRepos((prev) => [...prev, repo])
                setShowConnect(false)
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
