import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayoutClient } from "@/components/layout";
import { db } from "@/lib/db";
import { repos, tasks } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

function toSidebarCloneStatus(
  value: string | null,
): "pending" | "cloning" | "completed" | "failed" | undefined {
  if (
    value === "pending" ||
    value === "cloning" ||
    value === "completed" ||
    value === "failed"
  ) {
    return value;
  }
  return undefined;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch user's repos with task counts for sidebar
  const userRepos = await db
    .select({
      id: repos.id,
      name: repos.name,
      fullName: repos.fullName,
      isCloned: repos.isCloned,
      indexingStatus: repos.indexingStatus,
      cloneStatus: repos.cloneStatus,
      taskCount: sql<number>`count(${tasks.id})::int`,
    })
    .from(repos)
    .leftJoin(tasks, eq(tasks.repoId, repos.id))
    .where(eq(repos.userId, session.user.id))
    .groupBy(
      repos.id,
      repos.name,
      repos.fullName,
      repos.isCloned,
      repos.indexingStatus,
      repos.cloneStatus,
    )
    .orderBy(repos.name);

  const sidebarRepos = userRepos.map((repo) => ({
    ...repo,
    cloneStatus: toSidebarCloneStatus(repo.cloneStatus),
  }));

  return (
    <DashboardLayoutClient user={session.user} repos={sidebarRepos}>
      {children}
    </DashboardLayoutClient>
  );
}
