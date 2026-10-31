
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { OutfitStatusBadge } from "@/components/outfit-status-badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  IndianRupee,
  TrendingUp,
  Clock,
  CalendarRange,
  BarChart3,
  Shirt,
} from "lucide-react";

import { SummaryStats } from "@/components/dashboard/summary-stats";

// Default: last 30 days
function defaultRange(): DateRange {
  return {
    from: subDays(new Date(), 29),
    to: new Date(),
  };
}

function formatRangeLabel(range: DateRange): string {
  if (!range.from) return "Select range";
  if (!range.to) return format(range.from, "dd MMM yyyy");

  return `${format(range.from, "dd MMM")} – ${format(range.to, "dd MMM yyyy")}`;
}

export function DashboardReports() {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [open, setOpen] = useState(false);

  const fromIso = range.from
    ? startOfDay(range.from).toISOString()
    : undefined;

  const toIso = range.to
    ? endOfDay(range.to).toISOString()
    : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["reports", fromIso, toIso],
    queryFn: async () => {
      if (!fromIso || !toIso) return null;

      const params = new URLSearchParams({
        from: fromIso,
        to: toIso,
      });

      const res = await fetch(`/api/reports?${params}`);

      if (!res.ok) return null;

      return res.json();
    },
    enabled: !!fromIso && !!toIso,
  });

  const spanDays =
    range.from && range.to
      ? Math.round(
        (range.to.getTime() - range.from.getTime()) / 86_400_000
      ) + 1
      : 0;

  const summary = data?.summary || {};
  const statusBreakdown = data?.statusBreakdown || {};

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
        </div>

        <div className="h-28 animate-pulse rounded-xl bg-muted sm:h-24" />

        <div className="space-y-3">
          <div className="h-4 w-36 animate-pulse rounded bg-muted" />
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="w-full min-w-0 space-y-3">

      {/* Header + Date Range */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Business Overview
          </p>
        </div>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 max-w-full gap-1.5 px-2.5 text-xs"
            >
              <CalendarRange className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {formatRangeLabel(range)}
              </span>
            </Button>
          </PopoverTrigger>

          <PopoverContent
            className="w-auto max-w-[calc(100vw-2rem)] p-0"
            align="end"
          >
            <div className="p-2">
              <Calendar
                mode="range"
                selected={range}
                defaultMonth={range.from ?? new Date()}
                onSelect={(r) => {
                  if (r) setRange(r);
                  if (r?.from && r?.to) setOpen(false);
                }}
                toDate={new Date()}
                fromYear={2020}
                toYear={new Date().getFullYear()}
                initialFocus
              />
              <div className="flex justify-end border-t pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setRange(defaultRange());
                    setOpen(false);
                  }}
                >
                  Reset to 30 days
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Summary Stats */}
      <SummaryStats
        stats={[
          {
            label: "Revenue",
            value: `₹${summary.totalRevenue?.toLocaleString() || 0}`,
            icon: IndianRupee,
            color: "green",
          },
          {
            label: `Orders (${spanDays}d)`,
            value: summary.ordersInPeriod || 0,
            icon: TrendingUp,
            color: "amber",
          },
          {
            label: "Avg Time",
            value: summary.avgProductionDays
              ? `${summary.avgProductionDays}d`
              : "—",
            icon: Clock,
            color: "cyan",
          },
        ]}
      />

      {/* Status Breakdown */}
      {Object.keys(statusBreakdown).length > 0 && (
        <section className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Shirt className="h-3.5 w-3.5 shrink-0" />
            Outfit Status
          </p>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {Object.entries(statusBreakdown).map(
                  ([status, count]: [string, any]) => (
                    <Link
                      key={status}
                      href={`/dashboard/outfits?status=${encodeURIComponent(
                        status.toLowerCase()
                      )}`}
                      aria-label={`View ${count} outfits with status ${status}`}
                      className="
                        flex min-w-0 items-center justify-between gap-2
                        rounded-md border px-2.5 py-2
                        transition-colors hover:bg-muted/70
                        focus-visible:outline-none
                        focus-visible:ring-2 focus-visible:ring-ring
                      "
                    >
                      <OutfitStatusBadge
                        status={status}
                        className="min-w-0 max-w-[calc(100%-1.5rem)] truncate text-[10px]"
                        responsive={true}
                      />

                      <span className="shrink-0 text-xs font-bold tabular-nums">
                        {count}
                      </span>
                    </Link>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
