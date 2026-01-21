interface RepoActivityTableProps {
  data: Array<{
    repoId: string;
    repoName: string;
    commits: number;
    tasksCompleted: number;
  }>;
}

export function RepoActivityTable({ data }: RepoActivityTableProps) {
  if (data.length === 0) {
    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-sm font-serif font-medium text-muted-foreground mb-4">Repository Activity</h3>
        <p className="text-sm text-muted-foreground text-center py-8">
          No repository activity in this period.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl border bg-card">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Repository Activity</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-medium text-muted-foreground">Repository</th>
              <th className="text-right py-2 font-medium text-muted-foreground">Commits</th>
              <th className="text-right py-2 font-medium text-muted-foreground">Tasks</th>
            </tr>
          </thead>
          <tbody>
            {data.map((repo) => (
              <tr key={repo.repoId} className="border-b last:border-0">
                <td className="py-2 font-medium">{repo.repoName}</td>
                <td className="py-2 text-right">{repo.commits}</td>
                <td className="py-2 text-right">{repo.tasksCompleted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
