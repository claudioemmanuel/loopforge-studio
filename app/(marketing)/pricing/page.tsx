import Link from "next/link";
import { PageHeader } from "@/components/institutional/page-header";

export default function PricingPage() {
  return (
    <>
      <PageHeader
        title="Open Source &amp; Free to Self-Host"
        subtitle="Loopforge Studio is open source. Deploy it yourself and keep full control."
      />

      <section className="max-w-3xl mx-auto px-6 pb-24">
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <h3 className="text-2xl font-semibold mb-4">
            Loopforge Studio is open source and free to self-host
          </h3>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            There are no plans, no tiers, and no paywalls. Clone the repository,
            deploy with Docker, and connect your own AI provider API keys to get
            started in minutes.
          </p>
          <Link
            href="https://github.com/loopforge/loopforge-studio"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block py-3 px-8 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
          >
            Get Started on GitHub
          </Link>
        </div>

        <div className="mt-16 text-center">
          <h3 className="text-xl font-semibold mb-4">
            Frequently Asked Questions
          </h3>
          <div className="max-w-2xl mx-auto space-y-6 text-left">
            <div>
              <h4 className="font-medium mb-2">
                Do I need to provide my own API keys?
              </h4>
              <p className="text-muted-foreground text-sm">
                Yes, Loopforge uses a BYOK (Bring Your Own Key) model. You
                provide your own API keys from Anthropic, OpenAI, or Google,
                giving you full control over costs and usage.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">How do I deploy?</h4>
              <p className="text-muted-foreground text-sm">
                Clone the repository and follow the setup guide in the README.
                Docker Compose is included for a one-command local deployment.
                All features work identically in self-hosted mode.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">What happens to my code?</h4>
              <p className="text-muted-foreground text-sm">
                Your code stays on your infrastructure. Loopforge clones repos
                temporarily during execution and deletes them immediately after.
                Running self-hosted means nothing leaves your network.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
