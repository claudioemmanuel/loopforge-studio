"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProviderConfig } from "./onboarding-config";

export function ModelDropdown({
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
