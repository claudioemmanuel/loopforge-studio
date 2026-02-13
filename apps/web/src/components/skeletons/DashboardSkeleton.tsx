import { Skeleton } from '../ui/skeleton'

export function DashboardSkeleton() {
  return (
    <div>
      {/* Page header skeleton */}
      <div className="border-b px-6 py-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-6 w-32" />
        <Skeleton className="mt-1 h-4 w-48" />
      </div>

      {/* List row skeletons */}
      <div className="divide-y">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-3.5">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-[40%]" />
              <Skeleton className="mt-1 h-3 w-[25%]" />
            </div>
            <Skeleton className="hidden sm:block h-1.5 w-32 rounded-full" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
