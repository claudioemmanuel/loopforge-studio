import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleError, Errors } from "@/lib/errors";
import { getExecutionService } from "@/lib/contexts/execution/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ executionId: string }> },
) {
  const session = await auth();
  const { executionId } = await params;

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const executionService = getExecutionService();
  const execution =
    await executionService.getExecutionWithOwnership(executionId);

  if (!execution || execution.task.repo.userId !== session.user.id) {
    return handleError(Errors.notFound("Execution"));
  }

  const events = await executionService.getExecutionEvents(executionId);

  return NextResponse.json(events);
}
