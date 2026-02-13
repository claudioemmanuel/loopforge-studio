import type { RepoActivitySummary } from '@loopforge/shared'

interface RepoActivityTableProps {
  data: RepoActivitySummary[]
}

export function RepoActivityTable({ data }: RepoActivityTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        No repository activity yet.
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Repository</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Tasks</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Tokens Used</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.repositoryId} className="border-b last:border-0 odd:bg-muted/30 hover:bg-muted/50">
              <td className="px-4 py-2.5 font-medium">{row.fullName}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{row.taskCount}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{row.tokensUsed.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
