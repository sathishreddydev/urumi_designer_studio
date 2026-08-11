import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { customers, orders, outfits } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

async function getAdminStats() {
  const [{ total: totalCustomers }] = await db.select({ total: count() }).from(customers);
  const [{ total: activeOrders }] = await db
    .select({ total: count() })
    .from(orders)
    .where(eq(orders.status, "Active"));

  const statusCounts = await db
    .select({ status: outfits.status, count: count() })
    .from(outfits)
    .groupBy(outfits.status);

  const counts: Record<string, number> = {};
  statusCounts.forEach((s) => { counts[s.status] = s.count; });

  return {
    customers: totalCustomers,
    activeOrders,
    totalOutfits: statusCounts.reduce((sum, s) => sum + s.count, 0),
    productionReady: counts["PRODUCTION_READY"] || 0,
    inProduction:
      (counts["PATTERN_DRAFTING"] || 0) +
      (counts["MAGGAM_WORK"] || 0) +
      (counts["FABRIC_CUTTING"] || 0) +
      (counts["STITCHING"] || 0),
    pendingTrials: counts["TRIAL"] || 0,
    readyForDelivery: counts["READY_FOR_DELIVERY"] || 0,
    delivered: counts["DELIVERED"] || 0,
  };
}

async function getDesignerStats(designerId: string) {
  const statusCounts = await db
    .select({ status: outfits.status, count: count() })
    .from(outfits)
    .where(eq(outfits.designerId, designerId))
    .groupBy(outfits.status);

  const counts: Record<string, number> = {};
  statusCounts.forEach((s) => { counts[s.status] = s.count; });

  return {
    newConsultations: counts["DRAFT"] || 0,
    pendingDesigns: counts["DESIGN_IN_PROGRESS"] || 0,
    waitingReferences: counts["WAITING_FOR_REFERENCES"] || 0,
    waitingDependencies: counts["WAITING_FOR_DEPENDENCIES"] || 0,
    productionReleased: counts["PRODUCTION_READY"] || 0,
    trials: counts["TRIAL"] || 0,
  };
}

async function getMasterStats(masterId: string) {
  const statusCounts = await db
    .select({ status: outfits.status, count: count() })
    .from(outfits)
    .where(eq(outfits.masterId, masterId))
    .groupBy(outfits.status);

  const counts: Record<string, number> = {};
  statusCounts.forEach((s) => { counts[s.status] = s.count; });

  return {
    patternDrafting: counts["PATTERN_DRAFTING"] || 0,
    maggamWork: counts["MAGGAM_WORK"] || 0,
    fabricCutting: counts["FABRIC_CUTTING"] || 0,
    stitching: counts["STITCHING"] || 0,
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  if (session.role === "ADMIN" || session.role === "RECEPTION") {
    const stats = await getAdminStats();
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {session.name}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Customers" value={stats.customers} icon={<Users className="h-5 w-5" />} />
          <StatCard title="Active Orders" value={stats.activeOrders} icon={<ShoppingBag className="h-5 w-5" />} />
          <StatCard title="Total Outfits" value={stats.totalOutfits} icon={<Shirt className="h-5 w-5" />} />
          <StatCard title="Production Ready" value={stats.productionReady} icon={<Scissors className="h-5 w-5" />} />
          <StatCard title="In Production" value={stats.inProduction} icon={<Clock className="h-5 w-5" />} />
          <StatCard title="Pending Trials" value={stats.pendingTrials} icon={<AlertTriangle className="h-5 w-5" />} />
          <StatCard title="Ready for Delivery" value={stats.readyForDelivery} icon={<PackageCheck className="h-5 w-5" />} />
          <StatCard title="Delivered" value={stats.delivered} icon={<CheckCircle className="h-5 w-5" />} />
        </div>
      </div>
    );
  }

  if (session.role === "DESIGNER") {
    const stats = await getDesignerStats(session.id);
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Designer Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {session.name}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard title="New Consultations" value={stats.newConsultations} icon={<Users className="h-5 w-5" />} />
          <StatCard title="Pending Designs" value={stats.pendingDesigns} icon={<Shirt className="h-5 w-5" />} />
          <StatCard title="Waiting for References" value={stats.waitingReferences} icon={<Clock className="h-5 w-5" />} />
          <StatCard title="Waiting for Dependencies" value={stats.waitingDependencies} icon={<AlertTriangle className="h-5 w-5" />} />
          <StatCard title="Production Released" value={stats.productionReleased} icon={<Scissors className="h-5 w-5" />} />
          <StatCard title="Trials Today" value={stats.trials} icon={<CheckCircle className="h-5 w-5" />} />
        </div>
      </div>
    );
  }

  if (session.role === "MASTER") {
    const stats = await getMasterStats(session.id);
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Production Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {session.name}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Pattern Drafting" value={stats.patternDrafting} icon={<Scissors className="h-5 w-5" />} />
          <StatCard title="Maggam Work" value={stats.maggamWork} icon={<Shirt className="h-5 w-5" />} />
          <StatCard title="Fabric Cutting" value={stats.fabricCutting} icon={<Clock className="h-5 w-5" />} />
          <StatCard title="Stitching" value={stats.stitching} icon={<CheckCircle className="h-5 w-5" />} />
        </div>
      </div>
    );
  }

  return null;
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
