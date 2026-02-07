import WorkersHistoryPageClient from "./workers-history-page-client";

// Cache for 1 minute (historical data with pagination)
export const revalidate = 60;

export default async function WorkersHistoryPage() {
  return <WorkersHistoryPageClient />;
}
