import { SkeletonKanban, SkeletonStatCards } from "@/components/ui/skeletons";

export default function RepoLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-md bg-muted" />
      </div>
      <SkeletonStatCards count={4} />
      <SkeletonKanban />
    </div>
  );
}
