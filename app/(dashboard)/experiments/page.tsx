"use client";

import { useState, useEffect } from "react";
import { FlaskConical, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExperimentFlowCard } from "@/components/experiments/experiment-flow-card";
import { ExperimentResultsModal } from "@/components/experiments/experiment-results-modal";
import { ExperimentSkeleton } from "@/components/experiments/experiment-skeleton";
import { GenerateWizardModal } from "@/components/experiments/generate-wizard-modal";

interface Variant {
  id: string;
  name: string;
  weight: number;
  config: unknown;
}

interface Experiment {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "paused" | "completed";
  trafficAllocation: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  variants: Variant[];
}

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExperiment, setSelectedExperiment] = useState<string | null>(
    null,
  );
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    fetchExperiments();
  }, []);

  async function fetchExperiments() {
    setLoading(true);
    try {
      const response = await fetch("/api/experiments");
      const data = await response.json();
      setExperiments(data.experiments || []);
    } catch (error) {
      console.error("Failed to fetch experiments:", error);
      setExperiments([]);
    } finally {
      setLoading(false);
    }
  }

  function handleWizardSuccess() {
    fetchExperiments();
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Experiments</h1>
            <p className="text-muted-foreground mt-1">
              View and manage A/B testing experiments
            </p>
          </div>
          <Button onClick={() => setShowWizard(true)}>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate with AI
          </Button>
        </div>

        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <ExperimentSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Empty state when no experiments
  if (experiments.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <FlaskConical className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Experiments Yet</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            Create AI-powered A/B testing experiments to optimize your workflow.
            Test different prompts, models, and parameters.
          </p>
          <Button onClick={() => setShowWizard(true)} size="lg">
            <Sparkles className="w-5 h-5 mr-2" />
            Generate with AI
          </Button>
        </div>

        {showWizard && (
          <GenerateWizardModal
            onClose={() => setShowWizard(false)}
            onSuccess={handleWizardSuccess}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Experiments</h1>
            <p className="text-muted-foreground mt-1">
              View and manage A/B testing experiments
            </p>
          </div>
          <Button onClick={() => setShowWizard(true)}>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate with AI
          </Button>
        </div>

        {/* Experiments list with flow visualization */}
        <div className="space-y-4">
          {experiments.map((experiment) => (
            <ExperimentFlowCard
              key={experiment.id}
              experiment={experiment}
              onViewResults={() => setSelectedExperiment(experiment.id)}
              onRefresh={fetchExperiments}
            />
          ))}
        </div>

        {/* Results modal */}
        {selectedExperiment && (
          <ExperimentResultsModal
            experimentId={selectedExperiment}
            onClose={() => setSelectedExperiment(null)}
          />
        )}
      </div>

      {/* Wizard modal */}
      {showWizard && (
        <GenerateWizardModal
          onClose={() => setShowWizard(false)}
          onSuccess={handleWizardSuccess}
        />
      )}
    </>
  );
}
