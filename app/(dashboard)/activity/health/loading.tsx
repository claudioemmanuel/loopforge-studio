export default function WorkersHealthLoading() {
  return (
    <div className="p-8">
      <div className="h-9 w-72 bg-muted/40 rounded-md animate-pulse mb-3" />
      <div className="h-5 w-[28rem] bg-muted/30 rounded-md animate-pulse mb-8" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 bg-muted/30 rounded-xl animate-pulse" />
        <div className="h-48 bg-muted/30 rounded-xl animate-pulse" />
        <div className="h-72 bg-muted/30 rounded-xl animate-pulse" />
        <div className="h-72 bg-muted/30 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
