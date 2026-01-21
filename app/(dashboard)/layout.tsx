import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { PageTransition } from "@/components/page-transition";
import { WelcomeTutorialWrapper } from "@/components/welcome-tutorial-wrapper";
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
    <div className="flex h-screen bg-background">
      <div className="sidebar-static">
        <Sidebar user={session.user} repos={userRepos} />
      </div>
      <main className="flex-1 overflow-auto">
        <PageTransition className="h-full">
          {children}
        </PageTransition>
      </main>
      <Suspense fallback={null}>
        <WelcomeTutorialWrapper />
      </Suspense>
    </div>
  );
}
