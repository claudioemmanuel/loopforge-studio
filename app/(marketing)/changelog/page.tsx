import { PageHeader } from "@/components/institutional/page-header";
import { ComingSoon } from "@/components/institutional/coming-soon";

export default function ChangelogPage() {
  return (
    <>
      <PageHeader
        title="Changelog"
        subtitle="Stay updated with the latest features and improvements"
      />

      <ComingSoon
        title="Changelog Coming Soon"
        description="We're building in public and will share every update here. Subscribe to get notified when we ship new features."
        showEmailSignup={true}
      />
    </>
  );
}
