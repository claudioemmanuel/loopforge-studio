import {
  Kanban,
  MessageSquare,
  Terminal,
  GitBranch,
  Bot,
  Server,
  BarChart3,
  Github,
  Zap,
  Shield,
  Clock,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/institutional/page-header";

const features = [
  {
    icon: Kanban,
    title: "Visual Kanban Board",
    description:
      "Drag and drop tasks through a 7-stage workflow. From brainstorm to done, every step is visible and trackable. See your entire development pipeline at a glance.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: MessageSquare,
    title: "AI Brainstorming",
    description:
      "Chat with AI before execution. Refine requirements, explore different approaches, and get the implementation plan right before any code is written.",
    color: "text-kanban-brainstorming",
    bg: "bg-kanban-brainstorming/10",
  },
  {
    icon: Terminal,
    title: "Live Execution Logs",
    description:
      "Watch AI think, code, and commit in real-time. Full streaming terminal output with syntax highlighting shows you exactly what's happening.",
    color: "text-kanban-executing",
    bg: "bg-kanban-executing/10",
  },
  {
    icon: GitBranch,
    title: "Direct Git Integration",
    description:
      "AI commits directly to your working branches. Pull requests can be created automatically (optional) or manually from the UI. You review and approve all PRs in GitHub before merging—maintaining full control over what ships to production.",
    color: "text-kanban-done",
    bg: "bg-kanban-done/10",
  },
  {
    icon: Bot,
    title: "Multi-AI Providers",
    description:
      "Choose from Claude, GPT-4, or Gemini for each task. Switch providers on the fly based on task complexity, cost requirements, or personal preference.",
    color: "text-kanban-planning",
    bg: "bg-kanban-planning/10",
  },
  {
    icon: Server,
    title: "Self-Hosted Ready",
    description:
      "Run on your own infrastructure with complete control. Bring your own API keys, keep your code on your servers, and maintain full data sovereignty.",
    color: "text-kanban-ready",
    bg: "bg-kanban-ready/10",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description:
      "Track task completion rates, AI token usage, and execution times. Understand your development velocity and optimize your workflow with data.",
    color: "text-kanban-done",
    bg: "bg-kanban-done/10",
  },
  {
    icon: Github,
    title: "GitHub OAuth",
    description:
      "One-click authentication with GitHub. Connect your repositories instantly and start creating tasks in seconds without complex setup.",
    color: "text-kanban-todo",
    bg: "bg-kanban-todo/10",
  },
  {
    icon: Zap,
    title: "Autonomous Execution",
    description:
      "Set tasks and walk away. AI handles the entire implementation cycle—reading code, making changes, running tests, committing results, and optionally creating pull requests. You review and approve before merging.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Shield,
    title: "Secure by Design",
    description:
      "AES-256-GCM encryption for all credentials. Your API keys and tokens are encrypted at rest, and we never store your code on our servers.",
    color: "text-kanban-stuck",
    bg: "bg-kanban-stuck/10",
  },
  {
    icon: Clock,
    title: "Background Processing",
    description:
      "Queue up multiple tasks and let them execute automatically. Our Redis-powered queue handles task orchestration while you focus on other work.",
    color: "text-kanban-brainstorming",
    bg: "bg-kanban-brainstorming/10",
  },
  {
    icon: Users,
    title: "Team Ready",
    description:
      "Built for collaboration from day one. Share repositories across your team, track who's working on what, and maintain visibility into all active tasks.",
    color: "text-kanban-planning",
    bg: "bg-kanban-planning/10",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHeader
        title="Features"
        subtitle="Everything you need to ship code faster with AI-powered autonomous development"
      />

      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm transition-all duration-300 hover:bg-card/80 hover:shadow-lg hover:-translate-y-1"
            >
              <div
                className={`w-12 h-12 rounded-lg ${feature.bg} flex items-center justify-center mb-4 transition-colors group-hover:scale-110`}
              >
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
