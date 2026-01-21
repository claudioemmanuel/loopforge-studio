interface WelcomeBannerProps {
  repoCount: number;
}

export function WelcomeBanner({ repoCount }: WelcomeBannerProps) {
  return (
    <div className="p-6 rounded-xl border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent mb-6">
      <h2 className="text-2xl font-serif font-semibold tracking-tight mb-2">
        Welcome to <span className="text-primary">Loop</span>forge!
      </h2>
      <p className="text-muted-foreground mb-4">
        You&apos;ve connected <em className="font-serif">{repoCount}</em> {repoCount === 1 ? "repository" : "repositories"}. Here&apos;s how to get started:
      </p>
      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
        <li>Click a repository below to open its Kanban board</li>
        <li>Create your first task with the &quot;New Task&quot; button</li>
        <li>Watch AI brainstorm, plan, and execute your task</li>
      </ol>
    </div>
  );
}
