"use client";

import { TaskTimeline } from "@/components/timeline";
import type { StatusHistoryEntry } from "@/lib/db/schema";

interface TimelineTabProps {
  history: StatusHistoryEntry[];
}

export function TimelineTab({ history }: TimelineTabProps) {
  return (
    <div className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            Status Change History
          </h3>
          <TaskTimeline history={history} compact />
        </div>
      </div>
    </div>
  );
}
