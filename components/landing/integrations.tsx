"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Squircle, useSquircle } from "@/components/ui/squircle";

// Brand icons as SVG components - Official Anthropic "A" mark
function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17.304 3.541h-3.483l6.166 16.918h3.483L17.304 3.541Zm-10.56 0L.528 20.459h3.57l1.26-3.539h6.359l1.26 3.539h3.57L10.33 3.54H6.744Zm.528 10.776 2.278-6.391 2.278 6.391H7.272Z"
        fill="#D97757"
      />
    </svg>
  );
}

function OpenAIIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.677l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}

function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 24C12 22.1458 11.6543 20.3542 10.963 18.6253C10.2716 16.8964 9.28384 15.3495 8 13.9845C6.71616 12.6195 5.24326 11.5682 3.58126 10.8306C1.91935 10.093 0.0856094 9.70801 -1.81198e-06 9.66732C0.0856094 9.62663 1.91935 9.24164 3.58126 8.50406C5.24326 7.76648 6.71616 6.71517 8 5.35013C9.28384 3.9851 10.2716 2.43822 10.963 0.709395C11.6543 -1.01943 12 -2.81105 12 0C12 1.85419 12.3457 3.64582 13.037 5.37476C13.7284 7.10359 14.7162 8.65049 16 10.0155C17.2838 11.3805 18.7567 12.4318 20.4187 13.1694C22.0806 13.907 23.9144 14.292 24 14.3327C23.9144 14.3734 22.0806 14.7584 20.4187 15.4959C18.7567 16.2335 17.2838 17.2848 16 18.6499C14.7162 20.0149 13.7284 21.5618 13.037 23.2906C12.3457 25.0194 12 26.8111 12 24Z"
        fill="url(#gemini-gradient)"
      />
      <defs>
        <linearGradient
          id="gemini-gradient"
          x1="0"
          y1="12"
          x2="24"
          y2="12"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#4285F4" />
          <stop offset="0.5" stopColor="#9B72CB" />
          <stop offset="1" stopColor="#D96570" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

// Helper function to get providers with translations
function getProviders(t: (key: string) => string) {
  return [
    {
      name: t("landing.integrations.claude.name"),
      Icon: ClaudeIcon,
      description: t("landing.integrations.claude.description"),
      color: "text-[#D97757]",
      capabilities: [
        t("landing.integrations.claude.capabilities.context"),
        t("landing.integrations.claude.capabilities.reasoning"),
        t("landing.integrations.claude.capabilities.coding"),
      ],
      bestFor: t("landing.integrations.claude.bestFor"),
    },
    {
      name: t("landing.integrations.gpt4.name"),
      Icon: OpenAIIcon,
      description: t("landing.integrations.gpt4.description"),
      color: "text-foreground",
      capabilities: [
        t("landing.integrations.gpt4.capabilities.context"),
        t("landing.integrations.gpt4.capabilities.speed"),
        t("landing.integrations.gpt4.capabilities.knowledge"),
      ],
      bestFor: t("landing.integrations.gpt4.bestFor"),
    },
    {
      name: t("landing.integrations.gemini.name"),
      Icon: GeminiIcon,
      description: t("landing.integrations.gemini.description"),
      color: "",
      capabilities: [
        t("landing.integrations.gemini.capabilities.context"),
        t("landing.integrations.gemini.capabilities.multimodal"),
        t("landing.integrations.gemini.capabilities.integration"),
      ],
      bestFor: t("landing.integrations.gemini.bestFor"),
    },
    {
      name: t("landing.integrations.github.name"),
      Icon: GitHubIcon,
      description: t("landing.integrations.github.description"),
      color: "text-foreground",
      capabilities: [
        t("landing.integrations.github.capabilities.repo"),
        t("landing.integrations.github.capabilities.issues"),
        t("landing.integrations.github.capabilities.webhooks"),
      ],
      bestFor: t("landing.integrations.github.bestFor"),
    },
  ];
}

// Helper function to get stats with translations
function getStats(t: (key: string) => string) {
  return [
    {
      value: t("landing.integrations.stats.executions.value"),
      label: t("landing.integrations.stats.executions.label"),
      numericValue: null,
    },
    {
      value: t("landing.integrations.stats.providers.value"),
      label: t("landing.integrations.stats.providers.label"),
      numericValue: null,
    },
    {
      value: t("landing.integrations.stats.uptime.value"),
      label: t("landing.integrations.stats.uptime.label"),
      numericValue: null,
    },
    {
      value: t("landing.integrations.stats.teams.value"),
      label: t("landing.integrations.stats.teams.label"),
      numericValue: null,
    },
  ];
}

function CapabilityDot() {
  const squircle = useSquircle({ cornerRadius: "full" });
  return (
    <span
      ref={squircle.ref as React.RefObject<HTMLSpanElement>}
      className="w-1.5 h-1.5 rounded-full bg-primary/60"
      style={squircle.style}
    />
  );
}

function ProviderCard({
  provider,
  index,
}: {
  provider: ReturnType<typeof getProviders>[0];
  index: number;
}) {
  const t = useTranslations();
  const Icon = provider.Icon;
  const animationDelay = `animation-delay-${(index + 1) * 100}`;
  const [isHovered, setIsHovered] = useState(false);
  const cardSquircle = useSquircle({ cornerRadius: "xl" });

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div
          ref={cardSquircle.ref as React.RefObject<HTMLDivElement>}
          className={`group relative flex items-center gap-4 px-6 py-4 rounded-xl bg-card/50
            opacity-0 animate-fade-up ${animationDelay}
            transition-all duration-300 ease-out cursor-pointer
            hover:scale-[1.03] hover:bg-card/80`}
          style={{
            ...cardSquircle.style,
            filter: isHovered
              ? "drop-shadow(0 20px 25px hsl(var(--primary) / 0.1))"
              : "none",
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="w-10 h-10 flex items-center justify-center">
            <Icon
              className={`w-8 h-8 ${provider.color} transition-transform duration-300 group-hover:scale-110`}
            />
          </div>
          <div>
            <h3 className="font-semibold">{provider.name}</h3>
            <p className="text-sm text-muted-foreground">
              {provider.description}
            </p>
          </div>
          {/* SVG border overlay */}
          {cardSquircle.svgPath && (
            <svg
              aria-hidden
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ position: "absolute", inset: 0 }}
            >
              <path
                d={cardSquircle.svgPath}
                fill="none"
                stroke={
                  isHovered ? "hsl(var(--primary) / 0.3)" : "hsl(var(--border))"
                }
                strokeWidth={1}
                className="transition-all duration-300"
              />
            </svg>
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" align="center">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Icon className={`w-6 h-6 ${provider.color}`} />
            <h4 className="font-semibold">{provider.name}</h4>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              {t("landing.integrations.hoverCard.capabilities")}
            </p>
            <ul className="space-y-1">
              {provider.capabilities.map((cap) => (
                <li key={cap} className="text-sm flex items-center gap-2">
                  <CapabilityDot />
                  {cap}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              {t("landing.integrations.hoverCard.bestFor")}
            </p>
            <p className="text-sm text-foreground">{provider.bestFor}</p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function StatItem({
  stat,
  index,
}: {
  stat: ReturnType<typeof getStats>[0];
  index: number;
}) {
  return (
    <div
      className={`text-center opacity-0 animate-fade-up animation-delay-${(index + 1) * 100}`}
    >
      <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
        {stat.value}
      </div>
      <div className="text-sm text-muted-foreground">{stat.label}</div>
    </div>
  );
}

export function Integrations() {
  const t = useTranslations();
  const providers = getProviders(t);
  const stats = getStats(t);

  return (
    <section
      id="integrations"
      className="relative py-24 px-6 overflow-hidden bg-background"
    >
      {/* Background floating orbs */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-float animation-delay-500" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-primary/3 to-accent/3 rounded-full blur-3xl animate-gradient-shift" />
      </div>

      <div className="max-w-7xl mx-auto">
        {/* AI Providers */}
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-tight">
            {t("landing.integrations.sectionTitle")
              .split(" ")
              .slice(0, -3)
              .join(" ")}{" "}
            <span className="text-primary relative">
              {t("landing.integrations.sectionTitle")
                .split(" ")
                .slice(-3)
                .join(" ")}
              <svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 200 12"
                fill="none"
              >
                <path
                  d="M2 10C50 2 150 2 198 10"
                  stroke="hsl(var(--primary))"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.4"
                />
              </svg>
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("landing.integrations.sectionSubtitle")}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mb-20">
          {providers.map((provider, index) => (
            <ProviderCard
              key={provider.name}
              provider={provider}
              index={index}
            />
          ))}
        </div>

        {/* Platform Highlights */}
        <div className="relative">
          {/* Blurred bg — keep as-is */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 rounded-2xl blur-xl -z-10 animate-gradient-shift" />
          <Squircle
            cornerRadius="2xl"
            borderWidth={1}
            borderColor="hsl(var(--border))"
            className="grid grid-cols-2 md:grid-cols-4 gap-8 p-8 md:p-12 rounded-2xl bg-card/30 backdrop-blur-sm"
          >
            {stats.map((stat, index) => (
              <StatItem key={stat.label} stat={stat} index={index} />
            ))}
          </Squircle>
        </div>
      </div>
    </section>
  );
}
