"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";
import {
  Shirt,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Search,
  Scissors,
  Sparkles,
  CheckCircle,
  PenTool,
  PackageCheck,
  ImageOff,
  RotateCcw,
} from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "@/hooks/use-toast";
import { ImageViewer } from "@/components/image-viewer";

// Tabs shown to all roles
const ALL_TABS = [
  { key: "PRODUCTION_READY", label: "Ready to Start", short: "Ready",   icon: PackageCheck },
  { key: "PATTERN_DRAFTING", label: "Pattern Drafting", short: "Pattern", icon: PenTool },
  { key: "MAGGAM_WORK",      label: "Maggam Work",     short: "Maggam",  icon: Sparkles },
  { key: "MAGGAM_REVIEW",    label: "Maggam Review",   short: "Review",  icon: CheckCircle },
  { key: "FABRIC_CUTTING",   label: "Fabric Cutting",  short: "Cutting", icon: Scissors },
  { key: "STITCHING",        label: "Stitching",       short: "Stitch",  icon: Shirt },
] as const;

type TabKey = (typeof ALL_TABS)[number]["key"];

// For each status return the allowed next transitions per role
function getNextStatuses(
  current: string,
  maggamRequired: boolean,
  role: string
): { status: string; label: string; variant?: "destructive" | "default" | "outline" }[] {
  if (role === "MASTER" || role === "ADMIN") {
    if (current === "PRODUCTION_READY") return [{ status: "PATTERN_DRAFTING", label: "Start Pattern" }];
    if (current === "PATTERN_DRAFTING")
      return maggamRequired
        ? [{ status: "MAGGAM_WORK", label: "Maggam Work" }]
        : [{ status: "FABRIC_CUTTING", label: "Fabric Cutting" }];
    if (current === "MAGGAM_WORK") return [{ status: "MAGGAM_REVIEW", label: "Send for Review" }];
    if (current === "FABRIC_CUTTING") return [{ status: "STITCHING", label: "Stitching" }];
    if (current === "STITCHING") return [{ status: "PRODUCTION_COMPLETED", label: "Mark Complete" }];
  }
  if (role === "DESIGNER" || role === "ADMIN") {
    if (current === "MAGGAM_REVIEW")
      return [
        { status: "FABRIC_CUTTING", label: "Approve → Cutting" },
        { status: "MAGGAM_WORK",    label: "Rework",           variant: "outline" },
      ];
  }
  return [];
}

export default function StitchingMaggamPage() {
  const queryClient = useQueryClient();
  const { role, session } = usePermissions();
  const [activeTab, setActiveTab] = useState<TabKey>("PRODUCTION_READY");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  // Image viewer
  const [viewerImages, setViewerImages] = useState<{ id: string; url: string }[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["stitching-maggam-outfits"],
    queryFn: async () => {
      const res = await fetch("/api/outfits?status=production&limit=200");
      if (!res.ok) return [];
      const d = await res.json();
      const VISIBLE_STATUSES = new Set([
        "PRODUCTION_READY",
        "PATTERN_DRAFTING", "MAGGAM_WORK", "MAGGAM_REVIEW", "FABRIC_CUTTING", "STITCHING",
      ]);
      return (d.outfits || []).filter((o: any) => VISIBLE_STATUSES.has(o.status));
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      setPendingId(id);
      setPendingStatus(newStatus);
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
      queryClient.invalidateQueries({ queryKey: ["stitching-maggam-outfits"] });
      queryClient.invalidateQueries({ queryKey: ["production-outfits"] });
      toast({ title: "Status updated", description: "Outfit moved to next stage." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Transition failed", description: error.message });
    },
    onSettled: () => { setPendingId(null); setPendingStatus(null); },
  });

  // Scope by role — MASTER only sees their assigned outfits
  const allOutfits = useMemo(() => {
    const list = data || [];
    if (role === "MASTER") {
      return list.filter((o: any) => o.masterId === session?.id);
    }
    return list;
  }, [data, role, session?.id]);

  // Tabs visible to this role — MASTER doesn't act on MAGGAM_REVIEW
  const visibleTabs = useMemo(() => {
    if (role === "MASTER") return ALL_TABS.filter((t) => t.key !== "MAGGAM_REVIEW");
    return ALL_TABS;
  }, [role]);

  // If current active tab got hidden for this role, switch to first visible
  const resolvedTab = visibleTabs.some((t) => t.key === activeTab)
    ? activeTab
    : visibleTabs[0]?.key ?? "PRODUCTION_READY";

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tab of ALL_TABS) {
      map[tab.key] = allOutfits.filter((o: any) => o.status === tab.key).length;
    }
    return map;
  }, [allOutfits]);

  const totalCount = allOutfits.filter(
    (o: any) => o.status !== "PRODUCTION_READY"
  ).length; // active work (excluding queue)
  const queueCount = counts["PRODUCTION_READY"] || 0;
  const urgentCount = allOutfits.filter(
    (o: any) => o.deliveryDate && new Date(o.deliveryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  ).length;

  const outfitTypes = useMemo(() => {
    const types = new Set<string>(allOutfits.map((o: any) => o.type as string).filter(Boolean));
    return Array.from(types).sort();
  }, [allOutfits]);

  const filteredOutfits = useMemo(() => {
    let items = allOutfits.filter((o: any) => o.status === resolvedTab);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (o: any) =>
          o.name?.toLowerCase().includes(q) ||
          o.customerName?.toLowerCase().includes(q) ||
          o.orderNumber?.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== "all") {
      items = items.filter((o: any) => o.type === typeFilter);
    }
    return items;
  }, [allOutfits, resolvedTab, searchQuery, typeFilter]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}
        </div>
        <div className="h-40 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">Stitching &amp; Maggam</h1>
        <p className="text-xs text-muted-foreground">
          Track production from pattern drafting through stitching
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-100 p-1.5 shrink-0">
                <PackageCheck className="h-4 w-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold">{queueCount}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">Queued</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-1.5 shrink-0">
                <Shirt className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold">{totalCount}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-red-100 p-1.5 shrink-0">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold">{urgentCount}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">Urgent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b -mx-3 px-3 sm:-mx-4 sm:px-4 md:mx-0 md:px-0">
        <div className="flex overflow-x-auto scrollbar-hide pb-px -mb-px">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = resolvedTab === tab.key;
            const count = counts[tab.key] || 0;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors shrink-0 ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                }`}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.short}</span>
                {count > 0 && (
                  <Badge
                    variant={isActive ? "default" : "secondary"}
                    className="text-[10px] px-1 py-0 min-w-[1.1rem] text-center"
                  >
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search outfit, customer, or order…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 sm:h-10 sm:w-[160px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {outfitTypes.map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {filteredOutfits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No outfits in {formatStatus(resolvedTab)}
            {searchQuery && " matching your search"}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-lg border overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Outfit</th>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Type</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Material</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Delivery</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Assigned To</th>
                  <th className="text-right px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredOutfits.map((outfit: any) => {
                  const nextStatuses = getNextStatuses(outfit.status, outfit.maggamRequired, role ?? "");
                  const isAssigned = role !== "MASTER" || outfit.masterId === session?.id;
                  const isUrgent =
                    outfit.deliveryDate &&
                    new Date(outfit.deliveryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

                  return (
                    <tr key={outfit.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 max-w-[180px]">
                        <Link
                          href={`/dashboard/outfits/${outfit.id}`}
                          className="font-medium hover:underline truncate block"
                        >
                          {outfit.name}
                        </Link>
                        {outfit.orderNumber && (
                          <p className="text-[10px] text-muted-foreground">{outfit.orderNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[130px] truncate">
                        {outfit.customerName || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={isUrgent ? "text-red-600 font-medium text-xs" : "text-muted-foreground text-xs"}>
                          {formatDate(outfit.deliveryDate)}
                          {isUrgent && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[120px] truncate">
                        {outfit.masterName || outfit.designerName || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isAssigned && nextStatuses.length > 0 ? (
                          <div className="flex flex-wrap justify-end gap-1">
                            {nextStatuses.map((t) => (
                              <LoadingButton
                                key={t.status}
                                size="sm"
                                variant={t.variant === "outline" ? "outline" : "default"}
                                loading={pendingId === outfit.id && pendingStatus === t.status}
                                disabled={transitionMutation.isPending && !(pendingId === outfit.id && pendingStatus === t.status)}
                                onClick={() => transitionMutation.mutate({ id: outfit.id, newStatus: t.status })}
                                className="whitespace-nowrap text-xs"
                              >
                                {t.variant === "outline"
                                  ? <RotateCcw className="h-3 w-3 mr-1" />
                                  : <ArrowRight className="h-3 w-3 mr-1" />}
                                {t.label}
                              </LoadingButton>
                            ))}
                          </div>
                        ) : nextStatuses.length > 0 ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground whitespace-nowrap">
                            Not assigned
                          </Badge>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredOutfits.map((outfit: any) => {
              const nextStatuses = getNextStatuses(outfit.status, outfit.maggamRequired, role ?? "");
              const isAssigned = role !== "MASTER" || outfit.masterId === session?.id;
              const isUrgent =
                outfit.deliveryDate &&
                new Date(outfit.deliveryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

              return (
                <Card key={outfit.id}>
                  <CardContent className="pt-3 pb-3 space-y-2">
                    {/* Name + badge */}
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/dashboard/outfits/${outfit.id}`} className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Shirt className="h-3.5 w-3.5 text-primary shrink-0" />
                          <p className="font-medium text-sm truncate">{outfit.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground ml-5 truncate">
                          {outfit.customerName && `${outfit.customerName} · `}
                          {outfit.type}
                          {outfit.maggamRequired && " · Maggam"}
                        </p>
                      </Link>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge className={`${getStatusColor(outfit.status)} text-[10px] whitespace-nowrap max-w-[120px] truncate`}>
                          {formatStatus(outfit.status)}
                        </Badge>
                        {outfit.customerMaterialImageUrl ? (
                          <button
                            type="button"
                            onClick={() => {
                              setViewerImages(outfit.customerMaterialImages || [{ id: outfit.customerMaterialImageUrl, url: outfit.customerMaterialImageUrl }]);
                              setViewerIndex(0);
                              setViewerOpen(true);
                            }}
                            className="relative mt-1 block h-10 w-10 overflow-hidden rounded border border-border bg-muted hover:opacity-80 transition-opacity"
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

                    {/* Meta row */}
                    <div className="flex items-center gap-3 ml-5 flex-wrap">
                      {outfit.deliveryDate && (
                        <div className="flex items-center gap-1 text-xs">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span className={isUrgent ? "text-red-600 font-medium" : "text-muted-foreground"}>
                            {formatDate(outfit.deliveryDate)}{isUrgent && " ⚠"}
                          </span>
                        </div>
                      )}
                      {outfit.masterName && (
                        <p className="text-xs text-muted-foreground truncate">M: {outfit.masterName}</p>
                      )}
                    </div>

                    {/* Action buttons */}
                    {isAssigned && nextStatuses.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {nextStatuses.map((t) => (
                          <LoadingButton
                            key={t.status}
                            size="sm"
                            variant={t.variant === "outline" ? "outline" : "default"}
                            className="w-full text-xs"
                            loading={pendingId === outfit.id && pendingStatus === t.status}
                            disabled={transitionMutation.isPending && !(pendingId === outfit.id && pendingStatus === t.status)}
                            onClick={() => transitionMutation.mutate({ id: outfit.id, newStatus: t.status })}
                          >
                            {t.variant === "outline"
                              ? <RotateCcw className="h-3 w-3 mr-1 shrink-0" />
                              : <ArrowRight className="h-3 w-3 mr-1 shrink-0" />}
                            <span className="truncate">{t.label}</span>
                          </LoadingButton>
                        ))}
                      </div>
                    ) : nextStatuses.length > 0 ? (
                      <Badge variant="outline" className="w-full justify-center text-xs text-muted-foreground">
                        Not assigned to you
                      </Badge>
                    ) : null}
                  </CardContent>
                </Card>
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
