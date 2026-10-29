"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Scissors, Package, AlertCircle } from "lucide-react";
import { ALL_OUTFIT_STATUSES } from "@/components/outfit-status-badge";
import { DesktopPortal } from "@/components/portal/desktop-portal";
import { MobilePortal } from "@/components/portal/mobile-portal";
import {
  MobileScreen,
  inProductionCount,
  deliveredCount,
} from "@/components/portal/portal-utils";

export default function CustomerPortalPage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Shared filter state — passed to both desktop and mobile
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Desktop tab
  const [desktopView, setDesktopView] = useState<"orders" | "measurements">("orders");

  // Mobile navigation
  const [mobileScreen, setMobileScreen] = useState<MobileScreen>({ view: "orders" });

  /* ── Initial fetch ── */
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/portal/${params.token}`);
        if (!res.ok) { setError("Invalid or expired portal link"); return; }
        setData(await res.json());
      } catch {
        setError("Failed to load your outfit records");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [params.token]);

  /* ── Live polling ── */
  useEffect(() => {
    if (!data) return;
    let active = true;
    let lastTimestamp = Date.now();

    function refetch() {
      fetch(`/api/portal/${params.token}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setData(d); });
    }

    async function poll() {
      if (!active) return;
      try {
        const res = await fetch(
          `/api/portal/${params.token}/events?since=${lastTimestamp}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const body = await res.json();
        if (body.hasUpdates) refetch();
        if (body.serverTime) lastTimestamp = body.serverTime;
      } catch { }
    }

    const id = setInterval(poll, 4000);
    poll();
    return () => { active = false; clearInterval(id); };
  }, [!!data, params.token]);

  /* ── Derived data ── */
  const filteredOrders = useMemo(() => {
    if (!data?.orders) return [];
    return data.orders
      .map((order: any) => {
        let outfits = order.outfits || [];
        if (statusFilter !== "all")
          outfits = outfits.filter((o: any) => o.status === statusFilter);
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          outfits = outfits.filter(
            (o: any) =>
              o.name?.toLowerCase().includes(q) || o.type?.toLowerCase().includes(q)
          );
        }
        return { ...order, outfits };
      })
      .filter((o: any) => o.outfits.length > 0)
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [data, searchQuery, statusFilter]);

  const allOutfitStatuses = useMemo(() => {
    if (!data?.orders) return [];
    const s = new Set<string>();
    data.orders.forEach((o: any) =>
      (o.outfits || []).forEach((f: any) => s.add(f.status))
    );
    return ALL_OUTFIT_STATUSES.filter((st) => s.has(st));
  }, [data]);

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-muted/50 to-background px-4">
        <div className="space-y-4 text-center">
          <Scissors className="mx-auto h-10 w-10 text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            Fetching your custom order details...
          </p>
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-7 text-center shadow-sm">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h3 className="text-lg font-semibold">Access Error</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">
            Please contact the Urumi by Mounika team to request a fresh portal link.
          </p>
        </div>
      </div>
    );
  }

  const totalOutfits = data.orders.reduce(
    (s: number, o: any) => s + (o.outfits?.length || 0),
    0
  );
  const inProd = inProductionCount(data.orders);
  const delivered = deliveredCount(data.orders);
  const token = params.token as string;

  const sharedProps = {
    data,
    totalOutfits,
    inProd,
    delivered,
    filteredOrders,
    allOutfitStatuses,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    token,
  };

  return (
    <div className="min-h-screen bg-[#faf8f7] text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Scissors className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold tracking-tight leading-none text-foreground">
                URUMI
              </p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">by Mounika</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Package className="h-3.5 w-3.5 text-primary" />
            <div className="text-right hidden sm:block">
              <p className="text-[11px] font-semibold leading-none">Customer Portal</p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                Track your custom outfits
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop (md+) */}
      <div className="hidden md:block">
        <DesktopPortal
          {...sharedProps}
          desktopView={desktopView}
          setDesktopView={setDesktopView}
        />
      </div>

      {/* Mobile (< md) */}
      <div className="md:hidden">
        <MobilePortal
          {...sharedProps}
          screen={mobileScreen}
          setScreen={setMobileScreen}
        />
      </div>
    </div>
  );
}
