import { Briefcase } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/institutional/page-header";

export default function CareersPage() {
  return (
    <>
      <PageHeader
        title="Careers"
        subtitle="Join us in building the future of autonomous development"
      />

      <section className="max-w-2xl mx-auto px-6 pb-24">
        <div className="p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-sm text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
            <Briefcase className="w-8 h-8 text-muted-foreground" />
          </div>

          <h2 className="text-xl font-semibold mb-3">No Open Positions</h2>
          <p className="text-muted-foreground mb-6">
            We&apos;re not actively hiring right now, but we&apos;re always
            interested in connecting with talented people who are passionate
            about developer tools and AI.
          </p>

          <div className="p-4 rounded-lg bg-muted/50 mb-6">
            <p className="text-sm text-muted-foreground">
              Interested in contributing? Loopforge is open source! Check out
              our GitHub repository to get involved.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="https://github.com/claudioemmanuel/loopforge-studio"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              View GitHub
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
