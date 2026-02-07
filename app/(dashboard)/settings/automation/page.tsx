"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  type Node,
  type NodeProps,
  type NodeTypes,
  Position,
  ReactFlow,
  Handle,
} from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useTranslations } from "next-intl";
import { Check, X, Loader2, FolderOpen, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import "@xyflow/react/dist/style.css";

type StepId =
  | "clone-directory"
  | "test-defaults"
  | "default-behaviors"
  | "review";

type TestGatePolicy = "strict" | "warn" | "skip" | "autoApprove";

interface AutomationSettings {
  defaultCloneDirectory: string;
  expandedCloneDirectory: string;
  defaultTestCommand: string;
  defaultTestTimeout: number;
  defaultTestGatePolicy: TestGatePolicy;
  defaultBranchPrefix: string;
  requirePlanApproval: boolean;
}

interface CloneValidation {
  valid: boolean;
  exists: boolean;
  writable: boolean;
  error?: string;
}

interface StepNodeData extends Record<string, unknown> {
  title: string;
  description: string;
  isActive: boolean;
  isComplete: boolean;
}

const STEP_ORDER: StepId[] = [
  "clone-directory",
  "test-defaults",
  "default-behaviors",
  "review",
];

const gatePolicyOptions: TestGatePolicy[] = [
  "strict",
  "warn",
  "skip",
  "autoApprove",
];

const commonPaths = [
  { label: "~/Documents/GitHub", path: "~/Documents/GitHub" },
  { label: "~/Projects", path: "~/Projects" },
  { label: "~/Developer", path: "~/Developer" },
  { label: "~/Code", path: "~/Code" },
];

const AutomationStepNode = memo((props: NodeProps) => {
  const data = props.data as unknown as StepNodeData;

  return (
    <div
      className={cn(
        "w-[220px] rounded-xl border px-3 py-2 transition-all",
        data.isActive
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card shadow-sm",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-primary/70"
      />
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{data.title}</p>
        {data.isComplete ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <div className="h-4 w-4 rounded-full border border-muted-foreground/40" />
        )}
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground">
        {data.description}
      </p>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-primary/70"
      />
    </div>
  );
});

AutomationStepNode.displayName = "AutomationStepNode";

function normalizeBranchPrefix(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export default function AutomationSettingsPage() {
  const t = useTranslations("settings.workflowPage");
  const { toast } = useToast();

  const [settings, setSettings] = useState<AutomationSettings>({
    defaultCloneDirectory: "",
    expandedCloneDirectory: "",
    defaultTestCommand: "",
    defaultTestTimeout: 300000,
    defaultTestGatePolicy: "warn",
    defaultBranchPrefix: "loopforge/",
    requirePlanApproval: true,
  });
  const [activeStep, setActiveStep] = useState<StepId>("clone-directory");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validatingClonePath, setValidatingClonePath] = useState(false);
  const [cloneValidation, setCloneValidation] =
    useState<CloneValidation | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/settings/automation");
        if (!response.ok) {
          throw new Error("Failed to load automation settings");
        }

        const data = await response.json();
        setSettings({
          defaultCloneDirectory: data.defaultCloneDirectory ?? "",
          expandedCloneDirectory: data.expandedCloneDirectory ?? "",
          defaultTestCommand: data.defaultTestCommand ?? "",
          defaultTestTimeout: data.defaultTestTimeout ?? 300000,
          defaultTestGatePolicy: data.defaultTestGatePolicy ?? "warn",
          defaultBranchPrefix: data.defaultBranchPrefix ?? "loopforge/",
          requirePlanApproval: data.requirePlanApproval ?? true,
        });
      } catch (error) {
        toast({
          title: t("loadFailed"),
          description:
            error instanceof Error ? error.message : t("unknownError"),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [t, toast]);

  useEffect(() => {
    if (!settings.defaultCloneDirectory) {
      setCloneValidation(null);
      setSettings((previous) => ({ ...previous, expandedCloneDirectory: "" }));
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setValidatingClonePath(true);
        const response = await fetch("/api/settings/clone-directory/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: settings.defaultCloneDirectory }),
        });
        const data = await response.json();
        setCloneValidation(data.validation ?? null);
        setSettings((previous) => ({
          ...previous,
          expandedCloneDirectory: data.expanded ?? "",
        }));
      } catch {
        setCloneValidation({
          valid: false,
          exists: false,
          writable: false,
          error: t("validationFailed"),
        });
      } finally {
        setValidatingClonePath(false);
      }
    }, 450);

    return () => clearTimeout(timeoutId);
  }, [settings.defaultCloneDirectory, t]);

  const cloneStepComplete = Boolean(
    settings.defaultCloneDirectory && cloneValidation?.valid,
  );
  const timeoutSeconds = Math.floor(settings.defaultTestTimeout / 1000);
  const testStepComplete =
    timeoutSeconds >= 30 &&
    timeoutSeconds <= 3600 &&
    Boolean(settings.defaultTestGatePolicy);
  const behaviorsStepComplete = Boolean(settings.defaultBranchPrefix.trim());
  const reviewStepComplete =
    cloneStepComplete && testStepComplete && behaviorsStepComplete;

  const stepMeta = useMemo(
    () =>
      ({
        "clone-directory": {
          title: t("steps.cloneDirectory.title"),
          description: t("steps.cloneDirectory.description"),
          isComplete: cloneStepComplete,
        },
        "test-defaults": {
          title: t("steps.testDefaults.title"),
          description: t("steps.testDefaults.description"),
          isComplete: testStepComplete,
        },
        "default-behaviors": {
          title: t("steps.defaultBehaviors.title"),
          description: t("steps.defaultBehaviors.description"),
          isComplete: behaviorsStepComplete,
        },
        review: {
          title: t("steps.review.title"),
          description: t("steps.review.description"),
          isComplete: reviewStepComplete,
        },
      }) satisfies Record<
        StepId,
        { title: string; description: string; isComplete: boolean }
      >,
    [
      behaviorsStepComplete,
      cloneStepComplete,
      reviewStepComplete,
      t,
      testStepComplete,
    ],
  );

  const flowNodes = useMemo<Node[]>(() => {
    return STEP_ORDER.map((step, index) => ({
      id: step,
      type: "automationStep",
      position: { x: index * 245, y: 30 },
      data: {
        title: stepMeta[step].title,
        description: stepMeta[step].description,
        isActive: activeStep === step,
        isComplete: stepMeta[step].isComplete,
      } as StepNodeData,
    }));
  }, [activeStep, stepMeta]);

  const flowEdges = useMemo(() => {
    return STEP_ORDER.slice(0, -1).map((step, index) => ({
      id: `${step}->${STEP_ORDER[index + 1]}`,
      source: step,
      target: STEP_ORDER[index + 1],
      type: "smoothstep",
      style: { stroke: "#6b7280", strokeWidth: 2 },
      animated: false,
    }));
  }, []);

  const nodeTypes: NodeTypes = useMemo(
    () => ({ automationStep: AutomationStepNode }),
    [],
  );

  const stepIndex = STEP_ORDER.indexOf(activeStep);

  const handleNextStep = () => {
    if (stepIndex < STEP_ORDER.length - 1) {
      setActiveStep(STEP_ORDER[stepIndex + 1]);
    }
  };

  const handlePreviousStep = () => {
    if (stepIndex > 0) {
      setActiveStep(STEP_ORDER[stepIndex - 1]);
    }
  };

  const handleSave = async () => {
    if (!cloneStepComplete) {
      toast({
        title: t("invalidDirectory"),
        description: cloneValidation?.error || t("pleaseEnterValid"),
        variant: "destructive",
      });
      setActiveStep("clone-directory");
      return;
    }

    if (!behaviorsStepComplete) {
      toast({
        title: t("invalidDefaults"),
        description: t("defaultBranchPrefixRequired"),
        variant: "destructive",
      });
      setActiveStep("default-behaviors");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/settings/automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultCloneDirectory: settings.defaultCloneDirectory,
          defaultTestCommand: settings.defaultTestCommand || null,
          defaultTestTimeout: settings.defaultTestTimeout,
          defaultTestGatePolicy: settings.defaultTestGatePolicy,
          defaultBranchPrefix: normalizeBranchPrefix(
            settings.defaultBranchPrefix,
          ),
          requirePlanApproval: settings.requirePlanApproval,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("saveFailed"));
      }

      setSettings((previous) => ({
        ...previous,
        defaultBranchPrefix:
          data.defaultBranchPrefix ?? previous.defaultBranchPrefix,
        expandedCloneDirectory:
          data.expandedCloneDirectory ?? previous.expandedCloneDirectory,
      }));

      toast({
        title: t("configurationSaved"),
        description: t("automationDefaultsUpdated"),
      });
    } catch (error) {
      toast({
        title: t("failedToSave"),
        description: error instanceof Error ? error.message : t("unknownError"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-2xl font-serif font-semibold tracking-tight">
          {t("title")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-xl border bg-card p-3">
          <div className="mb-3 px-2">
            <p className="text-sm font-medium">{t("flowTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("flowSubtitle")}</p>
          </div>
          <div className="h-[260px] rounded-lg border bg-background/40">
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => setActiveStep(node.id as StepId)}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          {activeStep === "clone-directory" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                <h3 className="font-serif font-semibold tracking-tight">
                  {t("cloneDirectory")}
                </h3>
              </div>

              <p className="text-sm text-muted-foreground">
                {t("cloneDirectoryDescription")}
              </p>

              <div className="space-y-2">
                <Label htmlFor="clone-directory">{t("pathLabel")}</Label>
                <div className="relative">
                  <Input
                    id="clone-directory"
                    placeholder={t("placeholder")}
                    value={settings.defaultCloneDirectory}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        defaultCloneDirectory: event.target.value,
                      }))
                    }
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {validatingClonePath ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : cloneValidation?.valid ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : cloneValidation ? (
                      <X className="h-4 w-4 text-destructive" />
                    ) : null}
                  </div>
                </div>
              </div>

              {settings.expandedCloneDirectory ? (
                <p className="text-xs text-muted-foreground">
                  {t("expandsTo")}{" "}
                  <code className="rounded bg-muted px-1 py-0.5">
                    {settings.expandedCloneDirectory}
                  </code>
                </p>
              ) : null}

              {cloneValidation &&
              !cloneValidation.valid &&
              cloneValidation.error ? (
                <p className="text-xs text-destructive">
                  {cloneValidation.error}
                </p>
              ) : null}

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  {t("commonPaths")}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {commonPaths.map((item) => (
                    <Button
                      key={item.path}
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSettings((previous) => ({
                          ...previous,
                          defaultCloneDirectory: item.path,
                        }))
                      }
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeStep === "test-defaults" ? (
            <div className="space-y-4">
              <h3 className="font-serif font-semibold tracking-tight">
                {t("steps.testDefaults.title")}
              </h3>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {t("testDefaultsDescription")}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="test-command">
                  {t("testDefaults.command")}
                </Label>
                <Input
                  id="test-command"
                  placeholder={t("testDefaults.commandPlaceholder")}
                  value={settings.defaultTestCommand}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      defaultTestCommand: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-timeout">
                  {t("testDefaults.timeout")}
                </Label>
                <Input
                  id="test-timeout"
                  type="number"
                  min={30}
                  max={3600}
                  step={30}
                  value={timeoutSeconds}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      defaultTestTimeout:
                        Math.max(30, Number(event.target.value || 300)) * 1000,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{t("testDefaults.gatePolicy")}</Label>
                <div className="space-y-2">
                  {gatePolicyOptions.map((policy) => (
                    <label
                      key={policy}
                      className="flex cursor-pointer items-start gap-2 rounded-lg border p-2"
                    >
                      <input
                        type="radio"
                        name="gate-policy"
                        checked={settings.defaultTestGatePolicy === policy}
                        onChange={() =>
                          setSettings((previous) => ({
                            ...previous,
                            defaultTestGatePolicy: policy,
                          }))
                        }
                      />
                      <span className="text-sm">
                        {t(`testDefaults.policy.${policy}`)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeStep === "default-behaviors" ? (
            <div className="space-y-4">
              <h3 className="font-serif font-semibold tracking-tight">
                {t("defaultBehaviors.title")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("defaultBehaviors.description")}
              </p>

              <div className="space-y-2">
                <Label htmlFor="default-branch-prefix">
                  {t("defaultBehaviors.branchPrefix")}
                </Label>
                <Input
                  id="default-branch-prefix"
                  placeholder={t("defaultBehaviors.branchPrefixPlaceholder")}
                  value={settings.defaultBranchPrefix}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      defaultBranchPrefix: event.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("defaultBehaviors.branchPrefixHint")}
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">
                    {t("defaultBehaviors.requirePlanApproval")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("defaultBehaviors.requirePlanApprovalHint")}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setSettings((previous) => ({
                      ...previous,
                      requirePlanApproval: !previous.requirePlanApproval,
                    }))
                  }
                  className={cn(
                    "relative h-6 w-10 rounded-full transition-colors",
                    settings.requirePlanApproval ? "bg-primary" : "bg-muted",
                  )}
                  type="button"
                >
                  <span
                    className={cn(
                      "absolute top-1 h-4 w-4 rounded-full bg-white transition-transform",
                      settings.requirePlanApproval
                        ? "translate-x-5"
                        : "translate-x-1",
                    )}
                  />
                </button>
              </div>
            </div>
          ) : null}

          {activeStep === "review" ? (
            <div className="space-y-4">
              <h3 className="font-serif font-semibold tracking-tight">
                {t("review.title")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("review.description")}
              </p>

              <div className="space-y-2">
                {STEP_ORDER.filter((step) => step !== "review").map((step) => (
                  <div
                    key={step}
                    className="flex items-center justify-between rounded-lg border p-2"
                  >
                    <span className="text-sm">{stepMeta[step].title}</span>
                    {stepMeta[step].isComplete ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        {t("review.complete")}
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        {t("review.needsAttention")}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePreviousStep}
              disabled={stepIndex === 0}
            >
              {t("actions.back")}
            </Button>

            {activeStep === "review" ? (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("actions.saving")}
                  </>
                ) : (
                  t("actions.saveAll")
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNextStep}
                disabled={stepIndex >= STEP_ORDER.length - 1}
              >
                {t("actions.next")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
