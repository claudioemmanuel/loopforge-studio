import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { executions, executionEvents } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { ExecutionDetailView } from "@/components/workers/execution-detail-view";

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
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    notFound();
  }

  // Get execution with task and repo
  const execution = await db.query.executions.findFirst({
    where: eq(executions.id, id),
    with: {
      task: {
        with: {
          repo: true,
        },
      },
    },
  });

  if (!execution) {
    notFound();
  }

  // Verify user owns the task
  if (execution.task.repo.userId !== session.user.id) {
    notFound();
  }

  // Get execution events
  const events = await db.query.executionEvents.findMany({
    where: eq(executionEvents.executionId, execution.id),
    orderBy: [asc(executionEvents.createdAt)],
  });

  return (
    <div className="p-8">
      <ExecutionDetailView
        execution={execution}
        task={execution.task}
        events={events}
      />
    </div>
  );
}
