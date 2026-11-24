"use client";

import { X } from "lucide-react";

interface StudioFiltersProps {
  statusFilter: string;
  healthFilter: string;
  hasActiveFilters: boolean;
  onStatusFilterChange: (value: string) => void;
  onHealthFilterChange: (value: string) => void;
  onClearFilters: () => void;
}

export function StudioFilters({
  statusFilter,
  healthFilter,
  hasActiveFilters,
  onStatusFilterChange,
  onHealthFilterChange,
  onClearFilters,
}: StudioFiltersProps) {
  const filters = [
    {
      label: "Active",
      selected: statusFilter === "active",
      className: "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 data-[active=true]:border-emerald-600 data-[active=true]:bg-emerald-600 data-[active=true]:text-white dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50 dark:data-[active=true]:border-emerald-600 dark:data-[active=true]:bg-emerald-600 dark:data-[active=true]:text-white",
      onClick: () => onStatusFilterChange(statusFilter === "active" ? "all" : "active"),
    },
    {
      label: "Inactive",
      selected: statusFilter === "inactive",
      className: "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100 data-[active=true]:border-slate-600 data-[active=true]:bg-slate-600 data-[active=true]:text-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:data-[active=true]:border-slate-500 dark:data-[active=true]:bg-slate-500 dark:data-[active=true]:text-white",
      onClick: () => onStatusFilterChange(statusFilter === "inactive" ? "all" : "inactive"),
    },
    {
      label: "DB Connected",
      selected: healthFilter === "healthy",
      className: "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 data-[active=true]:border-emerald-600 data-[active=true]:bg-emerald-600 data-[active=true]:text-white dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50 dark:data-[active=true]:border-emerald-600 dark:data-[active=true]:bg-emerald-600 dark:data-[active=true]:text-white",
      onClick: () => onHealthFilterChange(healthFilter === "healthy" ? "all" : "healthy"),
    },
    {
      label: "DB Unreachable",
      selected: healthFilter === "unhealthy",
      className: "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 data-[active=true]:border-red-600 data-[active=true]:bg-red-600 data-[active=true]:text-white dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 dark:data-[active=true]:border-red-600 dark:data-[active=true]:bg-red-600 dark:data-[active=true]:text-white",
      onClick: () => onHealthFilterChange(healthFilter === "unhealthy" ? "all" : "unhealthy"),
    },
  ];

  return (
    <div className="-mx-1 mb-4 min-w-0 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:overflow-visible">
      <div className="flex w-max min-w-full flex-nowrap items-center gap-2 sm:w-auto sm:min-w-0 sm:flex-wrap">
        {filters.map((filter) => (
          <button
            key={filter.label}
            type="button"
            data-active={filter.selected}
            aria-pressed={filter.selected}
            onClick={filter.onClick}
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${filter.className}`}
          >
            {filter.label}
            {filter.selected && <X className="ml-0.5 h-3 w-3 opacity-70" />}
          </button>
        ))}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="shrink-0 px-1 text-xs text-muted-foreground underline underline-offset-2"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );
}
