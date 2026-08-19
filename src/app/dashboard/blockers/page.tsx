"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingButton } from "@/components/ui/loading-button";
import { AlertTriangle, CheckCircle, Clock, Shirt, User } from "lucide-react";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

const TYPE_COLORS: Record<string, string> = {
  FABRIC: "bg-orange-100 text-orange-700",
  LINING: "bg-blue-100 text-blue-700",
  DYEING: "bg-purple-100 text-purple-700",
  ACCESSORIES: "bg-pink-100 text-pink-700",
  STONES: "bg-amber-100 text-amber-700",
  CANVAS: "bg-cyan-100 text-cyan-700",
  CUPS: "bg-teal-100 text-teal-700",
};

export default function BlockersPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const { data: blockers, isLoading } = useQuery({
    queryKey: ["active-blockers"],
    queryFn: async () => {
      const res = await fetch("/api/dependencies");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ outfitId, depId }: { outfitId: string; depId: string }) => {
      const res = await fetch(`/api/outfits/${outfitId}/dependencies`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependencyId: depId, status: "AVAILABLE" }),
      });
      if (!res.ok) throw new Error("Failed to resolve");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-blockers"] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold lg:text-3xl flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <span>Blockers</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {blockers?.length || 0} active dependency blocker{blockers?.length !== 1 ? "s" : ""} across all outfits
        </p>
      </div>

      {(!blockers || blockers.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-10 w-10 mx-auto text-green-500 mb-3" />
            <p className="font-medium">All Clear</p>
            <p className="text-sm text-muted-foreground">No active blockers. Production is running smoothly.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {blockers.map((blocker: any) => (
            <Card key={blocker.id} className="border-l-4 border-l-red-400">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left: Info */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={TYPE_COLORS[blocker.type] || "bg-gray-100 text-gray-700"}>
                        {blocker.type.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant={blocker.status === "BLOCKED" ? "destructive" : "secondary"}>
                        {blocker.status}
                      </Badge>
                    </div>

                    <Link
                      href={`/dashboard/outfits/${blocker.outfit?.id}`}
                      className="flex items-center gap-1.5 hover:underline"
                    >
                      <Shirt className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{blocker.outfit?.name}</span>
                      <span className="text-xs text-muted-foreground">· {blocker.outfit?.type}</span>
                    </Link>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" /> {blocker.customerName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatDate(blocker.createdAt)}
                      </span>
                      {blocker.outfit?.status && (
                        <Badge className={`text-[10px] ${getStatusColor(blocker.outfit.status)}`}>
                          {formatStatus(blocker.outfit.status)}
                        </Badge>
                      )}
                    </div>

                    {blocker.notes && (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 mt-1">
                        "{blocker.notes}"
                      </p>
                    )}
                  </div>

                  {/* Right: Action */}
                  {can("update", "dependency") && blocker.status !== "AVAILABLE" && (
                    <LoadingButton
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-green-700 border-green-300 hover:bg-green-50 hover:text-green-800"
                      loading={resolveMutation.isPending}
                      loadingText="Resolving..."
                      onClick={() =>
                        resolveMutation.mutate({ outfitId: blocker.outfitId, depId: blocker.id })
                      }
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Mark Resolved
                    </LoadingButton>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
