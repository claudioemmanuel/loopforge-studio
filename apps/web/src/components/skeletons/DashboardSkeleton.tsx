import { Skeleton } from '../ui/skeleton'

export function DashboardSkeleton() {
  return (
    <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
          </div>
          <Skeleton className="h-4 w-24" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}
