import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  icon?: LucideIcon;
  className?: string;
}

export function StatCard({ title, value, trend, icon: Icon, className }: StatCardProps) {
  return (
    <div className={cn(
      "p-6 rounded-xl border bg-card shadow-sm",
      className
    )}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      </div>
      <p className="text-3xl font-bold mt-2">{value}</p>
      {trend && (
        <p className={cn(
          "text-xs mt-1",
          trend.positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
        )}>
          {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)} {trend.label}
        </p>
      )}
    </div>
  );
}
