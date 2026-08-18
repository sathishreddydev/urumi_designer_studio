"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingButton } from "@/components/ui/loading-button";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";
import { Shirt, Calendar, AlertTriangle, ArrowRight } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

const PRODUCTION_STATUSES = [
  "WAITING_FOR_DEPENDENCIES",
  "PRODUCTION_READY",
  "PATTERN_DRAFTING",
  "MAGGAM_WORK",
  "MAGGAM_REVIEW",
  "FABRIC_CUTTING",
  "STITCHING",
  "PRODUCTION_COMPLETED",
];

export default function ProductionPage() {
  const queryClient = useQueryClient();
  const { role, session } = usePermissions();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["production-outfits"],
    queryFn: async () => {
      const res = await fetch("/api/outfits?status=production&limit=100");
      if (!res.ok) return [];
      const d = await res.json();
      return d.outfits || [];
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      setPendingId(id);
      const res = await fetch(`/api/outfits/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-outfits"] });
    },
    onError: (err: Error) => {
      import("@/hooks/use-toast").then(({ toast }) =>
        toast({ variant: "destructive", title: "Transition failed", description: err.message })
      );
    },
    onSettled: () => setPendingId(null),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const outfits = (data || []).filter((outfit: any) => {
    if (role !== "MASTER") return true;
    return !outfit.masterId || outfit.masterId === session?.id;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold lg:text-3xl">
          {role === "MASTER" ? "My Production Cards" : "Production"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {outfits.length} outfit(s) in production pipeline
        </p>
      </div>

      {outfits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {role === "MASTER" ? "No assigned outfits in production" : "No outfits in production"}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop: Table */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Outfit</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Delivery</th>
                  <th className="text-right px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {outfits.map((outfit: any) => {
                  const next = getNextStatus(outfit.status, outfit.maggamRequired, role);
                  const isUrgent = outfit.deliveryDate && new Date(outfit.deliveryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                  const isAssigned = role !== "MASTER" || !outfit.masterId || outfit.masterId === session?.id;

                  return (
                    <tr key={outfit.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/outfits/${outfit.id}`} className="font-medium hover:underline">
                          {outfit.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {outfit.type}
                        {outfit.maggamRequired && <span className="text-pink-600 ml-1">· M</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getStatusColor(outfit.status)}>
                          {formatStatus(outfit.status)}
                        </Badge>
                        {outfit.status === "WAITING_FOR_DEPENDENCIES" && (
                          <Badge variant="destructive" className="ml-1 text-[10px]">BLOCKED</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={isUrgent ? "text-red-600 font-medium" : "text-muted-foreground"}>
                          {formatDate(outfit.deliveryDate)}
                          {isUrgent && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {next && isAssigned ? (
                          <LoadingButton
                            size="sm"
                            loading={pendingId === outfit.id}
                            disabled={transitionMutation.isPending && pendingId !== outfit.id}
                            onClick={() => transitionMutation.mutate({ id: outfit.id, newStatus: next })}
                          >
                            {formatStatus(next)} <ArrowRight className="h-3 w-3" />
                          </LoadingButton>
                        ) : outfit.status === "WAITING_FOR_DEPENDENCIES" ? (
                          <Link href={`/dashboard/outfits/${outfit.id}`}>
                            <LoadingButton size="sm" variant="destructive">
                              <AlertTriangle className="h-3 w-3" /> View Blocker
                            </LoadingButton>
                          </Link>
                        ) : next && !isAssigned ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Not assigned</Badge>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: Cards */}
          <div className="md:hidden space-y-3">
            {outfits.map((outfit: any) => {
              const next = getNextStatus(outfit.status, outfit.maggamRequired, role);
              const isUrgent = outfit.deliveryDate && new Date(outfit.deliveryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
              const isAssigned = role !== "MASTER" || outfit.masterId === undefined || outfit.masterName;

              return (
                <Card key={outfit.id}>
                  <CardContent className="pt-3 pb-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/dashboard/outfits/${outfit.id}`} className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Shirt className="h-3.5 w-3.5 text-primary shrink-0" />
                          <p className="font-medium text-sm truncate">{outfit.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground ml-5">
                          {outfit.type}{outfit.maggamRequired && " · Maggam"}
                        </p>
                      </Link>
                      <Badge className={`text-[10px] ${getStatusColor(outfit.status)}`}>
                        {formatStatus(outfit.status)}
                      </Badge>
                      {outfit.status === "WAITING_FOR_DEPENDENCIES" && (
                        <Badge variant="destructive" className="text-[10px] ml-1">BLOCKED</Badge>
                      )}
                    </div>

                    {outfit.deliveryDate && (
                      <div className="flex items-center gap-1 text-xs ml-5">
                        <Calendar className="h-3 w-3" />
                        <span className={isUrgent ? "text-red-600 font-medium" : "text-muted-foreground"}>
                          {formatDate(outfit.deliveryDate)}
                          {isUrgent && " ⚠️"}
                        </span>
                      </div>
                    )}

                    {next && isAssigned ? (
                      <LoadingButton
                        size="sm"
                        className="w-full mt-1"
                        loading={pendingId === outfit.id}
                        disabled={transitionMutation.isPending && pendingId !== outfit.id}
                        onClick={() => transitionMutation.mutate({ id: outfit.id, newStatus: next })}
                      >
                        {formatStatus(next)} <ArrowRight className="h-3 w-3" />
                      </LoadingButton>
                    ) : outfit.status === "WAITING_FOR_DEPENDENCIES" ? (
                      <Link href={`/dashboard/outfits/${outfit.id}`} className="block mt-1">
                        <LoadingButton size="sm" variant="destructive" className="w-full">
                          <AlertTriangle className="h-3 w-3" /> View Blocker
                        </LoadingButton>
                      </Link>
                    ) : next && !isAssigned ? (
                      <p className="text-xs text-muted-foreground ml-5">Not assigned to you</p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function getNextStatus(current: string, maggamRequired: boolean, role: string): string | null {
  // Master transitions
  if (role === "MASTER" || role === "ADMIN") {
    const masterTransitions: Record<string, string> = {
      PRODUCTION_READY: "PATTERN_DRAFTING",
      PATTERN_DRAFTING: maggamRequired ? "MAGGAM_WORK" : "FABRIC_CUTTING",
      MAGGAM_WORK: "MAGGAM_REVIEW",
      FABRIC_CUTTING: "STITCHING",
      STITCHING: "PRODUCTION_COMPLETED",
    };
    if (masterTransitions[current]) return masterTransitions[current];
  }

  // Designer transitions (maggam review)
  if (role === "DESIGNER" || role === "ADMIN") {
    if (current === "MAGGAM_REVIEW") return "FABRIC_CUTTING";
  }

  return null;
}
