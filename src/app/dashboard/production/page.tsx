"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";
import { Shirt, Calendar, AlertTriangle, ArrowRight, Search, ImageOff, RotateCcw } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { ImageViewer } from "@/components/image-viewer";

const PRODUCTION_STATUSES = [
  "WAITING_FOR_DEPENDENCIES",
  "PRODUCTION_READY",
  "PATTERN_DRAFTING",
  "MAGGAM_WORK",
  "MAGGAM_REVIEW",
  "MAGGAM_REVIEWED",
  "FABRIC_CUTTING",
  "STITCHING",
  "PRODUCTION_COMPLETED",
];

type Transition = { status: string; label: string; blocked: boolean; reason?: string };

export default function ProductionPage() {
  const queryClient = useQueryClient();
  const { role, session } = usePermissions();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Image viewer
  const [viewerImages, setViewerImages] = useState<{ id: string; url: string }[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["production-outfits", search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("status", "production");
      params.set("limit", "200");
      if (search) params.set("search", search);
      const res = await fetch(`/api/outfits?${params}`);
      if (!res.ok) return [];
      const d = await res.json();
      return d.outfits || [];
    },
  });

  // Bulk-fetch transitions for all visible outfits in one request
  const outfitIds: string[] = useMemo(
    () => (data || []).map((o: any) => o.id),
    [data]
  );
  const { data: bulkTransitions } = useQuery({
    queryKey: ["bulk-transitions-production", outfitIds],
    queryFn: async () => {
      if (outfitIds.length === 0) return {};
      const res = await fetch("/api/outfits/transitions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfitIds }),
      });
      if (!res.ok) return {};
      const d = await res.json();
      return d.transitions as Record<string, Transition[]>;
    },
    enabled: outfitIds.length > 0,
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ id, newStatus, _key }: { id: string; newStatus: string; _key?: string }) => {
      setPendingId(_key ?? id);
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
      queryClient.invalidateQueries({ queryKey: ["bulk-transitions-production"] });
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
    if (role === "MASTER" && outfit.masterId && outfit.masterId !== session?.id) return false;
    if (statusFilter && outfit.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">
          {role === "MASTER" ? "My Production Cards" : "Production"}
        </h1>
        <p className="text-xs text-muted-foreground">
          {outfits.length} outfit(s) in production pipeline
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by outfit, customer or order..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Stages</SelectItem>
            {PRODUCTION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{formatStatus(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {outfits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {role === "MASTER" ? "No assigned outfits in production" : "No outfits in production"}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-lg border overflow-x-auto">
            <table className="w-full text-xs min-w-[520px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Outfit</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Customer</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Type</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Material</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Delivery</th>
                  <th className="text-right px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {outfits.map((outfit: any) => {
                  const transitions: Transition[] = bulkTransitions?.[outfit.id] ?? [];
                  const isUrgent = outfit.deliveryDate && new Date(outfit.deliveryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

                  return (
                    <tr key={outfit.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 max-w-[180px]">
                        <Link href={`/dashboard/outfits/${outfit.id}?from=production`} className="font-medium hover:underline truncate block">
                          {outfit.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {outfit.customerName || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {outfit.type}
                        {outfit.maggamRequired && <span className="text-pink-600 ml-1">· M</span>}
                      </td>
                      <td className="px-4 py-3">
                        {outfit.customerMaterialImageUrl ? (
                          <button
                            type="button"
                            onClick={() => {
                              setViewerImages(outfit.customerMaterialImages || [{ id: outfit.customerMaterialImageUrl, url: outfit.customerMaterialImageUrl }]);
                              setViewerIndex(0);
                              setViewerOpen(true);
                            }}
                            className="relative block h-10 w-10 shrink-0 overflow-hidden rounded border border-border bg-muted hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <img src={outfit.customerMaterialImageUrl} alt="Material" className="h-full w-full object-cover" />
                            {outfit.customerMaterialImages?.length > 1 && (
                              <span className="absolute bottom-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-tl bg-black/70 px-0.5 text-[9px] font-bold text-white leading-none">
                                {outfit.customerMaterialImages.length}
                              </span>
                            )}
                          </button>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-border bg-muted/40">
                            <ImageOff className="h-3.5 w-3.5 text-muted-foreground/50" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge className={`${getStatusColor(outfit.status)} text-[10px] whitespace-nowrap`}>
                            {formatStatus(outfit.status)}
                          </Badge>
                          {outfit.status === "WAITING_FOR_DEPENDENCIES" && (
                            <Badge variant="destructive" className="text-[10px] whitespace-nowrap">BLOCKED</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={isUrgent ? "text-red-600 font-medium text-xs" : "text-muted-foreground text-xs"}>
                          {formatDate(outfit.deliveryDate)}
                          {isUrgent && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {outfit.status === "WAITING_FOR_DEPENDENCIES" ? (
                          <Link href={`/dashboard/outfits/${outfit.id}?from=production`}>
                            <LoadingButton size="sm" variant="destructive" className="text-xs whitespace-nowrap">
                              <AlertTriangle className="h-3 w-3 mr-1" /> View Blocker
                            </LoadingButton>
                          </Link>
                        ) : transitions.length > 0 ? (
                          <div className="flex gap-1.5 justify-end">
                            <TooltipProvider delayDuration={200}>
                              {transitions.map((t) => (
                                <Tooltip key={t.status}>
                                  <TooltipTrigger asChild>
                                    <span className={t.blocked ? "cursor-not-allowed" : undefined}>
                                      <LoadingButton
                                        size="sm"
                                        variant={t.status === "MAGGAM_WORK" ? "outline" : "default"}
                                        className={`whitespace-nowrap text-xs ${t.status === "MAGGAM_WORK" ? "text-amber-600 border-amber-400 hover:bg-amber-50" : ""}`}
                                        loading={!t.blocked && (pendingId === outfit.id || pendingId === outfit.id + "_" + t.status)}
                                        disabled={t.blocked || (transitionMutation.isPending && pendingId !== outfit.id && pendingId !== outfit.id + "_" + t.status)}
                                        onClick={() => !t.blocked && transitionMutation.mutate({ id: outfit.id, newStatus: t.status, _key: outfit.id + "_" + t.status })}
                                      >
                                        {t.status === "MAGGAM_WORK"
                                          ? <><RotateCcw className="h-3 w-3 mr-1" />{t.label}</>
                                          : <>{t.label} <ArrowRight className="h-3 w-3 ml-1" /></>
                                        }
                                      </LoadingButton>
                                    </span>
                                  </TooltipTrigger>
                                  {t.blocked && t.reason && (
                                    <TooltipContent side="left">{t.reason}</TooltipContent>
                                  )}
                                </Tooltip>
                              ))}
                            </TooltipProvider>
                          </div>
                        ) : outfit.status === "MAGGAM_REVIEW" && role === "MASTER" ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground whitespace-nowrap">Awaiting designer review</Badge>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden flex flex-col gap-3">
            {outfits.map((outfit: any) => {
              const transitions: Transition[] = bulkTransitions?.[outfit.id] ?? [];
              const isUrgent = outfit.deliveryDate && new Date(outfit.deliveryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

              return (
                <div key={outfit.id} className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
                  {/* Top: name + badges */}
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/dashboard/outfits/${outfit.id}?from=production`} className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Shirt className="h-3.5 w-3.5 text-primary shrink-0" />
                        <p className="font-medium text-sm truncate">{outfit.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground ml-5">
                        {outfit.type}{outfit.maggamRequired && " · Maggam"}
                      </p>
                      {outfit.customerName && (
                        <p className="text-xs text-muted-foreground ml-5 font-medium">
                          {outfit.customerName}
                        </p>
                      )}
                    </Link>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge className={`${getStatusColor(outfit.status)} text-[10px] whitespace-nowrap max-w-[120px] truncate`}>
                        {formatStatus(outfit.status)}
                      </Badge>
                      {outfit.status === "WAITING_FOR_DEPENDENCIES" && (
                        <Badge variant="destructive" className="text-[10px]">BLOCKED</Badge>
                      )}
                      {outfit.customerMaterialImageUrl ? (
                        <button
                          type="button"
                          onClick={() => {
                            setViewerImages(outfit.customerMaterialImages || [{ id: outfit.customerMaterialImageUrl, url: outfit.customerMaterialImageUrl }]);
                            setViewerIndex(0);
                            setViewerOpen(true);
                          }}
                          className="relative mt-1 block h-10 w-10 overflow-hidden rounded border border-border bg-muted hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <img src={outfit.customerMaterialImageUrl} alt="Material" className="h-full w-full object-cover" />
                          {outfit.customerMaterialImages?.length > 1 && (
                            <span className="absolute bottom-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-tl bg-black/70 px-0.5 text-[9px] font-bold text-white leading-none">
                              {outfit.customerMaterialImages.length}
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded border border-dashed border-border bg-muted/40">
                          <ImageOff className="h-3.5 w-3.5 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Delivery */}
                  {outfit.deliveryDate && (
                    <div className="flex items-center gap-1 text-xs ml-5">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span className={isUrgent ? "text-red-600 font-medium" : "text-muted-foreground"}>
                        {formatDate(outfit.deliveryDate)}{isUrgent && " ⚠"}
                      </span>
                    </div>
                  )}

                  {/* Action */}
                  {outfit.status === "WAITING_FOR_DEPENDENCIES" ? (
                    <Link href={`/dashboard/outfits/${outfit.id}?from=production`} className="block">
                      <LoadingButton size="sm" variant="destructive" className="w-full text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" /> View Blocker
                      </LoadingButton>
                    </Link>
                  ) : transitions.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <TooltipProvider delayDuration={200}>
                        {transitions.map((t) => (
                          <Tooltip key={t.status}>
                            <TooltipTrigger asChild>
                              <span className={t.blocked ? "cursor-not-allowed w-full" : "w-full"}>
                                <LoadingButton
                                  size="sm"
                                  variant={t.status === "MAGGAM_WORK" ? "outline" : "default"}
                                  className={`w-full text-xs ${t.status === "MAGGAM_WORK" ? "text-amber-600 border-amber-400 hover:bg-amber-50" : ""}`}
                                  loading={!t.blocked && (pendingId === outfit.id || pendingId === outfit.id + "_" + t.status)}
                                  disabled={t.blocked || (transitionMutation.isPending && pendingId !== outfit.id && pendingId !== outfit.id + "_" + t.status)}
                                  onClick={() => !t.blocked && transitionMutation.mutate({ id: outfit.id, newStatus: t.status, _key: outfit.id + "_" + t.status })}
                                >
                                  {t.status === "MAGGAM_WORK"
                                    ? <><RotateCcw className="h-3 w-3 mr-1 shrink-0" /><span className="truncate">{t.label}</span></>
                                    : <><span className="truncate">Move to {t.label}</span><ArrowRight className="h-3 w-3 ml-1 shrink-0" /></>
                                  }
                                </LoadingButton>
                              </span>
                            </TooltipTrigger>
                            {t.blocked && t.reason && (
                              <TooltipContent side="top">{t.reason}</TooltipContent>
                            )}
                          </Tooltip>
                        ))}
                      </TooltipProvider>
                    </div>
                  ) : outfit.status === "MAGGAM_REVIEW" && role === "MASTER" ? (
                    <p className="text-xs text-muted-foreground ml-5 italic">Awaiting designer review</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}

      <ImageViewer
        images={viewerImages}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}
