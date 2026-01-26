"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Search,
  Star,
  Lock,
  Globe,
  Building2,
  Check,
  Loader2,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Info,
  Shield,
  Key,
  ChevronDown,
} from "lucide-react";
import { LoopforgeLogo } from "@/components/loopforge-logo";
import { AnthropicIcon, OpenAIIcon, GeminiIcon } from "@/components/providers";
import { cn } from "@/lib/utils";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  clone_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
    type: string;
  };
}

type FilterType = "all" | "public" | "private" | "org";
type Step = "repos" | "apikey";
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
}

const providers: ProviderConfig[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    displayName: "Claude",
    icon: AnthropicIcon,
    placeholder: "sk-ant-api03-...",
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
    placeholder: "sk-proj-...",
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
    placeholder: "AIza...",
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
}: {
  provider: ProviderConfig;
  selectedModel: string;
  onSelect: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const currentModel =
    provider.models.find((m) => m.id === selectedModel) || provider.models[0];

  const handleSelect = (modelId: string) => {
    onSelect(modelId);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg border bg-background",
          "hover:bg-muted/50 transition-colors",
          open && "ring-2 ring-primary/20",
        )}
      >
        <span className="truncate">{currentModel.name}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 ml-2 flex-shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
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
                      Recommended
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

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("repos");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set());
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingRepos, setFetchingRepos] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [checkingExistingRepos, setCheckingExistingRepos] = useState(true);
  const [selectedProvider, setSelectedProvider] =
    useState<Provider>("anthropic");
  const [selectedModel, setSelectedModel] = useState<string>(
    "claude-sonnet-4-20250514",
  );

  const currentProvider = providers.find((p) => p.id === selectedProvider)!;

  const handleProviderChange = (providerId: Provider) => {
    setSelectedProvider(providerId);
    // Reset to the recommended model for this provider
    const provider = providers.find((p) => p.id === providerId)!;
    const recommendedModel =
      provider.models.find((m) => m.recommended) || provider.models[0];
    setSelectedModel(recommendedModel.id);
    // Clear API key when switching providers
    setApiKey("");
  };

  // Check if user already has configured repos - if so, skip onboarding
  useEffect(() => {
    const checkExistingRepos = async () => {
      try {
        const res = await fetch("/api/repos");
        if (res.ok) {
          const userRepos = await res.json();
          if (Array.isArray(userRepos) && userRepos.length > 0) {
            // User already has repos configured, skip onboarding
            router.replace("/dashboard");
            return;
          }
        }
      } catch {
        // If check fails, continue with onboarding
      }
      setCheckingExistingRepos(false);
    };
    checkExistingRepos();
  }, [router]);

  useEffect(() => {
    // Only fetch GitHub repos if we're not redirecting
    if (!checkingExistingRepos) {
      fetchRepos();
    }
  }, [checkingExistingRepos]);

  const fetchRepos = async () => {
    setFetchingRepos(true);
    setError(null);
    try {
      const res = await fetch("/api/github/repos");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch repositories");
      }
      const data = await res.json();
      setRepos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setFetchingRepos(false);
    }
  };

  // Group repos by owner
  const groupedRepos = useMemo(() => {
    const filtered = repos.filter((repo) => {
      const matchesSearch =
        searchQuery === "" ||
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (repo.description?.toLowerCase().includes(searchQuery.toLowerCase()) ??
          false);

      const matchesFilter =
        filter === "all" ||
        (filter === "public" && !repo.private) ||
        (filter === "private" && repo.private) ||
        (filter === "org" && repo.owner.type === "Organization");

      return matchesSearch && matchesFilter;
    });

    const groups: Record<
      string,
      { owner: GitHubRepo["owner"]; repos: GitHubRepo[] }
    > = {};
    filtered.forEach((repo) => {
      if (!groups[repo.owner.login]) {
        groups[repo.owner.login] = { owner: repo.owner, repos: [] };
      }
      groups[repo.owner.login].repos.push(repo);
    });

    return Object.values(groups);
  }, [repos, searchQuery, filter]);

  const toggleRepo = (repoId: number) => {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  };

  const handleContinueToApiKey = () => {
    if (selectedRepos.size === 0) {
      setError("Please select at least one repository");
      return;
    }
    setStep("apikey");
  };

  const handleComplete = async () => {
    if (!apiKey) {
      setError(`Please enter your ${currentProvider.name} API key`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedReposList = repos.filter((r) => selectedRepos.has(r.id));

      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repos: selectedReposList,
          apiKey,
          provider: selectedProvider,
          model: selectedModel,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to complete onboarding");
      }

      await res.json();
      router.push("/dashboard?welcome=true");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const getStepNumber = () => {
    if (step === "repos") return 1;
    return 2;
  };

  // Show loading state while checking for existing repos
  if (checkingExistingRepos) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background to-secondary/30">
        <div className="mb-6 flex flex-col items-center">
          <LoopforgeLogo
            size="lg"
            animate={true}
            showSparks={true}
            showText={false}
          />
          <h1 className="text-3xl font-serif font-bold tracking-tight !-mt-2">
            <span className="text-primary">Loop</span>forge
          </h1>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background to-secondary/30">
      <div className="mb-6 flex flex-col items-center">
        <LoopforgeLogo
          size="lg"
          animate={true}
          showSparks={true}
          showText={false}
        />
        <h1 className="text-3xl font-serif font-bold tracking-tight !-mt-2">
          <span className="text-primary">Loop</span>forge
        </h1>
      </div>
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <div className="flex items-center gap-4 mb-2">
            {/* Step 1: Repos */}
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  getStepNumber() >= 1
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {getStepNumber() > 1 ? <Check className="w-4 h-4" /> : "1"}
              </div>
              <span className="text-sm hidden sm:inline">Repos</span>
            </div>
            <div className="h-px flex-1 bg-border" />

            {/* Step 2: API Key */}
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  getStepNumber() >= 2
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                2
              </div>
              <span className="text-sm hidden sm:inline">API Key</span>
            </div>
          </div>
          <CardTitle>
            {step === "repos" && "Select Repositories"}
            {step === "apikey" && "Configure Your AI Provider"}
          </CardTitle>
          <CardDescription>
            {step === "repos" &&
              "Choose which repositories to connect with Loopforge"}
            {step === "apikey" &&
              "Choose an AI provider and enter your API key"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Repository Selection */}
          {step === "repos" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search repositories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-1">
                  {(["all", "public", "private", "org"] as FilterType[]).map(
                    (f) => (
                      <Button
                        key={f}
                        variant={filter === f ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setFilter(f)}
                        className="capitalize"
                      >
                        {f === "org" ? (
                          <Building2 className="w-4 h-4 mr-1" />
                        ) : f === "private" ? (
                          <Lock className="w-4 h-4 mr-1" />
                        ) : f === "public" ? (
                          <Globe className="w-4 h-4 mr-1" />
                        ) : null}
                        {f}
                      </Button>
                    ),
                  )}
                </div>
              </div>

              {fetchingRepos ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : groupedRepos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {repos.length === 0
                    ? "No repositories found"
                    : "No repositories match your search"}
                </div>
              ) : (
                <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
                  {groupedRepos.map(({ owner, repos: ownerRepos }) => (
                    <div key={owner.login} className="space-y-2">
                      <div className="flex items-center gap-2 sticky top-0 bg-background py-1">
                        <img
                          src={owner.avatar_url}
                          alt={owner.login}
                          className="w-5 h-5 rounded-full"
                        />
                        <span className="text-sm font-medium">
                          {owner.login}
                        </span>
                        {owner.type === "Organization" && (
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>

                      <div className="space-y-1 ml-7">
                        {ownerRepos.map((repo) => (
                          <button
                            key={repo.id}
                            onClick={() => toggleRepo(repo.id)}
                            className={`w-full p-3 text-left rounded-lg border transition-all ${
                              selectedRepos.has(repo.id)
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "hover:border-primary/50 hover:bg-muted/50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium truncate">
                                    {repo.name}
                                  </span>
                                  {repo.private ? (
                                    <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                  ) : (
                                    <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                  )}
                                </div>
                                {repo.description && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {repo.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  {repo.language && (
                                    <span className="flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-primary" />
                                      {repo.language}
                                    </span>
                                  )}
                                  {repo.stargazers_count > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Star className="w-3 h-3" />
                                      {repo.stargazers_count}
                                    </span>
                                  )}
                                  <span>
                                    Updated {formatDate(repo.updated_at)}
                                  </span>
                                </div>
                              </div>
                              <div
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                  selectedRepos.has(repo.id)
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-muted-foreground/30"
                                }`}
                              >
                                {selectedRepos.has(repo.id) && (
                                  <Check className="w-3 h-3" />
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  {selectedRepos.size === 0
                    ? "No repositories selected"
                    : `${selectedRepos.size} ${selectedRepos.size === 1 ? "repository" : "repositories"} selected`}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => router.push("/welcome")}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleContinueToApiKey}
                    disabled={selectedRepos.size === 0}
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Provider Selection & API Key Entry */}
          {step === "apikey" && (
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
                      Loopforge uses AI to analyze your code and generate
                      commits. You pay the AI provider directly for API usage.
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Typical cost: ~$0.01-0.10 per task depending on codebase
                      size.
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
                        onClick={() => handleProviderChange(provider.id)}
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
                          <div className="font-medium text-sm">
                            {provider.name}
                          </div>
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
                    Go to the {currentProvider.name} console to create an API
                    key.
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
                      <span className="text-muted-foreground">
                        Suggested key name:
                      </span>
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
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Shield className="w-4 h-4 text-green-600 dark:text-green-500" />
                      <span>
                        Your API key is encrypted with AES-256-GCM before
                        storage
                      </span>
                    </div>
                  </div>

                  {/* Model Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Model</label>
                    <ModelDropdown
                      provider={currentProvider}
                      selectedModel={selectedModel}
                      onSelect={setSelectedModel}
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
                <Button
                  variant="ghost"
                  onClick={() => setStep("repos")}
                  disabled={loading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleComplete} disabled={!apiKey || loading}>
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
          )}
        </CardContent>
      </Card>
    </main>
  );
}
