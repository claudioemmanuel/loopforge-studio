import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayoutClient } from "@/components/dashboard-layout-client";
import { db } from "@/lib/db";
import { repos, tasks } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

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
      taskCount: sql<number>`count(${tasks.id})::int`,
    })
    .from(repos)
    .leftJoin(tasks, eq(tasks.repoId, repos.id))
    .where(eq(repos.userId, session.user.id))
    .groupBy(repos.id, repos.name, repos.fullName)
    .orderBy(repos.name);

  return (
    <DashboardLayoutClient user={session.user} repos={userRepos}>
      {children}
    </DashboardLayoutClient>
  );
}
