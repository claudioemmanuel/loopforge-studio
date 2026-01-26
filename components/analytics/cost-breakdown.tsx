interface CostBreakdownProps {
  data?: {
    totalCents: number;
    inputCostCents: number;
    outputCostCents: number;
    avgPerTaskCents: number;
  } | null;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CostBreakdown({ data }: CostBreakdownProps) {
  const safeData = data ?? { totalCents: 0, inputCostCents: 0, outputCostCents: 0, avgPerTaskCents: 0 };

  return (
    <div className="p-6 rounded-xl border bg-card">
      <h3 className="text-sm font-serif font-medium text-muted-foreground mb-4">Cost Breakdown</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-muted-foreground">This period</span>
          <span className="text-2xl font-bold">{formatCents(safeData.totalCents)}</span>
        </div>
        <div className="h-px bg-border" />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Input tokens</span>
          <span>{formatCents(safeData.inputCostCents)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Output tokens</span>
          <span>{formatCents(safeData.outputCostCents)}</span>
        </div>
        <div className="h-px bg-border" />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Avg per task</span>
          <span className="font-medium">{formatCents(safeData.avgPerTaskCents)}</span>
        </div>
      </div>
    </div>
  );
}
