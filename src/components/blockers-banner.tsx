"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, X } from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/hooks/use-permissions";

export function BlockersBanner() {
  const { can, role } = usePermissions();
  const queryClient = useQueryClient();

  const { data: blockers } = useQuery({
    queryKey: ["active-blockers"],
    queryFn: async () => {
      const res = await fetch("/api/dependencies");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000, // refresh every 30s
    enabled: role === "ADMIN" || role === "DESIGNER",
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ outfitId, depId }: { outfitId: string; depId: string }) => {
      const res = await fetch(`/api/outfits/${outfitId}/dependencies`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependencyId: depId, status: "AVAILABLE" }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-blockers"] });
    },
  });

  if (!blockers || blockers.length === 0) return null;
  if (role !== "ADMIN" && role !== "DESIGNER") return null;

  return (
    <div className="rounded-lg border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <span className="text-sm font-semibold text-red-800 dark:text-red-200">
          {blockers.length} Active Blocker{blockers.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-1.5">
        {blockers.slice(0, 5).map((b: any) => (
          <div
            key={b.id}
            className="flex items-center justify-between gap-2 rounded bg-white/60 dark:bg-white/5 px-2.5 py-1.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {b.type.replace(/_/g, " ")}
                </Badge>
                <Link href={`/dashboard/outfits/${b.outfit?.id}`} className="text-xs font-medium hover:underline truncate">
                  {b.outfit?.name}
                </Link>
                <span className="text-[10px] text-muted-foreground">
                  · {b.customerName}
                </span>
              </div>
              {b.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{b.notes}</p>}
            </div>
            {can("update", "dependency") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-green-700 hover:text-green-800 hover:bg-green-100"
                onClick={() => resolveMutation.mutate({ outfitId: b.outfitId, depId: b.id })}
                disabled={resolveMutation.isPending}
              >
                <CheckCircle className="h-3 w-3" /> Resolve
              </Button>
            )}
          </div>
        ))}
        {blockers.length > 5 && (
          <p className="text-[10px] text-muted-foreground pl-2">
            +{blockers.length - 5} more blockers
          </p>
        )}
      </div>
    </div>
  );
}
