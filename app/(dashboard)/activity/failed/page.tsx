import WorkersFailedPageClient from "./workers-failed-page-client";

// Cache for 1 minute (failed jobs rarely change frequently)
export const revalidate = 60;

export default async function WorkersFailedPage() {
  return <WorkersFailedPageClient />;
}
