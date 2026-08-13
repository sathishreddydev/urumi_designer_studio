"use client";

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

// Tabs for this page
const TABS = [
  { key: "PATTERN_DRAFTING", label: "Pattern Drafting", icon: PenTool },
  { key: "MAGGAM_WORK", label: "Maggam Work", icon: Sparkles },
  { key: "MAGGAM_REVIEW", label: "Maggam Review", icon: CheckCircle },
  { key: "FABRIC_CUTTING", label: "Fabric Cutting", icon: Scissors },
  { key: "STITCHING", label: "Stitching", icon: Shirt },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function StitchingMaggamPage() {
  const queryClient = useQueryClient();
  const { role } = usePermissions();
  const [activeTab, setActiveTab] = useState<TabKey>("PATTERN_DRAFTING");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Fetch all outfits in stitching/maggam statuses
  const { data, isLoading } = useQuery({
    queryKey: ["stitching-maggam-outfits"],
    queryFn: async () => {
      const statuses = ["PATTERN_DRAFTING", "MAGGAM_WORK", "MAGGAM_REVIEW", "FABRIC_CUTTING", "STITCHING"];
      const results = await Promise.all(
        statuses.map(async (status) => {
          const res = await fetch(`/api/outfits?status=${status}&limit=100`);
          if (!res.ok) return [];
          const d = await res.json();
          return (d.outfits || []).map((o: any) => ({ ...o, status: status }));
        })
      );
      return results.flat();
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
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
      toast({
        title: "Status updated",
        description: "Outfit moved to next stage successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Transition failed",
        description: error.message || "Could not update outfit status.",
      });
    },
  });

  const allOutfits = data || [];

  // Counts per tab
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tab of TABS) {
      map[tab.key] = allOutfits.filter((o: any) => o.status === tab.key).length;
    }
    return map;
  }, [allOutfits]);

  // Summary header stats
  const totalCount = allOutfits.length;
  const urgentCount = allOutfits.filter(
    (o: any) => o.deliveryDate && new Date(o.deliveryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  ).length;

  // Unique outfit types for filter dropdown
  const outfitTypes = useMemo(() => {
    const types = new Set(allOutfits.map((o: any) => o.type).filter(Boolean));
    return Array.from(types).sort();
  }, [allOutfits]);

  // Filtered outfits for active tab
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
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-40 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold lg:text-3xl">Stitching & Maggam</h1>
        <p className="text-sm text-muted-foreground">
          Track maggam work, fabric cutting, and stitching progress
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Shirt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCount}</p>
                <p className="text-xs text-muted-foreground">Total Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 p-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{urgentCount}</p>
                <p className="text-xs text-muted-foreground">Urgent (3 days)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-0 overflow-x-auto scrollbar-hide pb-px -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors shrink-0 ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                <Badge
                  variant={isActive ? "default" : "secondary"}
                  className="ml-0.5 sm:ml-1 text-[10px] px-1.5 py-0 min-w-[1.25rem] text-center"
                >
                  {counts[tab.key] || 0}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by outfit name, customer, or order..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Types</option>
          {outfitTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      {filteredOutfits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No outfits found in {formatStatus(activeTab)}
            {searchQuery && " matching your search"}
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
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Delivery</th>
                  <th className="text-left px-4 py-3 font-medium">Assigned To</th>
                  <th className="text-right px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredOutfits.map((outfit: any) => {
                  const next = getNextStatus(outfit.status, outfit.maggamRequired, role);
                  const isUrgent =
                    outfit.deliveryDate &&
                    new Date(outfit.deliveryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

                  return (
                    <tr key={outfit.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/outfits/${outfit.id}`}
                          className="font-medium hover:underline"
                        >
                          {outfit.name}
                        </Link>
                        {outfit.orderNumber && (
                          <p className="text-xs text-muted-foreground">{outfit.orderNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {outfit.customerName || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {outfit.type}
                        {outfit.maggamRequired && (
                          <span className="text-pink-600 ml-1">· M</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            isUrgent ? "text-red-600 font-medium" : "text-muted-foreground"
                          }
                        >
                          {formatDate(outfit.deliveryDate)}
                          {isUrgent && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {outfit.masterName || outfit.designerName || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {next ? (
                          <LoadingButton
                            size="sm"
                            loading={transitionMutation.isPending}
                            onClick={() =>
                              transitionMutation.mutate({ id: outfit.id, newStatus: next })
                            }
                          >
                            {formatStatus(next)} <ArrowRight className="h-3 w-3" />
                          </LoadingButton>
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
            {filteredOutfits.map((outfit: any) => {
              const next = getNextStatus(outfit.status, outfit.maggamRequired, role);
              const isUrgent =
                outfit.deliveryDate &&
                new Date(outfit.deliveryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

              return (
                <Card key={outfit.id}>
                  <CardContent className="pt-3 pb-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/dashboard/outfits/${outfit.id}`}
                        className="min-w-0 flex-1"
                      >
                        <div className="flex items-center gap-1.5">
                          <Shirt className="h-3.5 w-3.5 text-primary shrink-0" />
                          <p className="font-medium text-sm truncate">{outfit.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground ml-5">
                          {outfit.customerName && `${outfit.customerName} · `}
                          {outfit.type}
                          {outfit.maggamRequired && " · Maggam"}
                        </p>
                      </Link>
                      <Badge className={`text-[10px] ${getStatusColor(outfit.status)}`}>
                        {formatStatus(outfit.status)}
                      </Badge>
                    </div>

                    {outfit.deliveryDate && (
                      <div className="flex items-center gap-1 text-xs ml-5">
                        <Calendar className="h-3 w-3" />
                        <span
                          className={
                            isUrgent ? "text-red-600 font-medium" : "text-muted-foreground"
                          }
                        >
                          {formatDate(outfit.deliveryDate)}
                          {isUrgent && " ⚠️"}
                        </span>
                      </div>
                    )}

                    {outfit.masterName && (
                      <p className="text-xs text-muted-foreground ml-5">
                        Master: {outfit.masterName}
                      </p>
                    )}

                    {next && (
                      <LoadingButton
                        size="sm"
                        className="w-full mt-1"
                        loading={transitionMutation.isPending}
                        onClick={() =>
                          transitionMutation.mutate({ id: outfit.id, newStatus: next })
                        }
                      >
                        {formatStatus(next)} <ArrowRight className="h-3 w-3" />
                      </LoadingButton>
                    )}
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
    const masterTransitions: Record<string, string> = {
      PATTERN_DRAFTING: maggamRequired ? "MAGGAM_WORK" : "FABRIC_CUTTING",
      MAGGAM_WORK: "MAGGAM_REVIEW",
      FABRIC_CUTTING: "STITCHING",
      STITCHING: "PRODUCTION_COMPLETED",
    };
    if (masterTransitions[current]) return masterTransitions[current];
  }

  if (role === "DESIGNER" || role === "ADMIN") {
    if (current === "MAGGAM_REVIEW") return "FABRIC_CUTTING";
  }

  return null;
}
