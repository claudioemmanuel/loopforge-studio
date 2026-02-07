import WorkersHealthPageClient from "./workers-health-page-client";

export const revalidate = 30;

export default async function WorkersHealthPage() {
  return <WorkersHealthPageClient />;
}
