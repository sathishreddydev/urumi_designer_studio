"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeadlineAlerts } from "@/components/deadline-alerts";
import { DashboardReports } from "@/components/dashboard-reports";
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

export default function DashboardPage() {
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

  if (stats.role === "ADMIN" || stats.role === "RECEPTION") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {stats.name}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          <StatCard title="Total Customers" value={stats.customers} icon={<Users className="h-4 w-4" />} />
          <StatCard title="Active Orders" value={stats.activeOrders} icon={<ShoppingBag className="h-4 w-4" />} />
          <StatCard title="Total Outfits" value={stats.totalOutfits} icon={<Shirt className="h-4 w-4" />} />
          <StatCard title="Production Ready" value={stats.productionReady} icon={<Scissors className="h-4 w-4" />} />
          <StatCard title="In Production" value={stats.inProduction} icon={<Clock className="h-4 w-4" />} />
          <StatCard title="Pending Trials" value={stats.pendingTrials} icon={<AlertTriangle className="h-4 w-4" />} />
          <StatCard title="Ready for Delivery" value={stats.readyForDelivery} icon={<PackageCheck className="h-4 w-4" />} />
          <StatCard title="Delivered" value={stats.delivered} icon={<CheckCircle className="h-4 w-4" />} />
        </div>
        <DashboardReports />
        <DeadlineAlerts />
      </div>
    );
  }

  if (stats.role === "DESIGNER") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Designer Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {stats.name}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard title="New Consultations" value={stats.newConsultations} icon={<Users className="h-4 w-4" />} />
          <StatCard title="Pending Designs" value={stats.pendingDesigns} icon={<Shirt className="h-4 w-4" />} />
          <StatCard title="Waiting for References" value={stats.waitingReferences} icon={<Clock className="h-4 w-4" />} />
          <StatCard title="Waiting for Dependencies" value={stats.waitingDependencies} icon={<AlertTriangle className="h-4 w-4" />} />
          <StatCard title="Production Released" value={stats.productionReleased} icon={<Scissors className="h-4 w-4" />} />
          <StatCard title="Trials" value={stats.trials} icon={<CheckCircle className="h-4 w-4" />} />
        </div>
        <DeadlineAlerts />
      </div>
    );
  }

  if (stats.role === "MASTER") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Production Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {stats.name}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard title="Pattern Drafting" value={stats.patternDrafting} icon={<Scissors className="h-4 w-4" />} />
          <StatCard title="Maggam Work" value={stats.maggamWork} icon={<Shirt className="h-4 w-4" />} />
          <StatCard title="Fabric Cutting" value={stats.fabricCutting} icon={<Clock className="h-4 w-4" />} />
          <StatCard title="Stitching" value={stats.stitching} icon={<CheckCircle className="h-4 w-4" />} />
        </div>
        <DeadlineAlerts />
      </div>
    );
  }

  return null;
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-4 sm:pb-2">
        <CardTitle className="text-xs font-medium sm:text-sm">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
        <div className="text-xl font-bold sm:text-2xl">{value}</div>
      </CardContent>
    </Card>
  );
}
