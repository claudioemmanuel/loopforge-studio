"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LoopforgeLogo } from "@/components/loopforge-logo";
import {
  GitHubRepo,
  FilterType,
  Step,
  Provider,
  providers,
} from "./onboarding-config";
import { StepRepos } from "./step-repos";
import { StepApiKey } from "./step-api-key";

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
            <StepRepos
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filter={filter}
              onFilterChange={setFilter}
              fetchingRepos={fetchingRepos}
              repos={repos}
              groupedRepos={groupedRepos}
              selectedRepos={selectedRepos}
              onToggleRepo={toggleRepo}
              onContinue={handleContinueToApiKey}
              onBack={() => router.push("/welcome")}
              formatDate={formatDate}
            />
          )}

          {/* Step 2: Provider Selection & API Key Entry */}
          {step === "apikey" && (
            <StepApiKey
              providers={providers}
              currentProvider={currentProvider}
              selectedProvider={selectedProvider}
              onProviderChange={handleProviderChange}
              apiKey={apiKey}
              onApiKeyChange={setApiKey}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              repos={repos}
              selectedRepos={selectedRepos}
              loading={loading}
              onComplete={handleComplete}
              onBack={() => setStep("repos")}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
