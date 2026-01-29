"use client";

import { cn } from "@/lib/utils";
import { Check, X, Minus } from "lucide-react";
import { Squircle, useSquircle } from "@/components/ui/squircle";

type FeatureValue = "yes" | "no" | "partial";

interface Feature {
  name: string;
  loopforge: FeatureValue;
  linear: FeatureValue;
  jira: FeatureValue;
  notion: FeatureValue;
  asana: FeatureValue;
  isUnique?: boolean;
}

const features: Feature[] = [
  {
    name: "Kanban boards",
    loopforge: "yes",
    linear: "yes",
    jira: "yes",
    notion: "yes",
    asana: "yes",
  },
  {
    name: "AI task assistance",
    loopforge: "yes",
    linear: "yes",
    jira: "partial",
    notion: "yes",
    asana: "yes",
  },
  {
    name: "Autonomous code execution",
    loopforge: "yes",
    linear: "no",
    jira: "no",
    notion: "no",
    asana: "no",
    isUnique: true,
  },
  {
    name: "Real-time execution streaming",
    loopforge: "yes",
    linear: "no",
    jira: "no",
    notion: "no",
    asana: "no",
    isUnique: true,
  },
  {
    name: "Brainstorm → Deploy pipeline",
    loopforge: "yes",
    linear: "no",
    jira: "no",
    notion: "no",
    asana: "no",
    isUnique: true,
  },
  {
    name: "Direct GitHub commits",
    loopforge: "yes",
    linear: "no",
    jira: "no",
    notion: "no",
    asana: "no",
    isUnique: true,
  },
  {
    name: "Multi-provider AI (Claude/GPT/Gemini)",
    loopforge: "yes",
    linear: "no",
    jira: "no",
    notion: "no",
    asana: "no",
    isUnique: true,
  },
  {
    name: "Bring Your Own API Key",
    loopforge: "yes",
    linear: "no",
    jira: "no",
    notion: "no",
    asana: "no",
    isUnique: true,
  },
];

const products = [
  { key: "linear", name: "Linear" },
  { key: "jira", name: "Jira" },
  { key: "notion", name: "Notion" },
  { key: "asana", name: "Asana" },
  { key: "loopforge", name: "Loopforge" },
] as const;

function FeatureIndicator({ value }: { value: FeatureValue }) {
  const squircle = useSquircle({ cornerRadius: "full" });

  if (value === "yes") {
    return (
      <span
        ref={squircle.ref as React.RefObject<HTMLSpanElement>}
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/10"
        style={squircle.style}
      >
        <Check className="w-4 h-4 text-green-500" />
      </span>
    );
  }
  if (value === "partial") {
    return (
      <span
        ref={squircle.ref as React.RefObject<HTMLSpanElement>}
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500/10"
        style={squircle.style}
      >
        <Minus className="w-4 h-4 text-yellow-500" />
      </span>
    );
  }
  return (
    <span
      ref={squircle.ref as React.RefObject<HTMLSpanElement>}
      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted"
      style={squircle.style}
    >
      <X className="w-4 h-4 text-muted-foreground" />
    </span>
  );
}

interface ComparisonTableProps {
  isVisible: boolean;
}

export function ComparisonTable({ isVisible }: ComparisonTableProps) {
  return (
    <Squircle
      cornerRadius="xl"
      borderWidth={1}
      borderColor="hsl(var(--border))"
      className={cn(
        "rounded-xl bg-card transition-all duration-500",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
      style={{ transitionDelay: isVisible ? "200ms" : "0ms" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b">
              <th className="py-4 px-4 text-left text-sm font-medium text-muted-foreground">
                Feature
              </th>
              {products.map((product) => (
                <th
                  key={product.key}
                  className={cn(
                    "py-4 px-4 text-center text-sm font-semibold",
                    product.key === "loopforge" &&
                      "bg-primary/5 text-primary border-x border-primary/20",
                  )}
                >
                  {product.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((feature) => (
              <tr
                key={feature.name}
                className={cn(
                  "border-b last:border-b-0 transition-colors",
                  feature.isUnique && "bg-primary/[0.02]",
                )}
              >
                <td
                  className={cn(
                    "py-4 px-4 text-sm",
                    feature.isUnique && "font-medium text-foreground",
                  )}
                >
                  {feature.name}
                </td>
                {products.map((product) => (
                  <td
                    key={product.key}
                    className={cn(
                      "py-4 px-4 text-center",
                      product.key === "loopforge" &&
                        "bg-primary/5 border-x border-primary/20",
                    )}
                  >
                    <div className="flex justify-center">
                      <FeatureIndicator
                        value={
                          feature[product.key as keyof Feature] as FeatureValue
                        }
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Squircle>
  );
}
