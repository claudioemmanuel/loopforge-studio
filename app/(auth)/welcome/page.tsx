"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  GitBranch,
  Shield,
  Kanban,
  Bot,
  GitCommit,
  ArrowRight,
  ArrowLeft,
  CheckCircle2
} from "lucide-react";
import { LoopforgeLogo } from "@/components/loopforge-logo";

const STEPS = [
  {
    id: "welcome",
    title: "Welcome to Loopforge Studio",
    subtitle: "AI-Powered Development",
    description: "Transform your ideas into code with autonomous AI agents that understand your codebase and execute tasks directly.",
    icon: null, // Use LoopforgeLogo component instead
    content: (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <Kanban className="w-8 h-8 text-primary mb-2" />
          <h4 className="font-medium">Visual Kanban</h4>
          <p className="text-sm text-muted-foreground">
            Manage tasks with drag-and-drop simplicity
          </p>
        </div>
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <Bot className="w-8 h-8 text-primary mb-2" />
          <h4 className="font-medium">AI Execution</h4>
          <p className="text-sm text-muted-foreground">
            Watch AI think, code, and solve problems
          </p>
        </div>
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <GitCommit className="w-8 h-8 text-primary mb-2" />
          <h4 className="font-medium">Direct Commits</h4>
          <p className="text-sm text-muted-foreground">
            Changes go straight to your branches
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "permissions",
    title: "Repository Access",
    subtitle: "What we access and why",
    description: "Your code is handled securely. Here's exactly what Loopforge Studio does with your repositories:",
    icon: Shield,
    content: (
      <div className="space-y-4 mt-6">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-green-700 dark:text-green-400">We Do</h4>
            <ul className="text-sm text-muted-foreground space-y-1 mt-1">
              <li>• Clone repositories to execute tasks</li>
              <li>• Create branches for isolated changes</li>
              <li>• Commit code changes with clear messages</li>
              <li>• Push commits to your branches</li>
            </ul>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-700 dark:text-blue-400">Security</h4>
            <ul className="text-sm text-muted-foreground space-y-1 mt-1">
              <li>• Your GitHub token is encrypted at rest (AES-256-GCM)</li>
              <li>• Tokens are never logged or exposed</li>
              <li>• You can revoke access anytime from GitHub</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "workflow",
    title: "How It Works",
    subtitle: "From idea to implementation",
    description: "The Loopforge Studio workflow is designed to give you control while automating the tedious parts:",
    icon: GitBranch,
    content: (
      <div className="space-y-3 mt-6">
        {[
          { step: 1, title: "Create a Task", desc: "Describe what you want to build or fix" },
          { step: 2, title: "AI Brainstorms", desc: "Ralph analyzes your codebase and plans the approach" },
          { step: 3, title: "Review the Plan", desc: "Approve, modify, or reject the proposed changes" },
          { step: 4, title: "Execute", desc: "Watch AI implement the plan in real-time" },
          { step: 5, title: "Review & Merge", desc: "Check the commits and merge when ready" },
        ].map(({ step, title, desc }) => (
          <div key={step} className="flex items-center gap-4 p-3 rounded-lg border">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
              {step}
            </div>
            <div className="flex-1">
              <div className="font-medium">{title}</div>
              <div className="text-sm text-muted-foreground">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "ready",
    title: "You're All Set!",
    subtitle: "Let's connect your first repository",
    description: "Now it's time to select a repository and start building with AI-powered development.",
    icon: CheckCircle2,
    content: (
      <div className="mt-6 p-6 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 text-center">
        <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
        <h4 className="text-lg font-medium mb-2">Ready to go!</h4>
        <p className="text-sm text-muted-foreground">
          Click &ldquo;Continue&rdquo; to select your repositories and configure your API key.
        </p>
      </div>
    ),
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = async () => {
    if (isLastStep) {
      // Mark onboarding as started (not completed yet - that happens after repo selection)
      router.push("/onboarding");
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSkip = () => {
    router.push("/onboarding");
  };

  const Icon = step.icon;

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-secondary/30">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-2">
          {/* Progress indicator */}
          <div className="flex justify-center gap-2 mb-4">
            {STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-8 rounded-full transition-colors ${
                  index <= currentStep ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {step.icon === null ? (
            <div className="mx-auto mb-4">
              <LoopforgeLogo size="xl" animate={true} showText={false} />
            </div>
          ) : (
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              {Icon && <Icon className="w-8 h-8 text-primary" />}
            </div>
          )}
          <CardTitle className="text-2xl font-serif">{step.title}</CardTitle>
          <CardDescription className="text-base">{step.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">{step.description}</p>

          {step.content}

          <div className="flex items-center justify-between pt-4">
            <div>
              {!isFirstStep ? (
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              ) : (
                <Button variant="ghost" onClick={handleSkip}>
                  Skip Tutorial
                </Button>
              )}
            </div>
            <Button onClick={handleNext} size="lg">
              {isLastStep ? "Continue to Setup" : "Next"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
