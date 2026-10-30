
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OutfitStatusBadge } from "@/components/outfit-status-badge";

import {
  AlertTriangle,
  Clock,
  Calendar,
} from "lucide-react";

function daysUntil(date: string | Date): number {
  const target = new Date(date);
  const now = new Date();

  return Math.ceil(
    (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function dateLabel(date: string | Date): string {
  const days = daysUntil(date);

  if (days < -1) return `${Math.abs(days)}d overdue`;
  if (days === -1) return "1d overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";

  return `${days}d`;
}

function dateCellColor(date: string | Date): string {
  const days = daysUntil(date);

  if (days < 0) return "text-red-600 dark:text-red-400";
  if (days <= 1) return "text-amber-600 dark:text-amber-400";

  return "text-blue-600 dark:text-blue-400";
}

type AlertRow = {
  id: string;
  name: string;
  customerName: string;
  orderNumber: string;
  status: string;
  trialDate?: string | null;
  deliveryDate?: string | null;
  severity: "overdue" | "due-soon" | "trial";
};

export function DeadlineAlerts() {
  const { data, isLoading } = useQuery({
    queryKey: ["deadlines"],
    queryFn: async () => {
      const res = await fetch("/api/deadlines");

      if (!res.ok) {
        return {
          overdue: [],
          dueSoon: [],
          upcomingTrials: [],
          totalAlerts: 0,
        };
      }

      return res.json();
    },
    refetchInterval: 60000,
  });

  if (isLoading || !data || data.totalAlerts === 0) return null;

  // Merge alerts and remove duplicates.
  // Priority: Overdue > Due Soon > Trial.

  const seen = new Set<string>();
  const rows: AlertRow[] = [];

  for (const o of data.overdue || []) {
    if (!seen.has(o.id)) {
      seen.add(o.id);
      rows.push({ ...o, severity: "overdue" });
    }
  }

  for (const o of data.dueSoon || []) {
    if (!seen.has(o.id)) {
      seen.add(o.id);
      rows.push({ ...o, severity: "due-soon" });
    }
  }

  for (const o of data.upcomingTrials || []) {
    if (!seen.has(o.id)) {
      seen.add(o.id);
      rows.push({ ...o, severity: "trial" });
    }
  }

  const severityIcon = (severity: AlertRow["severity"]) => {
    switch (severity) {
      case "overdue":
        return (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
        );

      case "due-soon":
        return (
          <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        );

      default:
        return (
          <Calendar className="h-3.5 w-3.5 shrink-0 text-blue-500" />
        );
    }
  };

  const renderDate = (
    label: string,
    date?: string | null
  ) => (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <p
        className={`truncate text-[10px] font-semibold ${date ? dateCellColor(date) : "text-muted-foreground"
          }`}
      >
        {date ? dateLabel(date) : "—"}
      </p>
    </div>
  );

  return (
    <Card className="overflow-hidden">

      {/* Header - Same typography as DashboardReports */}
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />

          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Deadlines &amp; Trials
          </p>

          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {rows.length}
          </Badge>
        </div>
      </div>

      <CardContent className="p-0">

        {/* Desktop / Tablet */}
        <div className="hidden sm:block">

          {/* Table Header */}
          <div className="
            grid grid-cols-[1rem_minmax(0,1fr)_7rem_4.5rem_4.5rem]
            items-center gap-x-3
            border-y bg-muted/30
            px-4 py-2
            text-[10px] font-semibold uppercase tracking-wide text-muted-foreground
          ">
            <span />
            <span>Outfit / Customer</span>
            <span className="text-right">Status</span>
            <span className="text-right">Trial</span>
            <span className="text-right">Delivery</span>
          </div>

          {/* Table Rows */}
          <div className="divide-y">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={`/dashboard/outfits/${row.id}?from=outfits`}
                className="
                  grid grid-cols-[1rem_minmax(0,1fr)_7rem_4.5rem_4.5rem]
                  items-center gap-x-3
                  px-4 py-2.5
                  transition-colors hover:bg-muted/40
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring
                "
              >
                {/* Severity */}
                <span className="flex justify-center">
                  {severityIcon(row.severity)}
                </span>

                {/* Outfit / Customer */}
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-xs font-medium">
                    {row.name}
                  </p>

                  <p className="truncate text-[10px] text-muted-foreground">
                    {row.customerName} · {row.orderNumber}
                  </p>
                </div>

                {/* Status */}
                <div className="flex min-w-0 justify-end">
                  <OutfitStatusBadge
                    status={row.status}
                    className="max-w-full shrink-0 truncate text-[9px]"
                  />
                </div>

                {/* Trial */}
                <span
                  className={`truncate text-right text-[10px] font-medium ${row.trialDate
                      ? dateCellColor(row.trialDate)
                      : "text-muted-foreground"
                    }`}
                >
                  {row.trialDate ? dateLabel(row.trialDate) : "—"}
                </span>

                {/* Delivery */}
                <span
                  className={`truncate text-right text-[10px] font-medium ${row.deliveryDate
                      ? dateCellColor(row.deliveryDate)
                      : "text-muted-foreground"
                    }`}
                >
                  {row.deliveryDate ? dateLabel(row.deliveryDate) : "—"}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Mobile */}
        <div className="divide-y sm:hidden">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/dashboard/outfits/${row.id}?from=outfits`}
              className="
                block space-y-2.5 px-3 py-3
                transition-colors hover:bg-muted/40
                active:bg-muted/60
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring
              "
            >
              {/* Outfit Details */}
              <div className="flex min-w-0 items-start gap-2.5">

                <div className="mt-0.5 shrink-0">
                  {severityIcon(row.severity)}
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-xs font-semibold">
                    {row.name}
                  </p>

                  <p className="truncate text-[10px] text-muted-foreground">
                    {row.customerName} · {row.orderNumber}
                  </p>
                </div>

                <OutfitStatusBadge
                  status={row.status}
                  className="max-w-[40%] shrink-0 truncate text-[9px]"
                />
              </div>

              {/* Trial & Delivery */}
              <div className="grid grid-cols-2 gap-2 pl-6">

                <div className="rounded-md bg-muted/50 px-2.5 py-2">
                  {renderDate("Trial Date", row.trialDate)}
                </div>

                <div className="rounded-md bg-muted/50 px-2.5 py-2">
                  {renderDate("Delivery Date", row.deliveryDate)}
                </div>

              </div>
            </Link>
          ))}
        </div>

      </CardContent>
    </Card>
  );
}
