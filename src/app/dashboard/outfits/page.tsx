"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/pagination";
import Image from "next/image";
import { Shirt, Calendar as CalendarIcon, AlertTriangle, Search, X, ArrowRight, Clock, SlidersHorizontal, ChevronDown, ImageOff } from "lucide-react";
import { ImageViewer } from "@/components/image-viewer";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const ALL_STATUSES = [
  "DRAFT",
  "DESIGN_IN_PROGRESS",
  "WAITING_FOR_REFERENCES",
  "WAITING_FOR_DEPENDENCIES",
  "PRODUCTION_READY",
  "PATTERN_DRAFTING",
  "MAGGAM_WORK",
  "MAGGAM_REVIEW",
  "FABRIC_CUTTING",
  "STITCHING",
  "PRODUCTION_COMPLETED",
  "TRIAL",
  "ALTERATION",
  "QC",
  "READY_FOR_DELIVERY",
  "DELIVERED",
];

const LIMIT = 20;

// ─── Per-Outfit Status Updater ───────────────────────────────────────────────

function OutfitStatusUpdater({
  outfitId,
  onSuccess,
}: {
  outfitId: string;
  onSuccess: () => void;
}) {
  const { data: transitions } = useQuery({
    queryKey: ["outfit-transitions", outfitId],
    queryFn: async () => {
      const res = await fetch(`/api/outfits/${outfitId}/transition`);
      if (!res.ok) return { availableTransitions: [] };
      return res.json();
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await fetch(`/api/outfits/${outfitId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Transition failed");
      }
      return res.json();
    },
    onSuccess: () => {
      onSuccess();
      toast({ title: "Status updated" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed", description: error.message });
    },
  });

  const available: { status: string; label: string }[] =
    transitions?.availableTransitions ?? [];

  if (available.length === 0) return <span className="text-[11px] text-muted-foreground">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {available.map((t) => (
        <LoadingButton
          key={t.status}
          size="sm"
          variant="outline"
          className="h-6 gap-1 px-2 text-[11px] bg-background"
          loading={
            transitionMutation.isPending &&
            transitionMutation.variables === t.status
          }
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            transitionMutation.mutate(t.status);
          }}
        >
          <ArrowRight className="h-2.5 w-2.5" />
          {t.label}
        </LoadingButton>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

export default function OutfitsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [deadline, setDeadline] = useState("");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Image viewer state
  const [viewerImages, setViewerImages] = useState<{ id: string; url: string }[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  function openViewer(images: { id: string; url: string }[], index = 0) {
    setViewerImages(images);
    setViewerIndex(index);
    setViewerOpen(true);
  }

  const queryKey = ["outfits", status, search, deadline, customDate?.toISOString(), page];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      if (search) params.set("search", search);
      if (deadline) {
        params.set("deadline", deadline);
      } else if (customDate) {
        params.set("deadline", "custom");
        params.set("deadlineDate", customDate.toISOString());
      }
      params.set("page", String(page));
      params.set("limit", String(LIMIT));
      const res = await fetch(`/api/outfits?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const outfits = data?.outfits || [];
  const total = data?.total || 0;
  const hasFilters = status || search || deadline || customDate;

  function clearAll() {
    setStatus(""); setSearch(""); setDeadline(""); setCustomDate(undefined); setPage(1);
  }

  function invalidate(outfitId: string) {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["outfit-transitions", outfitId] });
  }

  const DEADLINE_PILLS = [
    { value: "overdue",  label: "Overdue",   icon: <AlertTriangle className="h-3 w-3" />, className: "text-red-600 border-red-300 bg-red-50 hover:bg-red-100 data-[active=true]:bg-red-600 data-[active=true]:text-white data-[active=true]:border-red-600" },
    { value: "today",    label: "Today",     icon: <Clock className="h-3 w-3" />,         className: "text-amber-600 border-amber-300 bg-amber-50 hover:bg-amber-100 data-[active=true]:bg-amber-500 data-[active=true]:text-white data-[active=true]:border-amber-500" },
    { value: "tomorrow", label: "Tomorrow",  icon: <CalendarIcon className="h-3 w-3" />,  className: "text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100 data-[active=true]:bg-blue-600 data-[active=true]:text-white data-[active=true]:border-blue-600" },
    { value: "week",     label: "This Week", icon: <CalendarIcon className="h-3 w-3" />,  className: "text-violet-600 border-violet-300 bg-violet-50 hover:bg-violet-100 data-[active=true]:bg-violet-600 data-[active=true]:text-white data-[active=true]:border-violet-600" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Outfits</h1>
        <p className="text-xs text-muted-foreground">{total} total</p>
      </div>

      {/* ── FILTERS ─────────────────────────────────────────────────────── */}

      {/* Mobile: search + toggle row */}
      <div className="flex gap-2 sm:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search outfits..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 px-3"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {(deadline || customDate || status) && (
            <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
              {[deadline, customDate, status && status !== "all" ? status : ""].filter(Boolean).length}
            </span>
          )}
          <ChevronDown className={`h-3 w-3 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {/* Mobile: collapsible panel */}
      {filtersOpen && (
        <div className="sm:hidden rounded-xl border bg-card p-3 space-y-3 shadow-sm">
          {/* Status */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Status</p>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{formatStatus(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Deadline pills */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Deadline</p>
            <div className="flex flex-wrap gap-1.5">
              {DEADLINE_PILLS.map((pill) => {
                const isActive = deadline === pill.value;
                return (
                  <button
                    key={pill.value}
                    data-active={isActive}
                    onClick={() => { setDeadline(isActive ? "" : pill.value); setCustomDate(undefined); setPage(1); }}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${pill.className}`}
                  >
                    {pill.icon}
                    {pill.label}
                    {isActive && <X className="h-3 w-3 ml-0.5 opacity-70" />}
                  </button>
                );
              })}

              {/* Date picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    data-active={!!customDate}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors text-muted-foreground border-border bg-background data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary"
                  >
                    <CalendarIcon className="h-3 w-3" />
                    {customDate ? format(customDate, "dd MMM yyyy") : "Pick a date"}
                    {customDate && (
                      <span role="button" onClick={(e) => { e.stopPropagation(); setCustomDate(undefined); setPage(1); }} className="ml-0.5 opacity-70">
                        <X className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar mode="single" selected={customDate} onSelect={(d) => { setCustomDate(d); setDeadline(""); setPage(1); }} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Clear all */}
          {hasFilters && (
            <button onClick={clearAll} className="text-xs text-muted-foreground underline underline-offset-2">
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Desktop: always-visible filters */}
      <div className="hidden sm:flex flex-col gap-2">
        {/* Pills row */}
        <div className="flex flex-wrap items-center gap-2">
          {DEADLINE_PILLS.map((pill) => {
            const isActive = deadline === pill.value;
            return (
              <button
                key={pill.value}
                data-active={isActive}
                onClick={() => { setDeadline(isActive ? "" : pill.value); setCustomDate(undefined); setPage(1); }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${pill.className}`}
              >
                {pill.icon}
                {pill.label}
                {isActive && <X className="h-3 w-3 ml-0.5 opacity-70" />}
              </button>
            );
          })}

          {/* Date picker */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                data-active={!!customDate}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors text-muted-foreground border-border bg-background hover:bg-muted data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary"
              >
                <CalendarIcon className="h-3 w-3" />
                {customDate ? format(customDate, "dd MMM yyyy") : "Pick a date"}
                {customDate && (
                  <span role="button" aria-label="Clear date" onClick={(e) => { e.stopPropagation(); setCustomDate(undefined); setPage(1); }} className="ml-0.5 opacity-70 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar mode="single" selected={customDate} onSelect={(d) => { setCustomDate(d); setDeadline(""); setPage(1); }} initialFocus />
            </PopoverContent>
          </Popover>
        </div>

        {/* Search + status row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by outfit name or customer..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{formatStatus(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : outfits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {hasFilters ? "No outfits match your filters" : "No outfits found"}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-lg border overflow-x-auto">
            <table className="w-full text-xs min-w-[800px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Outfit</th>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Order</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Material</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Designer</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Master</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Delivery</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Move to</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {outfits.map((outfit: any) => {
                  const isBlocked = outfit.status === "WAITING_FOR_DEPENDENCIES";
                  const isUrgent =
                    outfit.deliveryDate &&
                    new Date(outfit.deliveryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

                  return (
                    <tr
                      key={outfit.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => router.push(`/dashboard/outfits/${outfit.id}`)}
                    >
                      <td className="px-4 py-3 max-w-[180px]">
                        <p className="font-medium truncate">{outfit.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {outfit.type}{outfit.maggamRequired && " · M"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[130px] truncate">
                        {outfit.customerName || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {outfit.orderNumber || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge className={`${getStatusColor(outfit.status)} text-[10px] whitespace-nowrap`}>
                            {formatStatus(outfit.status)}
                          </Badge>
                          {isBlocked && (
                            <Badge variant="destructive" className="text-[10px] whitespace-nowrap">BLOCKED</Badge>
                          )}
                        </div>
                      </td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                      >
                        {outfit.customerMaterialImageUrl ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openViewer(outfit.customerMaterialImages, 0); }}
                            className="relative block h-10 w-10 shrink-0 overflow-hidden rounded border border-border bg-muted hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Image
                              src={outfit.customerMaterialImageUrl}
                              alt="Customer material"
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
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
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[100px] truncate">
                        {outfit.designerName || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[100px] truncate">
                        {outfit.masterName || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={isUrgent ? "text-red-600 font-medium text-xs" : "text-muted-foreground text-xs"}>
                          {formatDate(outfit.deliveryDate)}
                          {isUrgent && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <OutfitStatusUpdater
                          outfitId={outfit.id}
                          onSuccess={() => invalidate(outfit.id)}
                        />
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
              const isBlocked = outfit.status === "WAITING_FOR_DEPENDENCIES";
              const isUrgent =
                outfit.deliveryDate &&
                new Date(outfit.deliveryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

              return (
                <div key={outfit.id} className="rounded-xl border bg-card shadow-sm p-4 transition-all hover:shadow-md">
                  {/* Top row: name + status badge */}
                  <Link href={`/dashboard/outfits/${outfit.id}`} className="block">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Shirt className="h-3.5 w-3.5 text-primary shrink-0" />
                          <p className="font-semibold text-sm truncate">{outfit.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground ml-5 truncate">
                          {outfit.customerName && `${outfit.customerName} · `}
                          {outfit.type}
                          {outfit.maggamRequired && " · Maggam"}
                        </p>
                        {outfit.orderNumber && (
                          <p className="text-[10px] text-muted-foreground ml-5">{outfit.orderNumber}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge className={`${getStatusColor(outfit.status)} text-[10px] max-w-[120px] truncate`}>
                          {formatStatus(outfit.status)}
                        </Badge>
                        {isBlocked && (
                          <Badge variant="destructive" className="text-[10px]">BLOCKED</Badge>
                        )}
                        {outfit.customerMaterialImageUrl ? (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); openViewer(outfit.customerMaterialImages, 0); }}
                            className="relative mt-1 block h-10 w-10 overflow-hidden rounded border border-border bg-muted hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Image
                              src={outfit.customerMaterialImageUrl}
                              alt="Customer material"
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
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

                    {/* Delivery + master */}
                    <div className="flex items-center gap-x-3 ml-5 mb-2">
                      {outfit.deliveryDate && (
                        <span className={`text-[11px] flex items-center gap-0.5 whitespace-nowrap ${isUrgent ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                          <CalendarIcon className="h-3 w-3 shrink-0" />
                          {formatDate(outfit.deliveryDate)}
                          {isUrgent && <AlertTriangle className="h-3 w-3 ml-0.5" />}
                        </span>
                      )}
                      {outfit.masterName && (
                        <p className="text-[11px] text-muted-foreground ml-auto truncate max-w-[100px]">
                          M: {outfit.masterName}
                        </p>
                      )}
                    </div>
                  </Link>

                  {/* Move to row — outside Link to prevent navigation */}
                  <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 mt-1">
                    <span className="text-[11px] font-medium text-muted-foreground shrink-0">Move to</span>
                    <OutfitStatusUpdater
                      outfitId={outfit.id}
                      onSuccess={() => invalidate(outfit.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
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
