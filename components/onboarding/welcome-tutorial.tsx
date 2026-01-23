"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoopforgeLogo } from "@/components/loopforge-logo";
import {
  MessageSquarePlus,
  Sparkles,
  Code2,
  GitPullRequest,
  ArrowRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WelcomeTutorialProps {
  onComplete: () => void;
}

const steps = [
  {
    icon: MessageSquarePlus,
    title: "Create Tasks",
    description: "Describe what you want to build in plain language",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: Sparkles,
    title: "AI Brainstorms Ideas",
    description: "Get creative suggestions and approaches for your task",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
  },
  {
    icon: Code2,
    title: "AI Writes Code",
    description: "Watch as AI implements your feature with real commits",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    icon: GitPullRequest,
    title: "Review & Merge",
    description: "Review the changes and merge when ready",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
];

export function WelcomeTutorial({ onComplete }: WelcomeTutorialProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  const handleDismiss = () => {
    setIsAnimatingOut(true);
    // Store that welcome has been shown
    localStorage.setItem("loopforge-welcome-shown", "true");
    // Wait for animation to complete
    setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 200);
  };

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6",
        isAnimatingOut ? "animate-out fade-out duration-200" : "animate-in fade-in duration-300"
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div
        className={cn(
          "relative w-full max-w-2xl overflow-hidden bg-card rounded-2xl shadow-2xl border",
          isAnimatingOut ? "animate-out zoom-out-95 duration-200" : "animate-in zoom-in-95 duration-300"
        )}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8 sm:p-10">
          {/* Logo and welcome message */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="mb-4">
              <LoopforgeLogo size="xl" animate showSparks />
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight mb-2">
              Welcome to <span className="text-primary">Loop</span>forge
            </h1>
            <p className="text-muted-foreground max-w-md">
              Your AI-powered development companion. Turn ideas into code with a simple workflow.
            </p>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 border border-border/50"
                  style={{
                    animationDelay: `${(index + 1) * 100}ms`,
                  }}
                >
                  <div className={cn("p-2.5 rounded-lg", step.bgColor)}>
                    <Icon className={cn("w-5 h-5", step.color)} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-0.5">
                      {index + 1}. {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center">
            <Button
              size="lg"
              className="gap-2 px-8"
              onClick={handleDismiss}
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              You can find help anytime in the settings
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
