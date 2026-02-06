import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import type { User, Task, Repo } from "@/lib/db/schema";
import { getUserService } from "@/lib/contexts/iam/api";
import { getTaskService } from "@/lib/contexts/task/api";

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

    const userService = getUserService();
    const user = await userService.getUserFull(session.user.id);

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

    const taskService = getTaskService();
    const task = await taskService.getTaskFull(taskId);

    if (!task || task.repo.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get user's details
    const userService = getUserService();
    const user = await userService.getUserFull(session.user.id);

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
