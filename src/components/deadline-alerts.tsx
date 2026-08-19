"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Calendar } from "lucide-react";
import { formatStatus, getStatusColor } from "@/lib/utils";

function daysUntil(date: string | Date): number {
  const target = new Date(date);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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
  if (days < 0) return "text-red-600 font-semibold";
  if (days <= 1) return "text-amber-600 font-semibold";
  return "text-blue-600 font-medium";
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
      if (!res.ok) return { overdue: [], dueSoon: [], upcomingTrials: [], totalAlerts: 0 };
      return res.json();
    },
    refetchInterval: 60000,
  });

  if (isLoading || !data || data.totalAlerts === 0) return null;

  // Merge all alerts into one flat list, deduped by outfit ID.
  // Priority: overdue > due-soon > trial
  const seen = new Set<string>();
  const rows: AlertRow[] = [];

  for (const o of data.overdue) {
    if (!seen.has(o.id)) { seen.add(o.id); rows.push({ ...o, severity: "overdue" }); }
  }
  for (const o of data.dueSoon) {
    if (!seen.has(o.id)) { seen.add(o.id); rows.push({ ...o, severity: "due-soon" }); }
  }
  for (const o of data.upcomingTrials) {
    if (!seen.has(o.id)) { seen.add(o.id); rows.push({ ...o, severity: "trial" }); }
  }

  const severityIcon = (s: AlertRow["severity"]) => {
    if (s === "overdue")  return <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
    if (s === "due-soon") return <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
    return <Calendar className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Deadlines &amp; Trials
          <Badge variant="secondary" className="ml-1">{rows.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {/* Desktop: Table layout */}
        <div className="hidden sm:block">
          <div className="grid grid-cols-[1rem_1fr_auto_auto_auto] gap-x-3 px-4 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b">
            <span />
            <span>Outfit · Customer</span>
            <span className="text-right">Status</span>
            <span className="text-right w-16">Trial</span>
            <span className="text-right w-16">Delivery</span>
          </div>
          <div className="divide-y">
            {rows.map((row) => (
              <Link key={row.id} href={`/dashboard/outfits/${row.id}`}>
                <div className="grid grid-cols-[1rem_1fr_auto_auto_auto] gap-x-3 items-center px-4 py-2 hover:bg-muted/40 transition-colors">
                  <span className="flex justify-center">{severityIcon(row.severity)}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{row.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {row.customerName} · {row.orderNumber}
                    </p>
                  </div>
                  <Badge className={`text-[9px] shrink-0 ${getStatusColor(row.status)}`}>
                    {formatStatus(row.status)}
                  </Badge>
                  <span className={`text-[10px] text-right w-16 shrink-0 ${row.trialDate ? dateCellColor(row.trialDate) : "text-muted-foreground"}`}>
                    {row.trialDate ? dateLabel(row.trialDate) : "—"}
                  </span>
                  <span className={`text-[10px] text-right w-16 shrink-0 ${row.deliveryDate ? dateCellColor(row.deliveryDate) : "text-muted-foreground"}`}>
                    {row.deliveryDate ? dateLabel(row.deliveryDate) : "—"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Mobile: Card layout */}
        <div className="sm:hidden divide-y">
          {rows.map((row) => (
            <Link key={row.id} href={`/dashboard/outfits/${row.id}`}>
              <div className="flex items-start gap-2 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                <span className="mt-0.5 shrink-0">{severityIcon(row.severity)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{row.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {row.customerName} · {row.orderNumber}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <Badge className={`text-[9px] ${getStatusColor(row.status)}`}>
                      {formatStatus(row.status)}
                    </Badge>
                    {row.trialDate && (
                      <span className={`text-[10px] ${dateCellColor(row.trialDate)}`}>
                        Trial: {dateLabel(row.trialDate)}
                      </span>
                    )}
                    {row.deliveryDate && (
                      <span className={`text-[10px] ${dateCellColor(row.deliveryDate)}`}>
                        Delivery: {dateLabel(row.deliveryDate)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
