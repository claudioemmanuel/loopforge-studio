import { Github, Twitter, Linkedin } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/institutional/page-header";
import { LoopforgeLogo } from "@/components/loopforge-logo";

const team = [
  {
    name: "Claudio Emmanuel",
    role: "Founder & Lead Developer",
    bio: "Full-stack engineer passionate about developer tools and AI. Building the future of autonomous coding.",
    github: "claudioemmanuel",
    twitter: null,
    linkedin: null,
  },
];

const values = [
  {
    title: "Developer-First",
    description:
      "We build tools that developers actually want to use. Every feature is designed with the developer experience in mind.",
  },
  {
    title: "Open Source",
    description:
      "Transparency and community are at our core. Loopforge is open source because we believe the best tools are built together.",
  },
  {
    title: "AI as Assistant",
    description:
      "AI should augment developers, not replace them. You stay in control while AI handles the repetitive work.",
  },
  {
    title: "Ship Fast",
    description:
      "The best code is shipped code. We're obsessed with reducing the friction between idea and deployed feature.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="About Loopforge"
        subtitle="Building the future of autonomous development"
      />

      <section className="max-w-4xl mx-auto px-6 pb-24">
        {/* Mission section */}
        <div className="text-center mb-16">
          <div className="mb-8">
            <LoopforgeLogo
              size="xl"
              animate={false}
              showSparks={false}
              showText={false}
            />
          </div>
          <h2 className="text-2xl md:text-3xl font-serif font-bold mb-4">
            Our Mission
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            We believe developers should spend their time on creative
            problem-solving, not repetitive implementation. Loopforge Studio
            puts AI to work on your codebase so you can focus on what matters
            most—shipping great products.
          </p>
        </div>

        {/* Story section */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-center">Our Story</h2>
          <div className="p-8 rounded-2xl border border-border bg-card/50">
            <p className="text-muted-foreground leading-relaxed mb-4">
              Loopforge started as a personal project born from frustration.
              After spending countless hours on routine coding tasks—writing
              boilerplate, fixing simple bugs, implementing straightforward
              features—we asked: what if AI could handle this while we sleep?
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Existing AI coding tools were impressive but required constant
              hand-holding. We wanted something different: a visual interface
              where you could describe tasks, refine them through conversation,
              and then let AI execute autonomously.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Today, Loopforge Studio is an open-source platform that brings
              this vision to life. With a Kanban board interface, AI
              brainstorming, and direct GitHub integration, developers can queue
              up tasks and wake up to completed pull requests.
            </p>
          </div>
        </div>

        {/* Values section */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-center">
            Our Values
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {values.map((value) => (
              <div
                key={value.title}
                className="p-6 rounded-xl border border-border bg-card/50"
              >
                <h3 className="font-semibold mb-2">{value.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Team section */}
        <div>
          <h2 className="text-2xl font-semibold mb-6 text-center">The Team</h2>
          <div className="flex justify-center">
            {team.map((member) => (
              <div
                key={member.name}
                className="p-6 rounded-xl border border-border bg-card/50 text-center max-w-sm"
              >
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                </div>
                <h3 className="font-semibold">{member.name}</h3>
                <p className="text-sm text-primary mb-3">{member.role}</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {member.bio}
                </p>
                <div className="flex justify-center gap-3">
                  {member.github && (
                    <Link
                      href={`https://github.com/${member.github}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Github className="w-5 h-5" />
                    </Link>
                  )}
                  {member.twitter && (
                    <Link
                      href={`https://twitter.com/${member.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Twitter className="w-5 h-5" />
                    </Link>
                  )}
                  {member.linkedin && (
                    <Link
                      href={`https://linkedin.com/in/${member.linkedin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Linkedin className="w-5 h-5" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
