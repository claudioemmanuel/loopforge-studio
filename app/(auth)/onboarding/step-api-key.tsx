"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Check,
  Loader2,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Info,
  Shield,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GitHubRepo, Provider, ProviderConfig } from "./onboarding-config";
import { ModelDropdown } from "./model-dropdown";

export function StepApiKey({
  providers,
  currentProvider,
  selectedProvider,
  onProviderChange,
  apiKey,
  onApiKeyChange,
  selectedModel,
  onModelChange,
  repos,
  selectedRepos,
  loading,
  onComplete,
  onBack,
}: {
  providers: ProviderConfig[];
  currentProvider: ProviderConfig;
  selectedProvider: Provider;
  onProviderChange: (providerId: Provider) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  repos: GitHubRepo[];
  selectedRepos: Set<number>;
  loading: boolean;
  onComplete: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <div className="font-medium text-blue-900 dark:text-blue-100">
              Why do I need an API key?
            </div>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Loopforge uses AI to analyze your code and generate commits. You
              pay the AI provider directly for API usage.
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Typical cost: ~$0.01-0.10 per task depending on codebase size.
            </p>
          </div>
        </div>
      </div>

      {/* Step 1: Choose Provider */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
            1
          </div>
          <h3 className="font-medium">Choose your AI provider</h3>
        </div>
        <div className="ml-8 grid grid-cols-3 gap-3">
          {providers.map((provider) => {
            const IconComponent = provider.icon;
            const isSelected = selectedProvider === provider.id;
            return (
              <button
                key={provider.id}
                type="button"
                onClick={() => onProviderChange(provider.id)}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50 hover:bg-muted/50",
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    provider.bgColor,
                  )}
                >
                  <IconComponent className={provider.color} size={22} />
                </div>
                <div className="text-center">
                  <div className="font-medium text-sm">{provider.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {provider.displayName}
                  </div>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Get API Key */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
            2
          </div>
          <h3 className="font-medium">
            Get your {currentProvider.name} API key
          </h3>
        </div>
        <div className="ml-8 space-y-3">
          <p className="text-sm text-muted-foreground">
            Go to the {currentProvider.name} console to create an API key.
          </p>
          <Button variant="outline" size="sm" asChild>
            <a
              href={currentProvider.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              Open {currentProvider.name} Console
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Key className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Suggested key name:</span>
              <code className="px-1.5 py-0.5 bg-background rounded text-sm font-mono">
                Loopforge
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3: Enter API Key & Select Model */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
            3
          </div>
          <h3 className="font-medium">Enter your API key</h3>
        </div>
        <div className="ml-8 space-y-4">
          <div className="space-y-2">
            <Input
              id="apiKey"
              type="password"
              placeholder={currentProvider.placeholder}
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-4 h-4 text-green-600 dark:text-green-500" />
              <span>
                Your API key is encrypted with AES-256-GCM before storage
              </span>
            </div>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <ModelDropdown
              provider={currentProvider}
              selectedModel={selectedModel}
              onSelect={onModelChange}
            />
          </div>
        </div>
      </div>

      {/* Selected Repos Summary */}
      <div className="p-3 bg-muted/50 rounded-lg">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
          Selected Repositories
        </div>
        <div className="text-sm text-muted-foreground">
          {repos
            .filter((r) => selectedRepos.has(r.id))
            .map((r) => r.full_name)
            .join(", ")}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button variant="ghost" onClick={onBack} disabled={loading}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onComplete} disabled={!apiKey || loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Setting up...
            </>
          ) : (
            <>
              Complete Setup
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
