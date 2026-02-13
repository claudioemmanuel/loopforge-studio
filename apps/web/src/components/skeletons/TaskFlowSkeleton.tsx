import { Skeleton } from '../ui/skeleton'

export function TaskFlowSkeleton() {
  return (
    <div className="flex h-full items-center justify-center gap-8 p-10">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <Skeleton className="h-[140px] w-[220px] rounded-lg" />
          {i < 6 && <Skeleton className="h-0.5 w-8 absolute" style={{ left: '100%', top: '50%' }} />}
        </div>
      ))}
    </div>
  )
}
