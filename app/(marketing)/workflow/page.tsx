import {
  PlusCircle,
  MessageSquare,
  FileText,
  CheckCircle,
  Cpu,
  GitPullRequest,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/institutional/page-header";

const steps = [
  {
    number: 1,
    icon: PlusCircle,
    title: "Create Task",
    status: "Todo",
    description:
      "Start by describing what you want to build. Be as specific or high-level as you like—the AI will help clarify requirements during brainstorming.",
    color: "text-kanban-todo",
    bg: "bg-kanban-todo/10",
    border: "border-kanban-todo/30",
  },
  {
    number: 2,
    icon: MessageSquare,
    title: "Brainstorm",
    status: "Brainstorming",
    description:
      "Chat with AI to refine your idea. Discuss approaches, ask questions, and explore edge cases. The AI learns your codebase structure during this phase.",
    color: "text-kanban-brainstorming",
    bg: "bg-kanban-brainstorming/10",
    border: "border-kanban-brainstorming/30",
  },
  {
    number: 3,
    icon: FileText,
    title: "Review Plan",
    status: "Planning",
    description:
      "AI generates a detailed execution plan showing exactly what files will be changed and how. Review and approve before any code is written.",
    color: "text-kanban-planning",
    bg: "bg-kanban-planning/10",
    border: "border-kanban-planning/30",
  },
  {
    number: 4,
    icon: CheckCircle,
    title: "Approve",
    status: "Ready",
    description:
      "Once you're satisfied with the plan, approve it for execution. The task enters the queue and will be picked up by the worker automatically.",
    color: "text-kanban-ready",
    bg: "bg-kanban-ready/10",
    border: "border-kanban-ready/30",
  },
  {
    number: 5,
    icon: Cpu,
    title: "Execute",
    status: "Executing",
    description:
      "Watch AI implement your changes in real-time. See every file read, code edit, and terminal command as it happens with live streaming logs.",
    color: "text-kanban-executing",
    bg: "bg-kanban-executing/10",
    border: "border-kanban-executing/30",
  },
  {
    number: 6,
    icon: GitPullRequest,
    title: "Ship",
    status: "Done",
    description:
      "Changes are committed to your branch and a pull request is created. Review the diff, run your CI, and merge when ready.",
    color: "text-kanban-done",
    bg: "bg-kanban-done/10",
    border: "border-kanban-done/30",
  },
];

export default function WorkflowPage() {
  return (
    <>
      <PageHeader
        title="How It Works"
        subtitle="A visual, 6-step workflow that takes tasks from idea to shipped code"
      />

      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="relative">
          {/* Connection line */}
          <div className="absolute left-8 top-0 bottom-0 w-px bg-border hidden md:block" />

          <div className="space-y-8">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {/* Step card */}
                <div
                  className={`md:ml-20 p-6 rounded-xl border ${step.border} bg-card/50 backdrop-blur-sm transition-all duration-300 hover:bg-card/80 hover:shadow-lg`}
                >
                  <div className="flex items-start gap-4">
                    {/* Mobile step number */}
                    <div
                      className={`md:hidden flex-shrink-0 w-12 h-12 rounded-full ${step.bg} flex items-center justify-center`}
                    >
                      <span className={`text-lg font-bold ${step.color}`}>
                        {step.number}
                      </span>
                    </div>

                    {/* Desktop step indicator */}
                    <div
                      className={`hidden md:flex absolute -left-2 w-16 h-16 rounded-full ${step.bg} border-4 border-background items-center justify-center`}
                    >
                      <step.icon className={`w-7 h-7 ${step.color}`} />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{step.title}</h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${step.bg} ${step.color}`}
                        >
                          {step.status}
                        </span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Arrow between steps */}
                {index < steps.length - 1 && (
                  <div className="flex justify-center my-4 md:hidden">
                    <ArrowRight className="w-5 h-5 text-muted-foreground rotate-90" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="mt-16 p-8 rounded-2xl border border-primary/20 bg-primary/5 text-center">
          <h3 className="text-2xl font-semibold mb-4">
            Ship Code While You Sleep
          </h3>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Queue up tasks at the end of your day. Wake up to completed pull
            requests with fully implemented features, bug fixes, and
            refactoring—all ready for review.
          </p>
        </div>
      </section>
    </>
  );
}
