import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, AlertCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  taskTitle: string;
  repoName: string;
  status: "completed" | "executing" | "stuck" | "pending";
  timestamp: Date;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  className?: string;
}

const statusConfig = {
  completed: { icon: CheckCircle2, color: "text-green-600 dark:text-green-400", label: "completed" },
  executing: { icon: Loader2, color: "text-blue-600 dark:text-blue-400", label: "executing", animate: true },
  stuck: { icon: AlertCircle, color: "text-amber-600 dark:text-amber-400", label: "stuck" },
  pending: { icon: Clock, color: "text-muted-foreground", label: "pending" },
};

export function ActivityFeed({ items, className }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className={cn("p-6 rounded-xl border bg-card", className)}>
        <h3 className="text-sm font-serif font-medium text-muted-foreground mb-4">Recent Activity</h3>
        <p className="text-sm text-muted-foreground text-center py-8">
          No recent activity. Create a task to get started.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("p-6 rounded-xl border bg-card", className)}>
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {items.map((item) => {
          const config = statusConfig[item.status];
          const Icon = config.icon;
          return (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <Icon className={cn(
                "w-4 h-4 flex-shrink-0",
                config.color,
                "animate" in config && config.animate && "animate-spin"
              )} />
              <span className="flex-1 truncate">
                &quot;{item.taskTitle}&quot; {config.label}
              </span>
              <span className="text-muted-foreground text-xs">{item.repoName}</span>
              <span className="text-muted-foreground text-xs">
                {formatDistanceToNow(item.timestamp, { addSuffix: true })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
