import { PageHeader } from "@/components/institutional/page-header";
import { ComingSoon } from "@/components/institutional/coming-soon";

export default function ApiReferencePage() {
  return (
    <>
      <PageHeader
        title="API Reference"
        subtitle="Integrate Loopforge programmatically into your workflow"
      />

      <ComingSoon
        title="API Reference Coming Soon"
        description="We're building a comprehensive REST API that will let you create tasks, trigger executions, and monitor progress programmatically."
        showEmailSignup={true}
      />
    </>
  );
}
