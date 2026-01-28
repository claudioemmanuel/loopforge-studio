import { ExternalLink, Github, BookOpen } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/institutional/page-header";
import { ComingSoon } from "@/components/institutional/coming-soon";

export default function DocsPage() {
  return (
    <>
      <PageHeader
        title="Documentation"
        subtitle="Learn how to get the most out of Loopforge Studio"
      />

      <div className="max-w-2xl mx-auto px-6 pb-8">
        {/* GitHub README link */}
        <div className="p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm mb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Github className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Getting Started Guide</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Our README on GitHub has everything you need to get up and
                running with Loopforge Studio.
              </p>
              <Link
                href="https://github.com/claudioemmanuel/loopforge-studio#readme"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <BookOpen className="w-4 h-4" />
                Read the README
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <ComingSoon
        title="Full Documentation Coming Soon"
        description="We're working on comprehensive documentation covering installation, configuration, API usage, and best practices."
        showEmailSignup={true}
      />
    </>
  );
}
