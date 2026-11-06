import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { masterDb, studios } from "@/lib/db/master";
import { eq, count, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export default async function AdminOverviewPage() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  // Get counts by status
  const allStudios = await masterDb.select().from(studios);

  const stats = {
    total: allStudios.length,
    active: allStudios.filter((s) => s.status === "active").length,
    trial: allStudios.filter((s) => s.status === "trial").length,
    suspended: allStudios.filter((s) => s.status === "suspended").length,
  };

  const stats_cards = [
    {
      title: "Total Studios",
      value: stats.total,
      icon: Building2,
      desc: "All registered",
    },
    {
      title: "Active",
      value: stats.active,
      icon: CheckCircle2,
      desc: "Paying customers",
    },
    {
      title: "Trial",
      value: stats.trial,
      icon: Clock,
      desc: "14-day trials",
    },
    {
      title: "Suspended",
      value: stats.suspended,
      icon: AlertCircle,
      desc: "Needs attention",
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Platform Overview</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {admin.name}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats_cards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent studios */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Studios</h2>
        <Card>
          <CardContent className="p-0">
            {allStudios.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">
                No studios registered yet. Share your signup link to get
                started!
              </p>
            ) : (
              <div className="divide-y">
                {allStudios.slice(0, 5).map((studio) => (
                  <div
                    key={studio.id}
                    className="flex items-center justify-between p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{studio.brandName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {studio.domain}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          studio.status === "active"
                            ? "bg-green-100 text-green-700"
                            : studio.status === "trial"
                            ? "bg-blue-100 text-blue-700"
                            : studio.status === "suspended"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {studio.status}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize hidden sm:block">
                        {studio.planType}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
