"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatStatus, getStatusColor } from "@/lib/utils";
import { IndianRupee, TrendingUp, Clock } from "lucide-react";

export function DashboardReports() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", days],
    queryFn: async () => {
      const res = await fetch(`/api/reports?days=${days}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

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
      {/* Period selector + revenue cards */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Business Overview</h3>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-green-100 p-1.5 dark:bg-green-900/30">
                <IndianRupee className="h-3.5 w-3.5 text-green-700 dark:text-green-400" />
              </div>
              <div>
                <p className="text-base font-bold sm:text-lg">₹{summary.totalRevenue?.toLocaleString() || 0}</p>
                <p className="text-[10px] text-muted-foreground">Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-amber-100 p-1.5 dark:bg-amber-900/30">
                <TrendingUp className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-base font-bold sm:text-lg">{summary.ordersInPeriod || 0}</p>
                <p className="text-[10px] text-muted-foreground">Orders ({days}d)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-cyan-100 p-1.5 dark:bg-cyan-900/30">
                <Clock className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-base font-bold sm:text-lg">
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
            <div className="grid gap-1.5 grid-cols-2 sm:grid-cols-3">
              {Object.entries(statusBreakdown).map(([status, count]: [string, any]) => (
                <div key={status} className="flex items-center justify-between rounded border px-2 py-1.5">
                  <Badge className={`text-[9px] ${getStatusColor(status)}`}>
                    {formatStatus(status)}
                  </Badge>
                  <span className="text-xs font-bold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
