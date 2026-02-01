import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { db, tasks, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { User, Task, Repo } from "@/lib/db/schema";
import { checkRepoLimit } from "./subscription-limits";
import { handleError, Errors } from "@/lib/errors";

export interface AuthContext {
  session: Session;
  user: User;
}

export interface TaskContext extends AuthContext {
  task: Task & { repo: Repo };
  taskId: string;
}

type RouteParams = { params: Promise<{ taskId: string }> };

/**
 * Higher-order function that validates authentication and fetches user
 */
export function withAuth(
  handler: (request: Request, context: AuthContext) => Promise<NextResponse>,
) {
  return async (request: Request): Promise<NextResponse> => {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // session is guaranteed to be non-null after the check above
    return handler(request, { session: session as Session, user });
  };
}

/**
 * Higher-order function that validates auth + fetches task with ownership check
 */
export function withTask(
  handler: (request: Request, context: TaskContext) => Promise<NextResponse>,
) {
  return async (
    request: Request,
    routeParams: RouteParams,
  ): Promise<NextResponse> => {
    const session = await auth();
    const { taskId } = await routeParams.params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get task with repo to verify ownership
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: { repo: true },
    });

    if (!task || task.repo.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get user's details
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // session is guaranteed to be non-null after the check above
    return handler(request, {
      session: session as Session,
      user,
      task,
      taskId,
    });
  };
}

/**
 * Higher-order function that validates auth + enforces repo limit
 */
export function withRepoLimit(
  handler: (request: Request, context: AuthContext) => Promise<NextResponse>,
) {
  return async (request: Request): Promise<NextResponse> => {
    const session = await auth();

    if (!session?.user?.id) {
      return handleError(Errors.unauthorized());
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user can add more repos
    const limitCheck = await checkRepoLimit(user.id);
    if (!limitCheck.allowed) {
      return handleError(
        Errors.repoLimitExceeded(limitCheck.tier, limitCheck.limit),
      );
    }

    // session is guaranteed to be non-null after the check above
    return handler(request, { session: session as Session, user });
  };
}
