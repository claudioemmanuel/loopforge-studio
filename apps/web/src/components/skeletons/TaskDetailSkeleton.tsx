import { Skeleton } from '../ui/skeleton'

export function TaskDetailSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-2/3" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
