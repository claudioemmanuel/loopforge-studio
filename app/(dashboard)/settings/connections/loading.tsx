export default function ConnectionsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border p-6 space-y-4 animate-pulse"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-muted" />
                <div className="space-y-2">
                  <div className="h-5 w-32 bg-muted rounded" />
                  <div className="h-4 w-64 bg-muted rounded" />
                </div>
              </div>
              <div className="h-10 w-24 bg-muted rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
