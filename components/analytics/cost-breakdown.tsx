interface CostBreakdownProps {
  data: {
    totalCents: number;
    inputCostCents: number;
    outputCostCents: number;
    avgPerTaskCents: number;
  };
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CostBreakdown({ data }: CostBreakdownProps) {
  return (
    <div className="p-6 rounded-xl border bg-card">
      <h3 className="text-sm font-serif font-medium text-muted-foreground mb-4">Cost Breakdown</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-muted-foreground">This period</span>
          <span className="text-2xl font-bold">{formatCents(data.totalCents)}</span>
        </div>
        <div className="h-px bg-border" />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Input tokens</span>
          <span>{formatCents(data.inputCostCents)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Output tokens</span>
          <span>{formatCents(data.outputCostCents)}</span>
        </div>
        <div className="h-px bg-border" />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Avg per task</span>
          <span className="font-medium">{formatCents(data.avgPerTaskCents)}</span>
        </div>
      </div>
    </div>
  );
}
