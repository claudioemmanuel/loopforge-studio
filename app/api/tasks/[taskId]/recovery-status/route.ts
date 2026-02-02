import { NextResponse } from "next/server";
import { db, executions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { withTask } from "@/lib/api";

export interface RecoveryStatusResponse {
  isRecovering: boolean;
  currentTier: string | null;
  attemptNumber: number;
  maxAttempts: number;
  progress: number; // 0-100
  elapsedTime: number; // milliseconds
  status: "idle" | "recovering" | "success" | "failed";
  lastError?: string;
  recoveryAttempts?: Array<{
    tier: string;
    success: boolean;
    iteration: number;
  }>;
}

export const GET = withTask(async (request, { task }) => {
  // Get the latest execution for this task
  const latestExecution = await db.query.executions.findFirst({
    where: eq(executions.taskId, task.id),
    orderBy: (executions, { desc }) => [desc(executions.createdAt)],
  });

  if (!latestExecution) {
    // No execution yet
    return NextResponse.json<RecoveryStatusResponse>({
      isRecovering: false,
      currentTier: null,
      attemptNumber: 0,
      maxAttempts: 3,
      progress: 0,
      elapsedTime: 0,
      status: "idle",
    });
  }

  // Check if task is currently in recovering phase
  const isRecovering = task.processingPhase === "recovering";

  // Parse recovery attempts from execution
  const recoveryAttempts = (latestExecution.recoveryAttempts as Array<{
    tier: string;
    success: boolean;
    iteration: number;
  }>) || [];

  // Determine current status
  let status: "idle" | "recovering" | "success" | "failed" = "idle";
  if (isRecovering) {
    status = "recovering";
  } else if (recoveryAttempts.length > 0) {
    const lastAttempt = recoveryAttempts[recoveryAttempts.length - 1];
    status = lastAttempt.success ? "success" : "failed";
  }

  // Calculate progress
  const attemptNumber = recoveryAttempts.length;
  const maxAttempts = 3; // Based on 4-tier system (0-indexed)
  const progress = Math.min(100, (attemptNumber / maxAttempts) * 100);

  // Calculate elapsed time
  let elapsedTime = 0;
  if (isRecovering && latestExecution.startedAt) {
    elapsedTime = Date.now() - new Date(latestExecution.startedAt).getTime();
  }

  // Get current tier (last attempt's tier or null)
  const currentTier = recoveryAttempts.length > 0
    ? recoveryAttempts[recoveryAttempts.length - 1].tier
    : null;

  const response: RecoveryStatusResponse = {
    isRecovering,
    currentTier,
    attemptNumber,
    maxAttempts,
    progress,
    elapsedTime,
    status,
    lastError: latestExecution.errorMessage || undefined,
    recoveryAttempts,
  };

  return NextResponse.json(response);
});
