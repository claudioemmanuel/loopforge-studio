import { Skeleton } from '../ui/skeleton'

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-md" />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-md" />
      <Skeleton className="h-64 w-full rounded-md" />
    </div>
  )
}
