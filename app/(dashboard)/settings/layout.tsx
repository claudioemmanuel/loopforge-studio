import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsProvider } from "./settings-context";
import { getSettingsLayoutData } from "@/lib/contexts/settings/api";

// Always fetch fresh settings data (security-sensitive)
export const revalidate = false;

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const settingsData = await getSettingsLayoutData(session.user.id);
  if (!settingsData) {
    redirect("/login");
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>
      <SettingsProvider data={settingsData}>{children}</SettingsProvider>
    </div>
  );
}
