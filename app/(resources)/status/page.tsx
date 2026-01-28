import { CheckCircle, Circle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/institutional/page-header";

const services = [
  {
    name: "Web Application",
    status: "operational",
    description: "Dashboard, Kanban board, and all web features",
  },
  {
    name: "GitHub Integration",
    status: "operational",
    description: "OAuth authentication and repository access",
  },
  {
    name: "Task Execution",
    status: "operational",
    description: "Background workers and AI execution engine",
  },
  {
    name: "AI Providers",
    status: "operational",
    description: "Anthropic, OpenAI, and Google Gemini APIs",
  },
  {
    name: "Database",
    status: "operational",
    description: "PostgreSQL data storage",
  },
  {
    name: "Queue System",
    status: "operational",
    description: "Redis and BullMQ job processing",
  },
];

function StatusBadge({ status }: { status: string }) {
  if (status === "operational") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
        <CheckCircle className="w-3 h-3" />
        Operational
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500">
      <Circle className="w-3 h-3" />
      Degraded
    </span>
  );
}

export default function StatusPage() {
  const allOperational = services.every((s) => s.status === "operational");

  return (
    <>
      <PageHeader
        title="System Status"
        subtitle="Real-time status of Loopforge Studio services"
      />

      <section className="max-w-3xl mx-auto px-6 pb-24">
        {/* Overall status banner */}
        <div
          className={`p-6 rounded-xl border mb-8 text-center ${
            allOperational
              ? "border-green-500/30 bg-green-500/5"
              : "border-yellow-500/30 bg-yellow-500/5"
          }`}
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            {allOperational ? (
              <CheckCircle className="w-8 h-8 text-green-500" />
            ) : (
              <Circle className="w-8 h-8 text-yellow-500" />
            )}
            <h2 className="text-2xl font-semibold">
              {allOperational
                ? "All Systems Operational"
                : "Partial Service Disruption"}
            </h2>
          </div>
          <p className="text-muted-foreground">
            Last updated: {new Date().toLocaleString()}
          </p>
        </div>

        {/* Service list */}
        <div className="space-y-4">
          {services.map((service) => (
            <div
              key={service.name}
              className="p-4 rounded-xl border border-border bg-card/50 flex items-center justify-between"
            >
              <div>
                <h3 className="font-medium">{service.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {service.description}
                </p>
              </div>
              <StatusBadge status={service.status} />
            </div>
          ))}
        </div>

        {/* Self-hosted note */}
        <div className="mt-12 p-6 rounded-xl border border-border bg-card/50 text-center">
          <h3 className="font-semibold mb-2">Self-Hosted?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            If you&apos;re running Loopforge on your own infrastructure, your
            uptime depends on your deployment. Check your Docker logs and
            service health.
          </p>
          <Link
            href="https://github.com/claudioemmanuel/loopforge-studio#deployment"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            Deployment Guide
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </section>
    </>
  );
}
