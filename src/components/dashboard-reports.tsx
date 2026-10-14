"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatStatus, getStatusColor } from "@/lib/utils";
import { IndianRupee, TrendingUp, Clock, CalendarRange } from "lucide-react";

// Default: last 30 days
function defaultRange(): DateRange {
  return { from: subDays(new Date(), 29), to: new Date() };
}

function formatRangeLabel(range: DateRange): string {
  if (!range.from) return "Select range";
  if (!range.to) return format(range.from, "dd MMM yyyy");
  return `${format(range.from, "dd MMM")} – ${format(range.to, "dd MMM yyyy")}`;
}

export function DashboardReports() {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [open, setOpen] = useState(false);

  const fromIso = range.from ? startOfDay(range.from).toISOString() : undefined;
  const toIso   = range.to   ? endOfDay(range.to).toISOString()     : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["reports", fromIso, toIso],
    queryFn: async () => {
      if (!fromIso || !toIso) return null;
      const params = new URLSearchParams({ from: fromIso, to: toIso });
      const res = await fetch(`/api/reports?${params}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!fromIso && !!toIso,
  });

  // Days span for the label in the Orders card
  const spanDays = range.from && range.to
    ? Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) + 1
    : 0;

  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const summary = data.summary || {};
  const statusBreakdown = data.statusBreakdown || {};

  return (
    <div className="space-y-4">
      {/* Header + date range picker */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Business Overview</h3>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1.5">
              <CalendarRange className="h-3.5 w-3.5 shrink-0" />
              {formatRangeLabel(range)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={range}
              onSelect={(r) => {
                if (r) setRange(r);
                if (r?.from && r?.to) setOpen(false);
              }}
              toDate={new Date()}
              fromYear={2020}
              toYear={new Date().getFullYear()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Revenue cards — 1 col on xs, 3 on sm+ */}
      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardContent className="pt-3 pb-3 px-3">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-green-100 p-1.5 dark:bg-green-900/30 shrink-0">
                <IndianRupee className="h-3.5 w-3.5 text-green-700 dark:text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">₹{summary.totalRevenue?.toLocaleString() || 0}</p>
                <p className="text-[10px] text-muted-foreground">Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 pb-3 px-3">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-amber-100 p-1.5 dark:bg-amber-900/30 shrink-0">
                <TrendingUp className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold">{summary.ordersInPeriod || 0}</p>
                <p className="text-[10px] text-muted-foreground">Orders ({spanDays}d)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 pb-3 px-3">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-cyan-100 p-1.5 dark:bg-cyan-900/30 shrink-0">
                <Clock className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold">
                  {summary.avgProductionDays ? `${summary.avgProductionDays}d` : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">Avg Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      {Object.keys(statusBreakdown).length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-medium">Outfits by Status</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Object.entries(statusBreakdown).map(([status, count]: [string, any]) => (
                <div key={status} className="flex items-center justify-between rounded border px-2 py-1.5 min-w-0 gap-2">
                  <Badge className={`text-[9px] min-w-0 truncate max-w-[calc(100%-2rem)] ${getStatusColor(status)}`}>
                    {formatStatus(status)}
                  </Badge>
                  <span className="text-xs font-bold shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
