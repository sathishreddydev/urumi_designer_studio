"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Ellipsis,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { StudioFilters } from "./studio-filters";
import { StudioAdminDialog } from "./studio-admin-dialog";

interface Studio {
  id: string;
  name: string;
  domain: string;
  logoUrl: string;
  active: boolean;
  deactivateAt: string | null;
  notes: string;
  healthStatus?: "healthy" | "unhealthy";
  storageBytes?: number | null;
}

interface ApiResponse {
  error?: string;
  studios?: Studio[];
  total?: number;
  studio?: Studio;
}

type HealthStatus = "checking" | "healthy" | "unhealthy";
interface StudioListData {
  studios: Studio[];
  total: number;
}

const STUDIO_PAGE_LIMIT = 10;
const STORAGE_WARNING_BYTES = 900_000_000;
const STORAGE_LIMIT_BYTES = 1_000_000_000;

const formatStorage = (bytes: number): string => {
  if (bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return mb < 1024 ? `${mb.toFixed(0)} MB` : `${(mb / 1024).toFixed(2)} GB`;
};

const formatExpiry = (deactivateAt: string, now: number): string => {
  const target = new Date(deactivateAt).getTime();
  const diffDays = Math.ceil((target - now) / 86400000);
  const shortDate = new Date(deactivateAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  if (diffDays <= 0) return `Expired ${shortDate}`;
  if (diffDays === 1) return "Expires tomorrow";
  if (diffDays <= 7) return `Expires in ${diffDays}d`;
  return `Expires ${shortDate}`;
};

async function readApiResponse(response: Response): Promise<ApiResponse> {
  const body = await response.text();
  let result: unknown;
  try {
    result = JSON.parse(body);
  } catch {
    throw new Error(
      `The studios API returned a non-JSON response (HTTP ${response.status}). Check the server logs.`
    );
  }
  if (!result || typeof result !== "object") {
    throw new Error("The studios API returned an invalid response.");
  }
  return result as ApiResponse;
}

export function StudiosList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [statusError, setStatusError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [page, setPage] = useState(1);
  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    healthFilter !== "all";

  const [adminTarget, setAdminTarget] = useState<Studio | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedStudios, setExpandedStudios] = useState<Set<string>>(new Set());

  const toggleStudioDetails = (id: string) => {
    setExpandedStudios((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyDomain = (id: string, domain: string) => {
    navigator.clipboard.writeText(domain);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [search]);

  const studiosQueryKey = useMemo(
    () => ["owner", "studios", page, debouncedSearch, statusFilter, healthFilter] as const,
    [debouncedSearch, healthFilter, page, statusFilter]
  );

  const {
    data: studioData,
    isLoading: loading,
    error: loadError,
  } = useQuery<StudioListData, Error>({
    queryKey: studiosQueryKey,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(STUDIO_PAGE_LIMIT),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (healthFilter !== "all") params.set("health", healthFilter);

      const response = await fetch(`/api/owner/studios?${params.toString()}`, {
        cache: "no-store",
        signal,
      });
      if (response.status === 401) {
        router.replace("/owner/login");
        throw new Error("Authentication required");
      }

      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || "Could not load studios");
      if (!Array.isArray(result.studios)) {
        throw new Error("The studios API response did not contain a studio list.");
      }

      return {
        studios: result.studios,
        total: result.total ?? result.studios.length,
      };
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const studios = studioData?.studios ?? [];
  const total = studioData?.total ?? studios.length;
  const error = loadError?.message ?? "";

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const filteredStudios = useMemo(() => {
    return studios.filter((studio) => {
      const health = studio.healthStatus ?? "checking";
      if (healthFilter !== "all" && health !== healthFilter) return false;
      return true;
    });
  }, [healthFilter, studios]);

  const totalPages = Math.max(1, Math.ceil(total / STUDIO_PAGE_LIMIT));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function handleActiveChange(studio: Studio, active: boolean) {
    setStatusError("");
    setUpdatingIds((current) => new Set(current).add(studio.id));

    try {
      const formData = new FormData();
      formData.set("name", studio.name);
      formData.set("domain", studio.domain);
      formData.set("active", String(active));
      formData.set("clearFavicon", "false");

      const response = await fetch(`/api/owner/studios/${encodeURIComponent(studio.id)}`, {
        method: "PATCH",
        body: formData,
      });
      const result = await readApiResponse(response);
      if (response.status === 401) { router.replace("/owner/login"); return; }
      if (!response.ok) throw new Error(result.error || "Could not update studio status");

      queryClient.setQueryData<StudioListData>(studiosQueryKey, (current) =>
        current
          ? {
            ...current,
            studios: current.studios.map((item) =>
              item.id === studio.id
                ? { ...item, active, deactivateAt: result.studio?.deactivateAt ?? item.deactivateAt }
                : item
            ),
          }
          : current
      );
    } catch (updateError) {
      setStatusError(
        updateError instanceof Error ? updateError.message : "Could not update studio status"
      );
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(studio.id);
        return next;
      });
    }
  }

  return (
    <main className="w-full space-y-6">
      <header className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight sm:text-2xl">Studios</h1>
          <p className="text-xs text-muted-foreground">{total} total</p>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search studios..."
              className="h-9 rounded-full pl-9 sm:h-10 sm:rounded-md"
              aria-label="Search studios"
            />
          </div>
          <Button asChild className="h-9 w-9 shrink-0 rounded-full p-0 sm:h-10 sm:w-auto sm:rounded-md sm:px-4">
            <Link href="/owner/newStudio" aria-label="Add studio" title="Add studio">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add studio</span>
            </Link>
          </Button>
        </div>
      </header>

      {statusError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {statusError}
        </p>
      )}
      <StudioFilters
        statusFilter={statusFilter}
        healthFilter={healthFilter}
        hasActiveFilters={hasActiveFilters}
        onStatusFilterChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
        onHealthFilterChange={(value) => {
          setHealthFilter(value);
          setPage(1);
        }}
        onClearFilters={() => {
          setSearch("");
          setStatusFilter("all");
          setHealthFilter("all");
          setPage(1);
        }}
      />
      <div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading studios…
          </div>
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        ) : studios.length === 0 && hasActiveFilters ? (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-medium">No studios found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try another search or clear the filters.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setHealthFilter("all");
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : studios.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">No studios have been registered yet.</p>
            <Button asChild size="sm">
              <Link href="/owner/newStudio">Register your first studio</Link>
            </Button>
          </div>
        ) : filteredStudios.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No studios match the current search and filters.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setHealthFilter("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
              {filteredStudios.map((studio) => {
                const busy = updatingIds.has(studio.id);
                const expired =
                  studio.deactivateAt !== null &&
                  new Date(studio.deactivateAt).getTime() <= now;
                const effectivelyActive = studio.active && !expired;
                const health: HealthStatus = studio.healthStatus ?? "checking";

                const isLimit =
                  studio.storageBytes != null &&
                  studio.storageBytes >= STORAGE_LIMIT_BYTES;
                const isWarning =
                  studio.storageBytes != null &&
                  !isLimit &&
                  studio.storageBytes >= STORAGE_WARNING_BYTES;

                return (
                  <li key={studio.id} className="p-4 sm:px-5">
                    {/* TOP ROW: Identity + Active Toggle */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {studio.logoUrl ? (
                          <img
                            src={studio.logoUrl}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg bg-neutral-100 object-contain p-1 dark:bg-neutral-900"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-900">
                            <Store className="h-5 w-5" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100 sm:text-base">
                              {studio.name}
                            </p>
                            {expired && (
                              <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                Expired
                              </span>
                            )}
                          </div>

                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                            <a
                              href={`https://${studio.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate hover:underline"
                            >
                              {studio.domain}
                            </a>
                            <button
                              type="button"
                              onClick={() => copyDomain(studio.id, studio.domain)}
                              className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                              title="Copy domain"
                            >
                              {copiedId === studio.id ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Switch */}
                      <div className="flex shrink-0 items-center gap-2 sm:hidden">
                        {busy && (
                          <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                        )}
                        {/* Manual activation switch temporarily disabled.
                        <Switch
                          checked={effectivelyActive}
                          disabled={busy || expired}
                          onCheckedChange={(active) => handleActiveChange(studio, active)}
                          aria-label={`Toggle ${studio.name}`}
                        />
                        */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-neutral-500"
                          aria-label={`${expandedStudios.has(studio.id) ? "Hide" : "Show"} details for ${studio.name}`}
                          aria-expanded={expandedStudios.has(studio.id)}
                          aria-controls={expandedStudios.has(studio.id) ? `studio-notes-mobile-${studio.id}` : undefined}
                          onClick={() => toggleStudioDetails(studio.id)}
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${expandedStudios.has(studio.id) ? "rotate-180" : ""
                              }`}
                          />
                        </Button>
                      </div>

                      {/* Desktop controls */}
                      <div className="hidden shrink-0 items-center gap-1 sm:flex">
                        {busy && (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin text-neutral-400" />
                        )}
                        {/* Manual activation switch temporarily disabled.
                        <Switch
                          checked={effectivelyActive}
                          disabled={busy || expired}
                          onCheckedChange={(active) => handleActiveChange(studio, active)}
                          aria-label={`Toggle ${studio.name}`}
                        />
                        */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-neutral-500"
                          aria-label={`${expandedStudios.has(studio.id) ? "Hide" : "Show"} details for ${studio.name}`}
                          aria-expanded={expandedStudios.has(studio.id)}
                          aria-controls={expandedStudios.has(studio.id) ? `studio-notes-${studio.id}` : undefined}
                          onClick={() => toggleStudioDetails(studio.id)}
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${expandedStudios.has(studio.id) ? "rotate-180" : ""
                              }`}
                          />
                        </Button>
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-neutral-500"
                              aria-label={`Actions for ${studio.name}`}
                            >
                              <Ellipsis className="h-5 w-5" />
                            </Button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              align="end"
                              sideOffset={8}
                              className="z-50 min-w-52 rounded-xl border border-neutral-200 bg-white p-2 text-sm text-neutral-700 shadow-lg dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                            >
                              <DropdownMenu.Item asChild>
                                <Link
                                  href={`/owner/editStudio/${encodeURIComponent(studio.id)}`}
                                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 outline-none hover:bg-neutral-100 focus:bg-neutral-100 dark:hover:bg-neutral-900 dark:focus:bg-neutral-900"
                                >
                                  <Pencil className="h-4 w-4 text-neutral-500" />
                                  Edit Studio
                                </Link>
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                onSelect={() => setAdminTarget(studio)}
                                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 outline-none hover:bg-neutral-100 focus:bg-neutral-100 dark:hover:bg-neutral-900 dark:focus:bg-neutral-900"
                              >
                                <ShieldCheck className="h-4 w-4 text-neutral-500" />
                                Set Admin
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </div>
                    </div>

                    {/* MIDDLE: Single Wrap Line for Health, Storage & Auto-Expiry */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-600 dark:text-neutral-400 sm:pl-[52px]">
                      {/* DB Health */}
                      <span className="inline-flex items-center gap-1.5">
                        {health === "checking" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />
                        ) : (
                          <span
                            className={`h-2 w-2 rounded-full ${health === "healthy" ? "bg-emerald-500" : "bg-red-500"
                              }`}
                          />
                        )}
                        <span>
                          {health === "healthy"
                            ? "DB Connected"
                            : health === "unhealthy"
                              ? "DB Unreachable"
                              : "Checking DB…"}
                        </span>
                      </span>

                      {/* Storage */}
                      <span
                        className={`inline-flex items-center gap-1 ${isLimit
                          ? "font-medium text-red-600 dark:text-red-400"
                          : isWarning
                            ? "font-medium text-amber-600 dark:text-amber-400"
                            : ""
                          }`}
                      >
                        {(isLimit || isWarning) && (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span>
                          {studio.storageBytes == null
                            ? "Storage N/A"
                            : `${formatStorage(studio.storageBytes)} / 1 GB`}
                        </span>
                      </span>

                      {/* Auto-Expiry */}
                      {studio.deactivateAt && (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span>{formatExpiry(studio.deactivateAt, now)}</span>
                        </span>
                      )}
                    </div>

                    {/* NOTES (If present) */}
                    {studio.notes && (
                      <p
                        id={`studio-notes-mobile-${studio.id}`}
                        className={`mt-2 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400 sm:hidden ${expandedStudios.has(studio.id) ? "block" : "hidden"
                          }`}
                      >
                        {studio.notes}
                      </p>
                    )}

                    {expandedStudios.has(studio.id) && studio.notes && (
                      <p
                        id={`studio-notes-${studio.id}`}
                        className="ml-16 mt-2 hidden whitespace-pre-wrap border-t border-neutral-100 py-3 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400 sm:block"
                      >
                        {studio.notes}
                      </p>
                    )}

                    {/* Mobile direct action buttons */}
                    <div className="mt-3.5 flex items-center gap-2 sm:hidden">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="flex-1 rounded-lg border-neutral-200 px-3 py-2 text-xs text-neutral-700 dark:border-neutral-800 dark:text-neutral-300 sm:flex-initial sm:py-1.5"
                      >
                        <Link href={`/owner/editStudio/${encodeURIComponent(studio.id)}`}>
                          Edit
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => setAdminTarget(studio)}
                        className="flex-1 rounded-lg border-neutral-200 px-3 py-2 text-xs text-neutral-700 dark:border-neutral-800 dark:text-neutral-300 sm:flex-initial sm:py-1.5"
                      >
                        Set Admin
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pagination
              page={page}
              total={total}
              limit={STUDIO_PAGE_LIMIT}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <StudioAdminDialog
        studio={adminTarget}
        onClose={() => setAdminTarget(null)}
      />
    </main>
  );
}
