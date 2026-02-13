interface MetricCardProps {
  label: string
  value: string | number
}

export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}
