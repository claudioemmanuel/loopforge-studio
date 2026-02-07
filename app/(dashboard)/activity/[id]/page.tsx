import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ExecutionDetailView } from "@/components/workers/execution-detail-view";
import { getExecutionDetailForUser } from "@/lib/contexts/activity/api";

interface ExecutionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ExecutionDetailPage({
  params,
}: ExecutionDetailPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    notFound();
  }

  const detail = await getExecutionDetailForUser(session.user.id, id);
  if (!detail) {
    notFound();
  }

  return (
    <div className="p-8">
      <ExecutionDetailView
        execution={detail.execution}
        task={detail.execution.task}
        events={detail.events as never}
      />
    </div>
  );
}
