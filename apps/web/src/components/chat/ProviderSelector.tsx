import { useEffect, useState } from 'react'
import { Provider } from '@loopforge/shared'
import type { ProviderConfig } from '@loopforge/shared'
import { apiClient } from '../../services/api.client'

const PROVIDER_MODELS: Record<Provider, string[]> = {
  [Provider.ANTHROPIC]: [
    'claude-sonnet-4-5-20250929',
    'claude-opus-4-6',
    'claude-haiku-4-5-20251001',
  ],
  [Provider.OPENAI]: ['gpt-4o', 'gpt-4-turbo', 'gpt-4o-mini'],
  [Provider.GOOGLE]: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
}

interface ProviderSelectorProps {
  selectedProvider: Provider | null
  selectedModel: string | null
  onSelect: (provider: Provider, model: string) => void
}

export function ProviderSelector({ selectedProvider, selectedModel, onSelect }: ProviderSelectorProps) {
  const [configs, setConfigs] = useState<ProviderConfig[]>([])

  useEffect(() => {
    apiClient
      .get<ProviderConfig[]>('/settings/providers')
      .then((c) => {
        setConfigs(c.filter((cfg) => cfg.hasKey))
        const def = c.find((cfg) => cfg.isDefault && cfg.hasKey)
        if (def && !selectedProvider) {
          onSelect(def.provider, def.defaultModel)
        }
      })
      .catch(console.error)
  }, [])

  if (configs.length === 0) {
    return (
      <p className="text-xs text-destructive">
        No AI providers configured. Go to Settings → Providers to add an API key.
      </p>
    )
  }

  const currentModels = selectedProvider ? PROVIDER_MODELS[selectedProvider] : []

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedProvider ?? ''}
        onChange={(e) => {
          const provider = e.target.value as Provider
          const models = PROVIDER_MODELS[provider]
          const config = configs.find((c) => c.provider === provider)
          onSelect(provider, config?.defaultModel ?? models[0])
        }}
        className="rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="" disabled>
          Select provider
        </option>
        {configs.map((cfg) => (
          <option key={cfg.provider} value={cfg.provider}>
            {cfg.provider}
          </option>
        ))}
      </select>

      {selectedProvider && (
        <select
          value={selectedModel ?? ''}
          onChange={(e) => onSelect(selectedProvider, e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
        >
          {currentModels.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
