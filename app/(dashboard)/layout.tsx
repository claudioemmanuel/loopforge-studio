import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayoutClient } from "@/components/layout";
import { getDashboardLayoutData } from "@/lib/contexts/dashboard/api";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sidebarRepos = await getDashboardLayoutData(session.user.id);

  return (
    <DashboardLayoutClient user={session.user} repos={sidebarRepos}>
      {children}
    </DashboardLayoutClient>
  );
}
