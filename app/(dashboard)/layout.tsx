import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayoutClient } from "@/components/layout";
import { db } from "@/lib/db";
import { repos, tasks } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { getFeatureFlag } from "@/lib/config/feature-flags";

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

  // Get feature flags on server side to avoid hydration mismatches
  const enableABTesting = getFeatureFlag("ENABLE_AB_TESTING");

  return (
    <DashboardLayoutClient
      user={session.user}
      repos={userRepos}
      enableABTesting={enableABTesting}
    >
      {children}
    </DashboardLayoutClient>
  );
}
