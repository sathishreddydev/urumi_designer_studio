"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatStatus, getStatusColor } from "@/lib/utils";
import {
  Users,
  ShoppingBag,
  Shirt,
  IndianRupee,
  Clock,
  TrendingUp,
} from "lucide-react";

export default function ReportsPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", days],
    queryFn: async () => {
      const res = await fetch(`/api/reports?days=${days}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};
  const statusBreakdown = data?.statusBreakdown || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Reports</h1>
          <p className="text-sm text-muted-foreground">Business overview and analytics</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "outline"}
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <Users className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.totalCustomers}</p>
                <p className="text-xs text-muted-foreground">Total Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <ShoppingBag className="h-5 w-5 text-purple-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.totalOrders}</p>
                <p className="text-xs text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-pink-100 p-2">
                <Shirt className="h-5 w-5 text-pink-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.totalOutfits}</p>
                <p className="text-xs text-muted-foreground">Total Outfits</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <IndianRupee className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{summary.totalRevenue?.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2">
                <TrendingUp className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.ordersInPeriod}</p>
                <p className="text-xs text-muted-foreground">Orders (Last {days}d)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-cyan-100 p-2">
                <Clock className="h-5 w-5 text-cyan-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {summary.avgProductionDays ? `${summary.avgProductionDays} days` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Avg Production Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outfits by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(statusBreakdown).map(([status, count]: [string, any]) => (
              <div key={status} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <Badge className={`text-[10px] ${getStatusColor(status)}`}>
                  {formatStatus(status)}
                </Badge>
                <span className="text-sm font-bold">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
