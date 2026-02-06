export default function ActivityLoading() {
  return (
    <div className="p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="h-24 w-full rounded-xl bg-muted" />
        <div className="h-24 w-full rounded-xl bg-muted" />
        <div className="h-24 w-full rounded-xl bg-muted" />
      </div>
    </div>
  );
}
