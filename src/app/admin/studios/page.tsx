import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { masterDb, studios } from "@/lib/db/master";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Search } from "lucide-react";
import { StudioSearch } from "./studio-search";

export default async function AdminStudiosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  const params = await searchParams;
  const query = params.q || "";
  const statusFilter = params.status || "";

  // Fetch all studios (in production, add pagination)
  let allStudios = await masterDb.select().from(studios);

  // Filter by search query
  if (query) {
    const q = query.toLowerCase();
    allStudios = allStudios.filter(
      (s) =>
        s.brandName.toLowerCase().includes(q) ||
        s.domain.toLowerCase().includes(q) ||
        s.businessEmail?.toLowerCase().includes(q)
    );
  }

  // Filter by status
  if (statusFilter && statusFilter !== "all") {
    allStudios = allStudios.filter((s) => s.status === statusFilter);
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">All Studios</h1>
        <p className="text-sm text-muted-foreground">
          {allStudios.length} studio{allStudios.length !== 1 ? "s" : ""}
          {query && ` matching "${query}"`}
        </p>
      </div>

      {/* Search + filter */}
      <StudioSearch initialQuery={query} initialStatus={statusFilter} />

      {/* Studios table */}
      <Card>
        <CardContent className="p-0">
          {allStudios.length === 0 ? (
            <p className="text-sm text-muted-foreground p-8 text-center">
              {query
                ? `No studios found matching "${query}"`
                : "No studios registered yet."}
            </p>
          ) : (
            <div className="divide-y">
              {allStudios.map((studio) => (
                <Link
                  key={studio.id}
                  href={`/admin/studios/${studio.id}`}
                  className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{studio.brandName}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
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
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {studio.domain}
                    </p>
                    {studio.businessEmail && (
                      <p className="text-xs text-muted-foreground truncate">
                        {studio.businessEmail}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-xs text-muted-foreground capitalize hidden sm:block">
                      {studio.planType}
                    </span>
                    {studio.dnsVerified ? (
                      <span className="text-xs text-green-600">✓ DNS</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        ⏳ DNS
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
