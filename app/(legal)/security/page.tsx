import { Shield, Lock, Key, Server, Eye, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/institutional/page-header";

const securityFeatures = [
  {
    icon: Lock,
    title: "Encryption at Rest",
    description:
      "All sensitive data including API keys and GitHub tokens are encrypted using AES-256-GCM encryption before being stored in our database.",
  },
  {
    icon: Key,
    title: "Encryption in Transit",
    description:
      "All data transmitted between your browser and our servers is protected using TLS 1.3 encryption.",
  },
  {
    icon: Server,
    title: "No Code Storage",
    description:
      "We never permanently store your source code. Repositories are cloned temporarily during task execution and immediately deleted afterward.",
  },
  {
    icon: Eye,
    title: "Minimal Permissions",
    description:
      "We request only the GitHub permissions necessary to function: read user profile, access email, and repository access for connected repos.",
  },
];

const practices = [
  {
    title: "Secure Development",
    items: [
      "Regular dependency updates and security audits",
      "Code review for all changes",
      "Automated security scanning in CI/CD",
      "Input validation and sanitization",
    ],
  },
  {
    title: "Infrastructure Security",
    items: [
      "Containerized deployment with minimal attack surface",
      "Network isolation between services",
      "Regular security patches and updates",
      "Encrypted database connections",
    ],
  },
  {
    title: "Access Control",
    items: [
      "OAuth-based authentication via GitHub",
      "Session management with secure cookies",
      "Rate limiting on API endpoints",
      "Audit logging for sensitive operations",
    ],
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageHeader
        title="Security"
        subtitle="How we protect your data and code"
      />

      <section className="max-w-4xl mx-auto px-6 pb-24">
        {/* Intro */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Security is fundamental to Loopforge Studio. We implement
            industry-standard practices to ensure your code and credentials
            remain protected.
          </p>
        </div>

        {/* Security features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {securityFeatures.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl border border-border bg-card/50"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Detailed practices */}
        <h2 className="text-2xl font-semibold text-center mb-8">
          Security Practices
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {practices.map((practice) => (
            <div
              key={practice.title}
              className="p-6 rounded-xl border border-border bg-card/50"
            >
              <h3 className="font-semibold mb-4">{practice.title}</h3>
              <ul className="space-y-2">
                {practice.items.map((item) => (
                  <li
                    key={item}
                    className="text-sm text-muted-foreground flex items-start gap-2"
                  >
                    <span className="text-primary mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* BYOK section */}
        <div className="p-8 rounded-2xl border border-border bg-card/50 mb-16">
          <h2 className="text-xl font-semibold mb-4">
            Bring Your Own Keys (BYOK)
          </h2>
          <p className="text-muted-foreground mb-4">
            Loopforge uses a BYOK model for AI providers. This means:
          </p>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              You provide your own API keys from Anthropic, OpenAI, or Google
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              Your keys are encrypted with AES-256-GCM before storage
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              Keys are decrypted only when needed for API calls
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              You maintain full control over your AI provider accounts
            </li>
          </ul>
        </div>

        {/* Self-hosted note */}
        <div className="p-8 rounded-2xl border border-primary/20 bg-primary/5 mb-16">
          <h2 className="text-xl font-semibold mb-4">Self-Hosted Option</h2>
          <p className="text-muted-foreground mb-4">
            For maximum security and control, you can self-host Loopforge Studio
            on your own infrastructure:
          </p>
          <ul className="space-y-2 text-muted-foreground mb-6">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              All data stays on your servers
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              Full control over encryption keys
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              Custom security configurations
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              Air-gapped deployment possible
            </li>
          </ul>
          <Link
            href="https://github.com/claudioemmanuel/loopforge-studio#self-hosting"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Learn about self-hosting →
          </Link>
        </div>

        {/* Vulnerability reporting */}
        <div className="p-8 rounded-2xl border border-border bg-card/50">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-kanban-stuck/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-kanban-stuck" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">
                Report a Vulnerability
              </h2>
              <p className="text-muted-foreground mb-4">
                If you discover a security vulnerability, please report it
                responsibly. We appreciate your help in keeping Loopforge
                secure.
              </p>
              <p className="text-sm">
                Email:{" "}
                <a
                  href="mailto:security@loopforge.dev"
                  className="text-primary hover:underline"
                >
                  security@loopforge.dev
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
