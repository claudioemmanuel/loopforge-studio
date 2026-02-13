import type { Provider, ProviderConfig } from '@loopforge/shared'
import { Eye, EyeOff, ExternalLink, Trash2 } from 'lucide-react'
import { useState } from 'react'

const PROVIDER_MODELS: Record<string, string[]> = {
  ANTHROPIC: ['claude-sonnet-4-5-20250929', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
  OPENAI: ['gpt-4o', 'gpt-4-turbo', 'gpt-4o-mini'],
  GOOGLE: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
}

const PROVIDER_KEY_URLS: Record<string, string> = {
  ANTHROPIC: 'https://console.anthropic.com/settings/keys',
  OPENAI: 'https://platform.openai.com/api-keys',
  GOOGLE: 'https://aistudio.google.com/app/api-keys',
}

export interface ProviderCardState {
  apiKey: string
  model: string
  isDefault: boolean
  config: ProviderConfig | null
}

interface ProviderConfigCardProps {
  provider: Provider
  value: ProviderCardState
  onChange: (next: ProviderCardState) => void
  onDelete: () => void
}

export function ProviderConfigCard({ provider, value, onChange, onDelete }: ProviderConfigCardProps) {
  const [showKey, setShowKey] = useState(false)

  const keyUrl = PROVIDER_KEY_URLS[provider]

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{provider}</h3>
          <p className="text-xs text-muted-foreground">
            {value.config?.hasKey ? '✓ API key configured' : 'No API key'}
          </p>
        </div>
        {value.config?.hasKey && (
          <button
            onClick={onDelete}
            className="rounded-md p-1 text-muted-foreground hover:text-destructive"
            title="Remove configuration"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">API Key</label>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={value.apiKey}
              onChange={(e) => onChange({ ...value, apiKey: e.target.value })}
              placeholder={value.config?.hasKey ? '••••••••••••••• (update to change)' : 'Enter API key'}
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              className="rounded-md border px-2 text-muted-foreground hover:bg-muted"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {keyUrl && (
            <a
              href={keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Get API key <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Default Model</label>
          <select
            value={value.model}
            onChange={(e) => onChange({ ...value, model: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {(PROVIDER_MODELS[provider] ?? []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.isDefault}
            onChange={(e) => onChange({ ...value, isDefault: e.target.checked })}
            className="rounded"
          />
          Set as global default provider
        </label>
      </div>
    </div>
  )
}
