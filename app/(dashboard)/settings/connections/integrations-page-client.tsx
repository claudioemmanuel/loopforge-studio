"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { clientLogger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Check,
  Lock,
  Globe,
  Bell,
  Loader2,
  Key,
  ExternalLink,
  Info,
  ChevronDown,
} from "lucide-react";
import { useSettings } from "../settings-context";
import { cn } from "@/lib/utils";
import {
  AnthropicIcon,
  OpenAIIcon,
  GeminiIcon,
} from "@/components/providers/provider-icons";

type Provider = "anthropic" | "openai" | "gemini";

interface ModelOption {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
}

interface ProviderConfig {
  id: Provider;
  name: string;
  displayName: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  placeholder: string;
  docsUrl: string;
  color: string;
  bgColor: string;
  models: ModelOption[];
  comingSoon?: boolean;
}

const providers: ProviderConfig[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    displayName: "Claude",
    icon: AnthropicIcon,
    placeholder: "Enter Anthropic API key",
    docsUrl: "https://console.anthropic.com/settings/keys",
    color: "text-[#D4A574]",
    bgColor: "bg-[#D4A574]/10",
    models: [
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        description: "Balanced performance and speed",
        recommended: true,
      },
      {
        id: "claude-opus-4-20250514",
        name: "Claude Opus 4",
        description: "Most capable model",
      },
      {
        id: "claude-haiku-3-20240307",
        name: "Claude Haiku 3",
        description: "Fastest responses",
      },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    displayName: "GPT-4",
    icon: OpenAIIcon,
    placeholder: "Enter OpenAI API key",
    docsUrl: "https://platform.openai.com/api-keys",
    color: "text-[#10A37F]",
    bgColor: "bg-[#10A37F]/10",
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        description: "Latest flagship model",
        recommended: true,
      },
      {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        description: "Previous flagship",
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "Faster, more affordable",
      },
    ],
  },
  {
    id: "gemini",
    name: "Google",
    displayName: "Gemini",
    icon: GeminiIcon,
    placeholder: "Enter Google API key",
    docsUrl: "https://aistudio.google.com/app/api-keys",
    color: "text-[#4285F4]",
    bgColor: "bg-[#4285F4]/10",
    models: [
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "Most capable model",
        recommended: true,
      },
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "Fast and efficient",
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Cost-effective multimodal",
      },
    ],
  },
];

function ModelDropdown({
  provider,
  selectedModel,
  onSelect,
  disabled,
}: {
  provider: ProviderConfig;
  selectedModel: string;
  onSelect: (model: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("settings.integrationsPage");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentModel =
    provider.models.find((m) => m.id === selectedModel) || provider.models[0];

  const handleSelect = async (modelId: string) => {
    if (modelId === selectedModel) {
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/settings/model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, model: modelId }),
      });

      if (res.ok) {
        onSelect(modelId);
      }
    } catch (error) {
      clientLogger.error("Failed to update model", { error });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled || loading}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg border bg-background",
          "hover:bg-muted/50 transition-colors",
          disabled && "opacity-50 cursor-not-allowed",
          open && "ring-2 ring-primary/20",
        )}
      >
        <span className="truncate">{currentModel.name}</span>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin ml-2 flex-shrink-0" />
        ) : (
          <ChevronDown
            className={cn(
              "w-4 h-4 ml-2 flex-shrink-0 transition-transform",
              open && "rotate-180",
            )}
          />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full rounded-lg border bg-popover shadow-lg">
            {provider.models.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => handleSelect(model.id)}
                className={cn(
                  "w-full px-3 py-2 text-left hover:bg-muted/50 first:rounded-t-lg last:rounded-b-lg",
                  model.id === selectedModel && "bg-muted",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{model.name}</span>
                  {model.recommended && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {t("recommended")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {model.description}
                </p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProviderCard({
  provider,
  maskedKey,
  selectedModel,
  onApiKeyUpdate,
  onModelUpdate,
}: {
  provider: ProviderConfig;
  maskedKey: string | null | undefined;
  selectedModel: string;
  onApiKeyUpdate: (newMaskedKey: string | null) => void;
  onModelUpdate: (model: string) => void;
}) {
  const t = useTranslations("settings.integrationsPage");
  const [isEditing, setIsEditing] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!newApiKey.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, apiKey: newApiKey }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save API key");
      }

      onApiKeyUpdate(data.maskedKey);
      setNewApiKey("");
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save API key");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/settings/api-key?provider=${provider.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove API key");
      }

      onApiKeyUpdate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove API key");
    } finally {
      setLoading(false);
    }
  };

  const IconComponent = provider.icon;

  return (
    <div className="p-4 rounded-xl border bg-card/50">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              provider.bgColor,
            )}
          >
            <IconComponent className={provider.color} size={22} />
          </div>
          <div>
            <h4 className="font-medium">{provider.name}</h4>
            <p className="text-xs text-muted-foreground">
              {provider.displayName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {provider.comingSoon && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {t("comingSoon")}
            </span>
          )}
          {maskedKey && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <Check className="w-3.5 h-3.5" />
              {t("configured")}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {maskedKey ? (
        <div className="space-y-3">
          <p className="font-mono text-sm bg-muted px-3 py-2 rounded">
            {maskedKey}
          </p>
          {isEditing ? (
            <div className="space-y-2">
              <Input
                type="password"
                placeholder={provider.placeholder}
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                disabled={loading}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!newApiKey.trim() || loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    t("save")
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false);
                    setNewApiKey("");
                    setError(null);
                  }}
                  disabled={loading}
                >
                  {t("cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
              >
                {t("update")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={handleRemove}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("remove")
                )}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("notConfigured")}</p>
          {isEditing ? (
            <div className="space-y-2">
              <Input
                type="password"
                placeholder={provider.placeholder}
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                disabled={loading}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!newApiKey.trim() || loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    t("save")
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false);
                    setNewApiKey("");
                    setError(null);
                  }}
                  disabled={loading}
                >
                  {t("cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setIsEditing(true)}>
                {t("configure")}
              </Button>
              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {t("getApiKey")}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Model Selection */}
      <div className="mt-4 pt-3 border-t">
        <label className="text-xs text-muted-foreground mb-1.5 block">
          {t("model")}
        </label>
        <ModelDropdown
          provider={provider}
          selectedModel={selectedModel}
          onSelect={onModelUpdate}
          disabled={provider.comingSoon}
        />
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const t = useTranslations("settings.integrationsPage");
  const { github, repos, apiKeys, modelPreferences, preferredProvider } =
    useSettings();
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [disconnectingRepoId, setDisconnectingRepoId] = useState<string | null>(
    null,
  );
  const [activeTasksCount, setActiveTasksCount] = useState(0);

  // Local state for API keys to update after save/remove
  const [localApiKeys, setLocalApiKeys] = useState({
    anthropic: apiKeys?.anthropic ?? null,
    openai: apiKeys?.openai ?? null,
    gemini: apiKeys?.gemini ?? null,
  });

  // Local state for model preferences
  const [localModelPreferences, setLocalModelPreferences] = useState({
    anthropic: modelPreferences?.anthropic ?? "claude-sonnet-4-20250514",
    openai: modelPreferences?.openai ?? "gpt-4o",
    gemini: modelPreferences?.gemini ?? "gemini-2.5-pro",
  });

  // Local state for preferred provider - only set if that provider is actually configured
  const getInitialPreferredProvider = (): Provider | null => {
    // If user has a saved preferred provider and that provider has an API key, use it
    if (preferredProvider && apiKeys?.[preferredProvider]) {
      return preferredProvider;
    }
    // Otherwise find the first configured provider
    const configuredProviders: Provider[] = ["anthropic", "openai", "gemini"];
    for (const p of configuredProviders) {
      if (apiKeys?.[p]) {
        return p;
      }
    }
    // No providers configured
    return null;
  };

  const [localPreferredProvider, setLocalPreferredProvider] =
    useState<Provider | null>(getInitialPreferredProvider());

  const handleProviderChange = async (provider: Provider) => {
    // Don't allow selecting a provider that doesn't have an API key
    if (!localApiKeys[provider]) {
      return;
    }

    setSavingProvider(true);
    try {
      const res = await fetch("/api/settings/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      if (res.ok) {
        setLocalPreferredProvider(provider);
      }
    } catch (error) {
      clientLogger.error("Failed to update provider", { error });
    } finally {
      setSavingProvider(false);
    }
  };

  const handleDisconnect = async (repoId: string) => {
    // Fetch active tasks count for this repo
    try {
      const response = await fetch(
        `/api/repos/${repoId}/tasks?status=executing,brainstorming,planning`,
      );
      const tasks = response.ok ? await response.json() : [];

      setDisconnectingRepoId(repoId);
      setActiveTasksCount(Array.isArray(tasks) ? tasks.length : 0);
      setShowDisconnectConfirm(true);
    } catch (error) {
      clientLogger.error("Failed to fetch active tasks", { error });
      // Still show dialog even if we can't fetch tasks
      setDisconnectingRepoId(repoId);
      setActiveTasksCount(0);
      setShowDisconnectConfirm(true);
    }
  };

  const confirmDisconnect = async () => {
    if (!disconnectingRepoId) return;

    setDisconnecting(disconnectingRepoId);
    try {
      const res = await fetch(`/api/repos/${disconnectingRepoId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      } else {
        clientLogger.error("Failed to disconnect repository");
      }
    } catch (error) {
      clientLogger.error("Failed to disconnect repository", { error });
    } finally {
      setDisconnecting(null);
      setShowDisconnectConfirm(false);
      setDisconnectingRepoId(null);
    }
  };

  const handleApiKeyUpdate = async (
    provider: Provider,
    newMaskedKey: string | null,
  ) => {
    setLocalApiKeys((prev) => ({ ...prev, [provider]: newMaskedKey }));

    // If this is a new API key and no provider is selected, auto-select this one
    if (newMaskedKey && !localPreferredProvider) {
      setSavingProvider(true);
      try {
        const res = await fetch("/api/settings/provider", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider }),
        });

        if (res.ok) {
          setLocalPreferredProvider(provider);
        }
      } catch (error) {
        clientLogger.error("Failed to set default provider", { error });
      } finally {
        setSavingProvider(false);
      }
    }

    // If removing the API key for the currently selected provider, clear the selection
    if (!newMaskedKey && localPreferredProvider === provider) {
      // Find another configured provider to select
      const configuredProviders: Provider[] = ["anthropic", "openai", "gemini"];
      const otherConfigured = configuredProviders.find(
        (p) => p !== provider && localApiKeys[p],
      );

      if (otherConfigured) {
        // Auto-select another configured provider
        try {
          const res = await fetch("/api/settings/provider", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: otherConfigured }),
          });

          if (res.ok) {
            setLocalPreferredProvider(otherConfigured);
          }
        } catch (error) {
          clientLogger.error("Failed to update default provider", { error });
        }
      } else {
        // No other providers configured, clear the selection
        setLocalPreferredProvider(null);
      }
    }
  };

  const handleModelUpdate = (provider: Provider, model: string) => {
    setLocalModelPreferences((prev) => ({ ...prev, [provider]: model }));
  };

  return (
    <Tabs defaultValue="ai-providers" className="space-y-6">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="ai-providers">AI Providers</TabsTrigger>
        <TabsTrigger value="github">GitHub</TabsTrigger>
      </TabsList>

      <TabsContent value="ai-providers" className="space-y-6">
        {/* AI Providers */}
        <div className="p-6 rounded-xl border bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-4 h-4" />
            <h3 className="font-serif font-semibold tracking-tight">
              {t("aiProviders")}
            </h3>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            {t("aiProvidersDescription")}
          </p>

          {/* Default Provider Selector */}
          <div className="mb-6 p-4 rounded-lg bg-muted/30 border">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="font-medium text-sm">{t("defaultProvider")}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("defaultProviderDescription")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {savingProvider && <Loader2 className="w-4 h-4 animate-spin" />}
                <div className="flex rounded-lg border overflow-hidden overflow-x-auto scrollbar-hide">
                  {providers.map((provider) => {
                    const IconComponent = provider.icon;
                    const isSelected = localPreferredProvider === provider.id;
                    const hasKey = localApiKeys[provider.id];
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => handleProviderChange(provider.id)}
                        disabled={savingProvider || !hasKey}
                        title={
                          !hasKey
                            ? t("configureFirst", { provider: provider.name })
                            : t("useProvider", { provider: provider.name })
                        }
                        className={cn(
                          "px-2 sm:px-3 py-2 flex items-center gap-1.5 sm:gap-2 transition-all duration-200 border-r last:border-r-0 whitespace-nowrap",
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-sm font-medium"
                            : hasKey
                              ? "hover:bg-muted/50 active:bg-muted"
                              : "opacity-50 cursor-not-allowed",
                        )}
                      >
                        <IconComponent
                          size={16}
                          className={isSelected ? "" : provider.color}
                        />
                        <span className="text-xs font-medium">
                          {provider.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {providers.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                maskedKey={localApiKeys[provider.id]}
                selectedModel={localModelPreferences[provider.id]}
                onApiKeyUpdate={(newKey) =>
                  handleApiKeyUpdate(provider.id, newKey)
                }
                onModelUpdate={(model) => handleModelUpdate(provider.id, model)}
              />
            ))}
          </div>

          {/* Coming soon banner */}
          <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-dashed flex items-start gap-3">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{t("moreProvidersComing")}</span>{" "}
              {t("moreProvidersList")}
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="github" className="space-y-6">
        {/* GitHub Connection */}
        <div className="p-6 rounded-xl border bg-card">
          <h3 className="font-serif font-semibold tracking-tight mb-4">
            {t("githubConnection")}
          </h3>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Check className="w-4 h-4" />
              <span>{t("connectedAs", { username: github.username })}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("permissions")} {t("permissionsList")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("connectedAt")} {github.connectedAt}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                {t("reconnect")}
              </Button>
              <Button size="sm" variant="outline" className="text-destructive">
                {t("revokeAccess")}
              </Button>
            </div>
          </div>
        </div>

        {/* Connected Repositories */}
        <div className="p-6 rounded-xl border bg-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif font-semibold tracking-tight">
              {t("connectedRepositories")}
            </h3>
            <Button size="sm" variant="outline">
              {t("addRepos")}
            </Button>
          </div>
          {repos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("noReposConnected")}
            </p>
          ) : (
            <div className="space-y-2">
              {repos.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{repo.fullName}</span>
                    {repo.isPrivate ? (
                      <Lock className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <Globe className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive text-xs"
                    onClick={() => handleDisconnect(repo.id)}
                    disabled={disconnecting === repo.id}
                  >
                    {disconnecting === repo.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      t("disconnect")
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Webhooks */}
        <div className="p-6 rounded-xl border bg-card opacity-60">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4" />
            <h3 className="font-serif font-semibold tracking-tight">
              {t("webhooks")}
            </h3>
            <span className="text-xs bg-muted px-2 py-0.5 rounded">
              {t("comingSoon")}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {t("webhooksDescription")}
          </p>
          <Button size="sm" variant="outline" disabled>
            {t("notifyWhenAvailable")}
          </Button>
        </div>

        {/* Disconnect Confirmation Dialog */}
        <ConfirmDialog
          open={showDisconnectConfirm}
          onOpenChange={setShowDisconnectConfirm}
          title={t("disconnectConfirmTitle")}
          description={t("disconnectConfirmDescription")}
          confirmText={t("disconnect")}
          variant="destructive"
          onConfirm={confirmDisconnect}
        >
          {activeTasksCount > 0 && (
            <div className="rounded-lg bg-yellow-50 p-3 mt-2">
              <p className="text-sm text-yellow-800">
                {t("activeTasksWarning", { count: activeTasksCount })}
              </p>
            </div>
          )}

          <div className="mt-3 text-sm text-muted-foreground">
            <p>{t("disconnectConsequences")}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>{t("tasksWillFail")}</li>
              <li>{t("branchesPreserved")}</li>
              <li>{t("canReconnect")}</li>
            </ul>
          </div>
        </ConfirmDialog>
      </TabsContent>
    </Tabs>
  );
}
