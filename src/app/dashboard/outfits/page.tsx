"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Calendar as CalendarIcon, AlertTriangle, Search, X, Clock, SlidersHorizontal } from "lucide-react";
import { ImageViewer } from "@/components/image-viewer";
import { formatStatus } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { getPriorityOption, PRIORITY_OPTIONS } from "@/components/outfit-form-fields";
import { formatStatusShort, ALL_OUTFIT_STATUSES } from "@/components/outfit-status-badge";
import { DesktopOutfitTable } from "./_components/desktop-outfit-table";
import { MobileOutfitList } from "./_components/mobile-outfit-list";
import type { OutfitListItem } from "./_components/outfit-list-types";

const LIMIT = 20;

export default function OutfitsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMaster } = usePermissions();

  // Initialise all filters from URL params so back-navigation restores state
  // Status is stored lowercase in the URL (e.g. production_ready) but kept uppercase internally
  const [status, setStatus] = useState((searchParams.get("status") || "").toUpperCase());
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [deadline, setDeadline] = useState(searchParams.get("deadline") || "");
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get("priority") || "");
  const [customDate, setCustomDate] = useState<Date | undefined>(
    searchParams.get("customDate") ? new Date(searchParams.get("customDate")!) : undefined
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);

  // Sync filters → URL (replace so back button still works correctly)
  const syncToUrl = useCallback((overrides: Record<string, string | undefined> = {}) => {
    const next: Record<string, string> = {
      status: overrides.status !== undefined ? overrides.status : status,
      search: overrides.search !== undefined ? overrides.search : search,
      deadline: overrides.deadline !== undefined ? overrides.deadline : deadline,
      priority: overrides.priority !== undefined ? overrides.priority : priorityFilter,
      customDate: overrides.customDate !== undefined ? overrides.customDate : (customDate?.toISOString() ?? ""),
      page: overrides.page !== undefined ? overrides.page : String(page),
    };
    const params = new URLSearchParams();
    // Store status lowercase in URL
    if (next.status && next.status !== "all") params.set("status", next.status.toLowerCase());
    if (next.search) params.set("search", next.search);
    if (next.deadline) params.set("deadline", next.deadline);
    if (next.priority) params.set("priority", next.priority);
    if (next.customDate) params.set("customDate", next.customDate);
    if (Number(next.page) > 1) params.set("page", next.page);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [status, search, deadline, priorityFilter, customDate, page, pathname, router]);

  // Image viewer state
  const [viewerImages, setViewerImages] = useState<{ id: string; url: string }[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  function openViewer(images: { id: string; url: string }[], index = 0) {
    setViewerImages(images);
    setViewerIndex(index);
    setViewerOpen(true);
  }

  const queryKey = ["outfits", status, search, deadline, priorityFilter, customDate?.toISOString(), page];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      if (search) params.set("search", search);
      if (priorityFilter) params.set("priority", priorityFilter);
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

  const outfits: OutfitListItem[] = data?.outfits || [];
  const total = data?.total || 0;
  const hasFilters = status || search || deadline || customDate || priorityFilter;

  // ── Filter setters that also update the URL ──────────────────────────────
  function handleStatus(v: string) { setStatus(v); setPage(1); syncToUrl({ status: v, page: "1" }); }
  function handleSearch(v: string) { setSearch(v); setPage(1); syncToUrl({ search: v, page: "1" }); }
  function handleDeadline(v: string) { setDeadline(v); setCustomDate(undefined); setPage(1); syncToUrl({ deadline: v, customDate: "", page: "1" }); }
  function handlePriority(v: string) { setPriorityFilter(v); setPage(1); syncToUrl({ priority: v, page: "1" }); }
  function handleCustomDate(d: Date | undefined) { setCustomDate(d); setDeadline(""); setPage(1); syncToUrl({ customDate: d?.toISOString() ?? "", deadline: "", page: "1" }); }
  function handlePage(p: number) { setPage(p); syncToUrl({ page: String(p) }); }

  function clearAll() {
    setStatus(""); setSearch(""); setDeadline(""); setCustomDate(undefined); setPriorityFilter(""); setPage(1);
    router.replace(pathname, { scroll: false });
  }

  // Build the current filtered URL to pass as returnTo on outfit detail navigation
  function buildReturnUrl() {
    const params = new URLSearchParams();
    if (status && status !== "all") params.set("status", status.toLowerCase());
    if (search) params.set("search", search);
    if (deadline) params.set("deadline", deadline);
    if (priorityFilter) params.set("priority", priorityFilter);
    if (customDate) params.set("customDate", customDate.toISOString());
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/dashboard/outfits${qs ? `?${qs}` : ""}`;
  }

  const DEADLINE_PILLS = [
    { value: "overdue", label: "Overdue", icon: <AlertTriangle className="h-3 w-3" />, className: "text-red-600 border-red-300 bg-red-50 hover:bg-red-100 data-[active=true]:bg-red-600 data-[active=true]:text-white data-[active=true]:border-red-600" },
    { value: "today", label: "Today", icon: <Clock className="h-3 w-3" />, className: "text-amber-600 border-amber-300 bg-amber-50 hover:bg-amber-100 data-[active=true]:bg-amber-500 data-[active=true]:text-white data-[active=true]:border-amber-500" },
    { value: "tomorrow", label: "Tomorrow", icon: <CalendarIcon className="h-3 w-3" />, className: "text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100 data-[active=true]:bg-blue-600 data-[active=true]:text-white data-[active=true]:border-blue-600" },
    { value: "week", label: "This Week", icon: <CalendarIcon className="h-3 w-3" />, className: "text-violet-600 border-violet-300 bg-violet-50 hover:bg-violet-100 data-[active=true]:bg-violet-600 data-[active=true]:text-white data-[active=true]:border-violet-600" },
  ];

  // Priority filter pills — only "Next" and "Today" are meaningful to filter by
  const PRIORITY_PILLS = PRIORITY_OPTIONS.filter((o) => o.value > 0).map((o) => ({
    value: String(o.value),
    label: o.label,
    className: o.className + " hover:opacity-90 data-[active=true]:ring-1 data-[active=true]:ring-current",
  }));

  return (
    <div className="space-y-4">
      {/* Mobile: sticky header, search and one-line quick filters */}
      <div className="sticky top-0 z-30 -mx-4 sm:hidden border-b bg-background/95 px-4 pb-3 pt-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight">Outfits</h1>
            <p className="text-xs text-muted-foreground">{total} total</p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search outfits..."
                className="h-9 rounded-full pl-9"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              aria-label="Toggle advanced filters"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted ${filtersOpen ? "bg-muted text-foreground" : "text-muted-foreground"
                }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {(deadline || customDate || status || priorityFilter) && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
              )}
            </button>
          </div>
        </div>



        <div className="mt-3 -mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max min-w-full flex-nowrap items-center gap-2">
            <button
              type="button"
              data-active={!deadline && !customDate && !priorityFilter && (!status || status === "all")}
              onClick={() => {
                setDeadline("");
                setCustomDate(undefined);
                setPriorityFilter("");
                setStatus("");
                setPage(1);
                syncToUrl({ deadline: "", customDate: "", priority: "", status: "", page: "1" });
              }}
              className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors data-[active=true]:border-primary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
            >
              All
            </button>

            {DEADLINE_PILLS.map((pill) => {
              const isActive = deadline === pill.value;
              return (
                <button
                  key={pill.value}
                  data-active={isActive}
                  onClick={() => handleDeadline(isActive ? "" : pill.value)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${pill.className}`}
                >
                  {pill.icon}
                  {pill.label}
                  {isActive && <X className="h-3 w-3 ml-0.5 opacity-70" />}
                </button>
              );
            })}
            <div>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    data-active={!!customDate}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors text-muted-foreground border-border bg-background data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary"
                  >
                    <CalendarIcon className="h-3 w-3" />
                    {customDate ? format(customDate, "dd MMM yyyy") : "Pick a date"}
                    {customDate && (
                      <span role="button" onClick={(e) => { e.stopPropagation(); handleCustomDate(undefined); }} className="ml-0.5 opacity-70">
                        <X className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar mode="single" selected={customDate} onSelect={(d) => handleCustomDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            {hasFilters && (
              <button onClick={clearAll} className="text-xs text-muted-foreground underline underline-offset-2">
                Clear all filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Desktop heading */}
      <div className="hidden sm:block">
        <h1 className="text-2xl font-bold">Outfits</h1>
        <p className="text-xs text-muted-foreground">{total} total</p>
      </div>

      {/* ── FILTERS ─────────────────────────────────────────────────────── */}

      {/* Mobile: collapsible panel */}
      {filtersOpen && (
        <div className="sm:hidden rounded-xl border bg-card p-3 space-y-3 shadow-sm">
          {/* Status */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Status</p>
            <Select value={status} onValueChange={handleStatus}>
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {ALL_OUTFIT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="sm:hidden">{formatStatusShort(s)}</span>
                    <span className="hidden sm:inline">{formatStatus(s)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


        </div>
      )}

      {/* Desktop: always-visible filters */}
      <div className="hidden sm:flex flex-col gap-2">
        {/* Pills row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Priority pills */}
          {PRIORITY_PILLS.map((pill) => {
            const isActive = priorityFilter === pill.value;
            return (
              <button
                key={pill.value}
                data-active={isActive}
                onClick={() => handlePriority(isActive ? "" : pill.value)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${pill.className}`}
              >
                {pill.label}
                {isActive && <X className="h-3 w-3 ml-0.5 opacity-70" />}
              </button>
            );
          })}

          {/* Separator dot */}
          <span className="text-muted-foreground/40 text-sm select-none">·</span>

          {DEADLINE_PILLS.map((pill) => {
            const isActive = deadline === pill.value;
            return (
              <button
                key={pill.value}
                data-active={isActive}
                onClick={() => handleDeadline(isActive ? "" : pill.value)}
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
                  <span role="button" aria-label="Clear date" onClick={(e) => { e.stopPropagation(); handleCustomDate(undefined); }} className="ml-0.5 opacity-70 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar mode="single" selected={customDate} onSelect={(d) => handleCustomDate(d)} initialFocus />
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
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={handleStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {ALL_OUTFIT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="sm:hidden">{formatStatusShort(s)}</span>
                  <span className="hidden sm:inline">{formatStatus(s)}</span>
                </SelectItem>
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
          {/* Responsive outfit lists */}
          <DesktopOutfitTable
            outfits={outfits}
            isMaster={isMaster}
            listQueryKey={queryKey}
            onSelectOutfit={(outfit) =>
              router.push(`/dashboard/outfits/${outfit.id}?from=outfits&returnTo=${encodeURIComponent(buildReturnUrl())}`)
            }
            onOpenMaterial={(images) => openViewer(images, 0)}
          />
          <MobileOutfitList
            outfits={outfits}
            isMaster={isMaster}
            listQueryKey={queryKey}
            getOutfitHref={(outfit) =>
              `/dashboard/outfits/${outfit.id}?from=outfits&returnTo=${encodeURIComponent(buildReturnUrl())}`
            }
            onOpenMaterial={(images) => openViewer(images, 0)}
          />

          <Pagination page={page} total={total} limit={LIMIT} onPageChange={handlePage} />
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
