import { PageHeader } from "@/components/institutional/page-header";
import { ComingSoon } from "@/components/institutional/coming-soon";

export default function BlogPage() {
  return (
    <>
      <PageHeader
        title="Blog"
        subtitle="Insights on AI-powered development, product updates, and engineering deep-dives"
      />

      <ComingSoon
        title="Blog Coming Soon"
        description="We'll be sharing our journey building Loopforge, technical deep-dives into AI coding, and tips for getting the most out of autonomous development."
        showEmailSignup={true}
      />
    </>
  );
}
