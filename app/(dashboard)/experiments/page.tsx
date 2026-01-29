"use client";

import { useState, useEffect } from "react";
import { FlaskConical } from "lucide-react";
import { ExperimentCard } from "@/components/experiments/experiment-card";
import { ExperimentResultsModal } from "@/components/experiments/experiment-results-modal";
import { ExperimentSkeleton } from "@/components/experiments/experiment-skeleton";

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
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <FlaskConical className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Experiments Yet</h2>
        <p className="text-muted-foreground max-w-md">
          A/B testing experiments will appear here. Create experiments via API
          to start testing prompt variants.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Experiments</h1>
          <p className="text-muted-foreground mt-1">
            View and manage A/B testing experiments
          </p>
        </div>
      </div>

      {/* Experiments grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {experiments.map((experiment) => (
          <ExperimentCard
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
  );
}
