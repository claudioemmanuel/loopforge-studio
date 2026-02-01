"use client";

import { useState } from "react";
import {
  X,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Loader2,
  Check,
} from "lucide-react";
import { MessageSquare, FileCode, Code, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TestAreaCard } from "./test-area-card";
import { AIQuestionInput } from "./ai-question-input";
import { VariantConfigPreview } from "./variant-config-preview";
import type { TestArea } from "@/lib/ai/experiment-generator";
import type { ExperimentVariantConfig } from "@/lib/db/schema/types";

interface GenerateWizardModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type WizardStep = 1 | 2 | 3 | 4;

interface GeneratedVariant {
  name: string;
  weight: number;
  config: ExperimentVariantConfig;
}

interface GeneratedExperiment {
  experimentName: string;
  experimentDescription: string;
  variants: GeneratedVariant[];
}

// Test area configurations
const testAreaConfig = {
  brainstorming: {
    icon: MessageSquare,
    title: "Brainstorming",
    description:
      "Test different brainstorming conversation styles and approaches",
    examples: ["Speed vs. thoroughness", "Technical vs. business focus"],
  },
  planning: {
    icon: FileCode,
    title: "Planning",
    description: "Experiment with plan generation granularity and structure",
    examples: ["Step-by-step vs. milestones", "With/without file paths"],
  },
  code_generation: {
    icon: Code,
    title: "Code Generation",
    description: "Test autonomous coding styles and refactoring approaches",
    examples: ["Conservative vs. aggressive", "Comment density"],
  },
  model_params: {
    icon: Settings,
    title: "Model Parameters",
    description: "Optimize temperature, tokens, and other model settings",
    examples: ["Quality vs. cost", "Creativity vs. consistency"],
  },
};

// Questions per test area
const testAreaQuestions: Record<
  TestArea,
  Array<{
    id: string;
    question: string;
    type: "text" | "radio";
    options?: string[];
  }>
> = {
  brainstorming: [
    {
      id: "speed_vs_thoroughness",
      question: "Do you prioritize speed or thoroughness?",
      type: "radio",
      options: ["Speed", "Thoroughness", "Balanced"],
    },
    {
      id: "focus",
      question: "Should the AI focus on technical details or business context?",
      type: "radio",
      options: ["Technical details", "Business context", "Both equally"],
    },
  ],
  planning: [
    {
      id: "granularity",
      question:
        "Do you prefer detailed step-by-step plans or high-level milestones?",
      type: "radio",
      options: ["Detailed steps", "High-level milestones", "Mix of both"],
    },
    {
      id: "file_paths",
      question: "Should file paths be included in the plan?",
      type: "radio",
      options: [
        "Yes, always",
        "No, keep it high-level",
        "Only for critical files",
      ],
    },
  ],
  code_generation: [
    {
      id: "refactoring_style",
      question: "Should refactoring be conservative, moderate, or aggressive?",
      type: "radio",
      options: ["Conservative", "Moderate", "Aggressive"],
    },
    {
      id: "comment_density",
      question: "What level of code comments do you prefer?",
      type: "radio",
      options: ["Minimal", "Moderate", "Comprehensive"],
    },
  ],
  model_params: [
    {
      id: "optimization_goal",
      question: "Should we optimize for quality or cost?",
      type: "radio",
      options: ["Quality", "Cost", "Balanced"],
    },
    {
      id: "risk_tolerance",
      question: "What's your tolerance for creative/risky outputs?",
      type: "radio",
      options: ["Low (conservative)", "Medium", "High (creative)"],
    },
  ],
};

export function GenerateWizardModal({
  onClose,
  onSuccess,
}: GenerateWizardModalProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedTestArea, setSelectedTestArea] = useState<TestArea | null>(
    null,
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generatedExperiment, setGeneratedExperiment] =
    useState<GeneratedExperiment | null>(null);
  const [experimentName, setExperimentName] = useState("");
  const [trafficAllocation, setTrafficAllocation] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = async () => {
    if (step === 1 && !selectedTestArea) {
      setError("Please select a test area");
      return;
    }

    if (step === 2) {
      // Validate all questions are answered
      if (!selectedTestArea) return;
      const questions = testAreaQuestions[selectedTestArea];
      const unanswered = questions.find((q) => !answers[q.id]);
      if (unanswered) {
        setError("Please answer all questions");
        return;
      }

      // Generate experiment using AI
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/experiments/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            testArea: selectedTestArea,
            userAnswers: answers,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to generate experiment");
        }

        const data = await response.json();
        setGeneratedExperiment(data.experiment);
        setExperimentName(data.experiment.name);
        setStep(3);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (step === 3) {
      setStep(4);
      return;
    }

    if (step === 4) {
      // Create experiment
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/experiments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: experimentName,
            description: generatedExperiment?.experimentDescription || "",
            trafficAllocation,
            variants: generatedExperiment?.variants || [],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create experiment");
        }

        onSuccess();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as WizardStep);
      setError(null);
    }
  };

  const canProceed = () => {
    if (step === 1) return selectedTestArea !== null;
    if (step === 2) {
      if (!selectedTestArea) return false;
      const questions = testAreaQuestions[selectedTestArea];
      return questions.every((q) => answers[q.id]);
    }
    if (step === 3) return generatedExperiment !== null;
    if (step === 4) return experimentName.trim().length > 0;
    return false;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-card rounded-2xl shadow-2xl border animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">
                Generate Experiment with AI
              </h2>
              <p className="text-sm text-muted-foreground">Step {step} of 4</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Step 1: Choose Test Area */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Choose Test Area</h3>
                <p className="text-sm text-muted-foreground">
                  Select which aspect of the AI workflow you want to experiment
                  with
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.keys(testAreaConfig) as TestArea[]).map((area) => {
                  const config = testAreaConfig[area];
                  return (
                    <TestAreaCard
                      key={area}
                      icon={config.icon}
                      title={config.title}
                      description={config.description}
                      examples={config.examples}
                      selected={selectedTestArea === area}
                      onClick={() => {
                        setSelectedTestArea(area);
                        setError(null);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: AI Questions */}
          {step === 2 && selectedTestArea && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Answer a Few Questions
                </h3>
                <p className="text-sm text-muted-foreground">
                  Help the AI understand your preferences for this experiment
                </p>
              </div>

              <div className="space-y-6">
                {testAreaQuestions[selectedTestArea].map((question, idx) => (
                  <AIQuestionInput
                    key={question.id}
                    question={question.question}
                    questionId={question.id}
                    type={question.type}
                    options={question.options}
                    value={answers[question.id] || ""}
                    onChange={(value) => {
                      setAnswers({ ...answers, [question.id]: value });
                      setError(null);
                    }}
                    animated={idx > 0}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Review Generated Config */}
          {step === 3 && generatedExperiment && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Review Generated Variants
                </h3>
                <p className="text-sm text-muted-foreground">
                  {generatedExperiment.experimentDescription}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {generatedExperiment.variants.map((variant, idx) => (
                  <VariantConfigPreview
                    key={idx}
                    variantName={variant.name}
                    weight={variant.weight}
                    config={variant.config}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Confirm & Create */}
          {step === 4 && generatedExperiment && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Confirm & Create</h3>
                <p className="text-sm text-muted-foreground">
                  Review final settings and create your experiment
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="experiment-name">Experiment Name</Label>
                  <Input
                    id="experiment-name"
                    value={experimentName}
                    onChange={(e) => setExperimentName(e.target.value)}
                    placeholder="Enter experiment name..."
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="traffic-allocation">
                    Traffic Allocation ({trafficAllocation}%)
                  </Label>
                  <input
                    id="traffic-allocation"
                    type="range"
                    min="1"
                    max="100"
                    value={trafficAllocation}
                    onChange={(e) =>
                      setTrafficAllocation(Number(e.target.value))
                    }
                    className="w-full mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Percentage of new tasks that will be assigned to this
                    experiment
                  </p>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
                  <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-100 mb-2">
                    What will happen:
                  </h4>
                  <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                    <li className="flex items-start gap-2">
                      <Check className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>
                        {trafficAllocation}% of new tasks will be randomly
                        assigned to one of the 3 variants
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>
                        Metrics will be collected automatically during execution
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>
                        Statistical analysis will determine the winning variant
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-muted/30">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 1 || loading}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Button
            onClick={handleNext}
            disabled={!canProceed() || loading}
            className={cn(step === 4 && "bg-primary")}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {step === 2 ? "Generating..." : "Creating..."}
              </>
            ) : step === 4 ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Create Experiment
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
