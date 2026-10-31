"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { DeadlineAlerts } from "@/components/dashboard/deadline-alerts";
import { DashboardReports } from "@/components/dashboard/dashboard-reports";
import {
  Users,
  ShoppingBag,
  Shirt,
  Scissors,
  CheckCircle,
  Clock,
  AlertTriangle,
  PackageCheck,
} from "lucide-react";
import StatCard from "@/components/dashboard/statCard";

export default function DashboardPage() {
  const outfitStatusHref = (status: string) => `/dashboard/outfits?status=${encodeURIComponent(status.toLowerCase())}`;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    refetchInterval: 60_000, // Also poll every 60s as backup
  });

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 mt-2 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-4 w-20 animate-pulse rounded bg-muted mb-2" />
                <div className="h-6 w-12 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (stats.role === "ADMIN" || stats.role === "STORE_MANAGER" || stats.role === "RECEPTION") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Welcome back, {stats.name}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Overview</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            <StatCard title="Total Customers" value={stats.customers} icon={<Users className="h-4 w-4" />} href="/dashboard/customers" />
            <StatCard title="Active Orders" value={stats.activeOrders} icon={<ShoppingBag className="h-4 w-4" />} href="/dashboard/orders" />
            <StatCard title="Total Outfits" value={stats.totalOutfits} icon={<Shirt className="h-4 w-4" />} href="/dashboard/outfits" />
            <StatCard title="Delivered" value={stats.delivered} icon={<CheckCircle className="h-4 w-4" />} href={outfitStatusHref("DELIVERED")} />
          </div>
        </div>

        {stats.role === "ADMIN" && <DashboardReports />}
        <DeadlineAlerts />
      </div>
    );
  }

  if (stats.role === "DESIGNER") {
    // Items that need the designer's attention right now
    const actionRequired =
      stats.waitingReferences +
      stats.waitingDependencies +
      stats.maggamReview +
      stats.productionCompleted +
      stats.trials +
      stats.alterations +
      stats.qc;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold ">Designer Dashboard</h1>
          <p className="text-xs text-muted-foreground">Welcome back, {stats.name}</p>
        </div>

        {/* Needs attention */}
        {actionRequired > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Needs Attention</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stats.waitingReferences > 0 && (
                <StatCard title="Waiting for References" value={stats.waitingReferences} icon={<Clock className="h-4 w-4" />} href={outfitStatusHref("WAITING_FOR_REFERENCES")} highlight />
              )}
              {stats.waitingDependencies > 0 && (
                <StatCard title="Blocked (Dependencies)" value={stats.waitingDependencies} icon={<AlertTriangle className="h-4 w-4" />} href="/dashboard/blockers" highlight />
              )}
              {stats.maggamReview > 0 && (
                <StatCard title="Maggam Review" value={stats.maggamReview} icon={<Scissors className="h-4 w-4" />} href="/dashboard/stitching-maggam" highlight />
              )}
              {stats.productionCompleted > 0 && (
                <StatCard title="Schedule Trial" value={stats.productionCompleted} icon={<CheckCircle className="h-4 w-4" />} href={outfitStatusHref("PRODUCTION_COMPLETED")} highlight />
              )}
              {stats.trials > 0 && (
                <StatCard title="Trials" value={stats.trials} icon={<Users className="h-4 w-4" />} href={outfitStatusHref("TRIAL")} highlight />
              )}
              {stats.alterations > 0 && (
                <StatCard title="Alterations" value={stats.alterations} icon={<Shirt className="h-4 w-4" />} href={outfitStatusHref("ALTERATION")} highlight />
              )}
              {stats.qc > 0 && (
                <StatCard title="QC" value={stats.qc} icon={<CheckCircle className="h-4 w-4" />} href={outfitStatusHref("QC")} highlight />
              )}
            </div>
          </div>
        )}

        {/* Pipeline overview */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pipeline</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard title="Unstarted" value={stats.unstarted} icon={<Shirt className="h-4 w-4" />} href={outfitStatusHref("DRAFT")} />
            <StatCard title="In Design" value={stats.inDesign} icon={<Scissors className="h-4 w-4" />} href={outfitStatusHref("DESIGN_IN_PROGRESS")} />
            <StatCard title="In Production" value={stats.productionReleased} icon={<Clock className="h-4 w-4" />} href="/dashboard/production" />
            <StatCard title="Ready for Delivery" value={stats.readyForDelivery} icon={<PackageCheck className="h-4 w-4" />} href={outfitStatusHref("READY_FOR_DELIVERY")} />
          </div>
        </div>

        <DeadlineAlerts />
      </div>
    );
  }

  if (stats.role === "MASTER") {
    const hasActiveWork =
      stats.patternDrafting + stats.maggamWork + stats.maggamReview +
      stats.fabricCutting + stats.stitching > 0;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Production Dashboard</h1>
          <p className="text-xs text-muted-foreground">Welcome back, {stats.name}</p>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            title="Ready for Me"
            value={stats.productionReady}
            icon={<Scissors className="h-4 w-4" />}
            href="/dashboard/production"
            highlight={stats.productionReady > 0}
          />
          <StatCard
            title="In Progress"
            value={stats.totalActive}
            icon={<Clock className="h-4 w-4" />}
            href="/dashboard/stitching-maggam"
          />
          <StatCard
            title="Done / Awaiting QC"
            value={stats.productionCompleted}
            icon={<CheckCircle className="h-4 w-4" />}
            href="/dashboard/production"
            highlight={stats.productionCompleted > 0}
          />
        </div>

        {/* Stage breakdown — only shown when there's active work */}
        {hasActiveWork && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Stage Breakdown</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stats.patternDrafting > 0 && (
                <StatCard title="Pattern Drafting" value={stats.patternDrafting} icon={<Scissors className="h-4 w-4" />} href="/dashboard/stitching-maggam" />
              )}
              {stats.maggamWork > 0 && (
                <StatCard title="Maggam Work" value={stats.maggamWork} icon={<Shirt className="h-4 w-4" />} href="/dashboard/stitching-maggam" />
              )}
              {stats.maggamReview > 0 && (
                <StatCard title="Maggam Review" value={stats.maggamReview} icon={<Clock className="h-4 w-4" />} href="/dashboard/stitching-maggam" highlight />
              )}
              {stats.fabricCutting > 0 && (
                <StatCard title="Fabric Cutting" value={stats.fabricCutting} icon={<Scissors className="h-4 w-4" />} href="/dashboard/stitching-maggam" />
              )}
              {stats.stitching > 0 && (
                <StatCard title="Stitching" value={stats.stitching} icon={<Shirt className="h-4 w-4" />} href="/dashboard/stitching-maggam" />
              )}
            </div>
          </div>
        )}

        {/* Completed outfits — full history for this master */}
        {stats.delivered > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">History</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard
                title="Delivered"
                value={stats.delivered}
                icon={<CheckCircle className="h-4 w-4" />}
                href={outfitStatusHref("DELIVERED")}
              />
            </div>
          </div>
        )}

        <DeadlineAlerts />
      </div>
    );
  }

  return null;
}


