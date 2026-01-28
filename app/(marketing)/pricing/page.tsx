import { Check, X } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/institutional/page-header";

const plans = [
  {
    name: "Free",
    description: "For individual developers exploring AI-powered coding",
    price: "$0",
    period: "forever",
    cta: "Get Started",
    ctaHref: "/login",
    highlighted: false,
    features: [
      { name: "Unlimited tasks", included: true },
      { name: "3 connected repositories", included: true },
      { name: "Bring your own API keys", included: true },
      { name: "Full brainstorming features", included: true },
      { name: "Live execution logs", included: true },
      { name: "GitHub integration", included: true },
      { name: "Community support", included: true },
      { name: "Priority queue", included: false },
      { name: "Team collaboration", included: false },
      { name: "Analytics dashboard", included: false },
    ],
  },
  {
    name: "Pro",
    description: "For professional developers who ship fast",
    price: "$29",
    period: "/month",
    cta: "Start Free Trial",
    ctaHref: "/login",
    highlighted: true,
    features: [
      { name: "Unlimited tasks", included: true },
      { name: "Unlimited repositories", included: true },
      { name: "Bring your own API keys", included: true },
      { name: "Full brainstorming features", included: true },
      { name: "Live execution logs", included: true },
      { name: "GitHub integration", included: true },
      { name: "Priority support", included: true },
      { name: "Priority queue", included: true },
      { name: "Team collaboration", included: false },
      { name: "Advanced analytics", included: true },
    ],
  },
  {
    name: "Team",
    description: "For teams building together with AI assistance",
    price: "$99",
    period: "/month",
    cta: "Contact Sales",
    ctaHref: "/contact",
    highlighted: false,
    features: [
      { name: "Everything in Pro", included: true },
      { name: "Up to 10 team members", included: true },
      { name: "Shared repositories", included: true },
      { name: "Team activity feed", included: true },
      { name: "Role-based permissions", included: true },
      { name: "Audit logs", included: true },
      { name: "Dedicated support", included: true },
      { name: "Custom integrations", included: true },
      { name: "SLA guarantee", included: true },
      { name: "Onboarding assistance", included: true },
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHeader
        title="Simple, Transparent Pricing"
        subtitle="Start free, scale as you grow. All plans include core AI features."
      />

      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative p-8 rounded-2xl border transition-all duration-300 hover:shadow-lg ${
                plan.highlighted
                  ? "border-primary bg-card shadow-lg scale-105"
                  : "border-border bg-card/50"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  Most Popular
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-semibold mb-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {plan.description}
                </p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature.name} className="flex items-center gap-3">
                    {feature.included ? (
                      <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    ) : (
                      <X className="w-5 h-5 text-muted-foreground/50 flex-shrink-0" />
                    )}
                    <span
                      className={
                        feature.included
                          ? "text-foreground"
                          : "text-muted-foreground/50"
                      }
                    >
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaHref}
                className={`block w-full py-3 px-6 rounded-lg text-center font-medium transition-all ${
                  plan.highlighted
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25"
                    : "border border-border hover:bg-muted/50"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ or additional info */}
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
              <h4 className="font-medium mb-2">Can I self-host Loopforge?</h4>
              <p className="text-muted-foreground text-sm">
                Yes! Loopforge is open source. You can deploy it on your own
                infrastructure using Docker. All features work identically in
                self-hosted mode.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">What happens to my code?</h4>
              <p className="text-muted-foreground text-sm">
                Your code never leaves your GitHub repository. Loopforge clones
                repos temporarily during execution and deletes them immediately
                after. We never store your source code.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
