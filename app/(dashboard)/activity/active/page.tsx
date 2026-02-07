import ActiveWorkersPageClient from "./active-workers-page-client";

// Cache for 30 seconds (near real-time data with SSE updates)
export const revalidate = 30;

export default async function ActiveWorkersPage() {
  return <ActiveWorkersPageClient />;
}
