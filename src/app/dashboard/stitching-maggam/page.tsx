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
} from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "@/hooks/use-toast";

const TABS = [
  { key: "PATTERN_DRAFTING", label: "Pattern Drafting", short: "Pattern", icon: PenTool },
  { key: "MAGGAM_WORK",      label: "Maggam Work",     short: "Maggam",  icon: Sparkles },
  { key: "MAGGAM_REVIEW",    label: "Maggam Review",   short: "Review",  icon: CheckCircle },
  { key: "FABRIC_CUTTING",   label: "Fabric Cutting",  short: "Cutting", icon: Scissors },
  { key: "STITCHING",        label: "Stitching",       short: "Stitch",  icon: Shirt },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function StitchingMaggamPage() {
  const queryClient = useQueryClient();
  const { role, session } = usePermissions();
  const [activeTab, setActiveTab] = useState<TabKey>("PATTERN_DRAFTING");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["stitching-maggam-outfits"],
    queryFn: async () => {
      const res = await fetch("/api/outfits?status=production&limit=200");
      if (!res.ok) return [];
      const d = await res.json();
      const STITCHING_STATUSES = new Set([
        "PATTERN_DRAFTING", "MAGGAM_WORK", "MAGGAM_REVIEW", "FABRIC_CUTTING", "STITCHING",
      ]);
      return (d.outfits || []).filter((o: any) => STITCHING_STATUSES.has(o.status));
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
      queryClient.invalidateQueries({ queryKey: ["stitching-maggam-outfits"] });
      queryClient.invalidateQueries({ queryKey: ["production-outfits"] });
      toast({ title: "Status updated", description: "Outfit moved to next stage." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Transition failed", description: error.message });
    },
    onSettled: () => setPendingId(null),
  });

  const allOutfits = (data || []).filter((outfit: any) => {
    if (role !== "MASTER") return true;
    return !outfit.masterId || outfit.masterId === session?.id;
  });

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tab of TABS) {
      map[tab.key] = allOutfits.filter((o: any) => o.status === tab.key).length;
    }
    return map;
  }, [allOutfits]);

  const totalCount = allOutfits.length;
  const urgentCount = allOutfits.filter(
    (o: any) => o.deliveryDate && new Date(o.deliveryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  ).length;

  const outfitTypes = useMemo(() => {
    const types = new Set<string>(allOutfits.map((o: any) => o.type as string).filter(Boolean));
    return Array.from(types).sort();
  }, [allOutfits]);

  const filteredOutfits = useMemo(() => {
    let items = allOutfits.filter((o: any) => o.status === activeTab);
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
  }, [allOutfits, activeTab, searchQuery, typeFilter]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}
        </div>
        <div className="h-40 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl">Stitching &amp; Maggam</h1>
        <p className="text-sm text-muted-foreground">
          Track maggam work, fabric cutting, and stitching progress
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg bg-primary/10 p-1.5 sm:p-2 shrink-0">
                <Shirt className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold sm:text-2xl">{totalCount}</p>
                <p className="text-xs text-muted-foreground">Total Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg bg-red-100 p-1.5 sm:p-2 shrink-0">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold sm:text-2xl">{urgentCount}</p>
                <p className="text-xs text-muted-foreground">Urgent (&lt;3d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs — full-bleed on mobile, scrollable */}
      <div className="border-b -mx-3 px-3 sm:-mx-4 sm:px-4 md:mx-0 md:px-0">
        <div className="flex overflow-x-auto scrollbar-hide pb-px -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
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
                {/* On very small screens show short label, on sm+ show full */}
                <span className="xs:hidden hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.short}</span>
                <Badge
                  variant={isActive ? "default" : "secondary"}
                  className="text-[10px] px-1 py-0 min-w-[1.1rem] text-center"
                >
                  {counts[tab.key] || 0}
                </Badge>
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
        <Select
          value={typeFilter}
          onValueChange={setTypeFilter}
        >
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
            No outfits in {formatStatus(activeTab)}
            {searchQuery && " matching your search"}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-lg border overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Outfit</th>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Type</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Delivery</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Assigned To</th>
                  <th className="text-right px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredOutfits.map((outfit: any) => {
                  const next = getNextStatus(outfit.status, outfit.maggamRequired, role);
                  const isUrgent =
                    outfit.deliveryDate &&
                    new Date(outfit.deliveryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                  const isAssigned =
                    role !== "MASTER" || !outfit.masterId || outfit.masterId === session?.id;

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
                          <p className="text-xs text-muted-foreground">{outfit.orderNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm max-w-[130px] truncate">
                        {outfit.customerName || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-sm">
                        {outfit.type}
                        {outfit.maggamRequired && <span className="text-pink-600 ml-1">· M</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={isUrgent ? "text-red-600 font-medium text-sm" : "text-muted-foreground text-sm"}>
                          {formatDate(outfit.deliveryDate)}
                          {isUrgent && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm max-w-[120px] truncate">
                        {outfit.masterName || outfit.designerName || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {next && isAssigned ? (
                          <LoadingButton
                            size="sm"
                            loading={pendingId === outfit.id}
                            disabled={transitionMutation.isPending && pendingId !== outfit.id}
                            onClick={() => transitionMutation.mutate({ id: outfit.id, newStatus: next })}
                            className="whitespace-nowrap text-xs"
                          >
                            {formatStatus(next)} <ArrowRight className="h-3 w-3 ml-1" />
                          </LoadingButton>
                        ) : next ? (
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
              const next = getNextStatus(outfit.status, outfit.maggamRequired, role);
              const isUrgent =
                outfit.deliveryDate &&
                new Date(outfit.deliveryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
              const isAssigned =
                role !== "MASTER" || !outfit.masterId || outfit.masterId === session?.id;

              return (
                <Card key={outfit.id}>
                  <CardContent className="pt-3 pb-3 space-y-2">
                    {/* Name + status badge */}
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
                      <Badge className={`${getStatusColor(outfit.status)} text-[10px] shrink-0 whitespace-nowrap max-w-[120px] truncate`}>
                        {formatStatus(outfit.status)}
                      </Badge>
                    </div>

                    {/* Meta row: delivery + master */}
                    <div className="flex items-center gap-3 ml-5 flex-wrap">
                      {outfit.deliveryDate && (
                        <div className="flex items-center gap-1 text-xs">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span className={isUrgent ? "text-red-600 font-medium" : "text-muted-foreground"}>
                            {formatDate(outfit.deliveryDate)}
                            {isUrgent && " ⚠"}
                          </span>
                        </div>
                      )}
                      {outfit.masterName && (
                        <p className="text-xs text-muted-foreground truncate">
                          M: {outfit.masterName}
                        </p>
                      )}
                    </div>

                    {/* Action button */}
                    {next && isAssigned ? (
                      <LoadingButton
                        size="sm"
                        className="w-full text-xs"
                        loading={pendingId === outfit.id}
                        disabled={transitionMutation.isPending && pendingId !== outfit.id}
                        onClick={() => transitionMutation.mutate({ id: outfit.id, newStatus: next })}
                      >
                        <span className="truncate">Move to {formatStatus(next)}</span>
                        <ArrowRight className="h-3 w-3 ml-1 shrink-0" />
                      </LoadingButton>
                    ) : next ? (
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
    </div>
  );
}

function getNextStatus(current: string, maggamRequired: boolean, role: string): string | null {
  if (role === "MASTER" || role === "ADMIN") {
    const transitions: Record<string, string> = {
      PATTERN_DRAFTING: maggamRequired ? "MAGGAM_WORK" : "FABRIC_CUTTING",
      MAGGAM_WORK: "MAGGAM_REVIEW",
      FABRIC_CUTTING: "STITCHING",
      STITCHING: "PRODUCTION_COMPLETED",
    };
    if (transitions[current]) return transitions[current];
  }
  if (role === "DESIGNER" || role === "ADMIN") {
    if (current === "MAGGAM_REVIEW") return "FABRIC_CUTTING";
  }
  return null;
}
