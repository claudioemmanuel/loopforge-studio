"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Filter,
  RefreshCw,
  Radio,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityEventCategory } from "@/lib/db/schema";

export interface ActivityFilters {
  search: string;
  categories: ActivityEventCategory[];
  eventTypes: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

interface FilterBarProps {
  filters: ActivityFilters;
  onFiltersChange: (filters: ActivityFilters) => void;
  onRefresh: () => void;
  isLive: boolean;
  onLiveToggle: (enabled: boolean) => void;
  isLoading?: boolean;
}

const categoryOptions: {
  value: ActivityEventCategory;
  label: string;
  icon: string;
}[] = [
  { value: "ai_action", label: "AI Actions", icon: "🤖" },
  { value: "git", label: "Git Operations", icon: "📦" },
  { value: "system", label: "System Events", icon: "⚙️" },
];

const eventTypeOptions: {
  value: string;
  label: string;
  category: ActivityEventCategory;
}[] = [
  // AI Actions
  { value: "thinking", label: "Thinking", category: "ai_action" },
  { value: "file_read", label: "File Read", category: "ai_action" },
  { value: "file_write", label: "File Write", category: "ai_action" },
  { value: "api_call", label: "API Call", category: "ai_action" },
  // Git Operations
  { value: "commit", label: "Commit", category: "git" },
  { value: "branch_create", label: "Branch Create", category: "git" },
  { value: "branch_checkout", label: "Branch Checkout", category: "git" },
  { value: "pr_create", label: "PR Create", category: "git" },
  // System Events
  { value: "task_started", label: "Task Started", category: "system" },
  { value: "task_completed", label: "Task Completed", category: "system" },
  { value: "task_failed", label: "Task Failed", category: "system" },
  { value: "error", label: "Error", category: "system" },
];

const dateRangePresets = [
  { label: "Today", days: 0 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "All time", days: -1 },
];

export function FilterBar({
  filters,
  onFiltersChange,
  onRefresh,
  isLive,
  onLiveToggle,
  isLoading = false,
}: FilterBarProps) {
  const [searchValue, setSearchValue] = useState(filters.search);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFiltersChange({ ...filters, search: searchValue });
  };

  const handleCategoryToggle = (category: ActivityEventCategory) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category];
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const handleEventTypeToggle = (eventType: string) => {
    const newTypes = filters.eventTypes.includes(eventType)
      ? filters.eventTypes.filter((t) => t !== eventType)
      : [...filters.eventTypes, eventType];
    onFiltersChange({ ...filters, eventTypes: newTypes });
  };

  const handleDateRangePreset = (days: number) => {
    if (days === -1) {
      onFiltersChange({
        ...filters,
        dateRange: { start: null, end: null },
      });
    } else {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      start.setHours(0, 0, 0, 0);
      onFiltersChange({
        ...filters,
        dateRange: { start, end },
      });
    }
  };

  const activeFiltersCount =
    (filters.categories.length < 3 ? 1 : 0) +
    (filters.eventTypes.length > 0 ? 1 : 0) +
    (filters.dateRange.start ? 1 : 0);

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 border-b bg-muted/30">
      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="flex-1 min-w-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search events..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </form>

      <div className="flex items-center gap-2">
        {/* Category Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-1.5 h-9",
                filters.categories.length < 3 && "border-primary text-primary",
              )}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Category</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Event Categories</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {categoryOptions.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={filters.categories.includes(opt.value)}
                onCheckedChange={() => handleCategoryToggle(opt.value)}
              >
                <span className="mr-2">{opt.icon}</span>
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Event Types
            </DropdownMenuLabel>
            {eventTypeOptions.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={filters.eventTypes.includes(opt.value)}
                onCheckedChange={() => handleEventTypeToggle(opt.value)}
                className="pl-6"
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Date Range */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-1.5 h-9",
                filters.dateRange.start && "border-primary text-primary",
              )}
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Date</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Time Range</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {dateRangePresets.map((preset) => (
              <DropdownMenuCheckboxItem
                key={preset.days}
                checked={
                  preset.days === -1
                    ? !filters.dateRange.start
                    : filters.dateRange.start !== null &&
                      Math.abs(
                        (new Date().getTime() -
                          filters.dateRange.start.getTime()) /
                          (1000 * 60 * 60 * 24),
                      ) <=
                        preset.days + 0.1
                }
                onCheckedChange={() => handleDateRangePreset(preset.days)}
              >
                {preset.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Live Mode Toggle */}
        <Button
          variant={isLive ? "default" : "outline"}
          size="sm"
          onClick={() => onLiveToggle(!isLive)}
          className={cn(
            "gap-1.5 h-9",
            isLive && "bg-emerald-600 hover:bg-emerald-700",
          )}
        >
          <Radio className={cn("w-4 h-4", isLive && "animate-pulse")} />
          <span className="hidden sm:inline">Live</span>
        </Button>

        {/* Refresh Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-9 w-9"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Active filters indicator */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground sm:ml-2">
          <span>
            {activeFiltersCount} filter{activeFiltersCount > 1 ? "s" : ""}{" "}
            active
          </span>
          <button
            onClick={() =>
              onFiltersChange({
                search: "",
                categories: ["ai_action", "git", "system"],
                eventTypes: [],
                dateRange: { start: null, end: null },
              })
            }
            className="text-primary hover:underline"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
