"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";

import {

  OutfitStatusBadge,

  ALL_OUTFIT_STATUSES,

  APPROVAL_ALLOWED_STATUSES,

} from "@/components/outfit-status-badge";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from "@/components/ui/select";

import { ImageViewer } from "@/components/image-viewer";

import { ProfileMeasurements } from "@/components/portal/profile-measurements";

import { formatDate, formatStatus } from "@/lib/utils";

import { compressImage } from "@/lib/compress-image";

import {

  Scissors,

  Calendar,

  Package,

  CreditCard,

  Shirt,

  Upload,

  Check,

  ThumbsUp,

  ThumbsDown,

  Ruler,

  Search,

  AlertCircle,

  Sparkles,

  Camera,

  ChevronLeft,

  Filter,

} from "lucide-react";

export default function CustomerPortalPage() {

  const params = useParams();

  const [data, setData] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");

  // "orders" | "measurements"

  const [view, setView] = useState<"orders" | "measurements">("orders");

  useEffect(() => {

    async function fetchData() {

      try {

        const res = await fetch(`/api/portal/${params.token}`);

        if (!res.ok) {

          setError("Invalid or expired portal link");

          return;

        }

        setData(await res.json());

      } catch {

        setError("Failed to load your outfit records");

      } finally {

        setLoading(false);

      }

    }

    fetchData();

  }, [params.token]);

  useEffect(() => {

    if (!data) return;

    let active = true;

    let lastTimestamp = Date.now();

    function refetchData() {

      fetch(`/api/portal/${params.token}`)

        .then((res) => (res.ok ? res.json() : null))

        .then((newData) => {

          if (newData) setData(newData);

        });

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

        if (body.hasUpdates) {

          refetchData();

        }

        if (body.serverTime) lastTimestamp = body.serverTime;

      } catch { }

    }

    const intervalId = setInterval(poll, 4000);

    poll();

    return () => {

      active = false;

      clearInterval(intervalId);

    };

  }, [!!data, params.token]);

  const filteredOrders = useMemo(() => {

    if (!data?.orders) return [];

    return data.orders

      .map((order: any) => {

        let outfits = order.outfits || [];

        if (statusFilter !== "all") {

          outfits = outfits.filter((o: any) => o.status === statusFilter);

        }

        if (searchQuery.trim()) {

          const q = searchQuery.toLowerCase();

          outfits = outfits.filter(

            (o: any) =>

              o.name?.toLowerCase().includes(q) ||

              o.type?.toLowerCase().includes(q),

          );

        }

        return { ...order, outfits };

      })

      .filter((order: any) => order.outfits.length > 0)

      .sort((a: any, b: any) =>

        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()

      );

  }, [data, searchQuery, statusFilter]);

  const allOutfitStatuses = useMemo(() => {

    if (!data?.orders) return [];

    const statuses = new Set<string>();

    data.orders.forEach((order: any) =>

      (order.outfits || []).forEach((o: any) => statuses.add(o.status)),

    );

    return ALL_OUTFIT_STATUSES.filter((s) => statuses.has(s));

  }, [data]);

  if (loading) {

    return (

      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-muted/50 to-background px-4">

        <div className="space-y-5 text-center">

          <div className="relative flex justify-center">

            <Scissors className="h-10 w-10 text-primary" />

          </div>

          <p className="text-sm font-medium text-muted-foreground">

            Fetching your custom order details...

          </p>

        </div>

      </div>

    );

  }

  if (error || !data) {

    return (

      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">

        <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-7 text-center shadow-sm">

          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />

          <h3 className="text-lg font-semibold">Access Error</h3>

          <p className="text-sm text-muted-foreground">{error}</p>

          <p className="text-xs text-muted-foreground">

            Please contact the urumi by mounika team to request a fresh portal

            link.

          </p>

        </div>

      </div>

    );

  }

  const totalOutfits = data.orders.reduce(

    (s: number, o: any) => s + (o.outfits?.length || 0),

    0,

  );

  return (

    <div className="min-h-screen bg-muted/30 text-foreground">

      {/* Header — always static */}

      <header className="sticky top-0 z-30 border-b bg-background/90 shadow-sm backdrop-blur-xl">

        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">

          <div className="flex items-center gap-2 min-w-0">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">

              <Scissors className="h-5 w-5 text-primary" />

            </div>

            <span className="truncate text-sm font-bold tracking-tight sm:text-base">

              urumi by mounika

            </span>

          </div>

          <Badge variant="outline" className="shrink-0 rounded-full px-3 py-1 text-[11px] font-medium sm:text-xs">

            Customer Dashboard

          </Badge>

        </div>

      </header>

      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8 lg:px-8">

        {/* Greeting & Overview Banner — always visible */}

        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm sm:p-7">

          <div className="flex flex-col gap-5">

            <div>

              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">

                Welcome back, {data.customer.name}

              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">

                Real-time status of your tailored outfits and reference approvals.

              </p>

            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4">

              <div className="grid min-w-0 grid-cols-2 overflow-hidden rounded-xl border bg-background/80 text-xs shadow-sm backdrop-blur sm:min-w-[280px]">

                <div className="border-r px-4 py-3">

                  <span className="mb-1 block text-muted-foreground">Active Orders</span>

                  <span className="text-lg font-bold tabular-nums">{data.orders.length}</span>

                </div>

                <div className="px-4 py-3">

                  <span className="mb-1 block text-muted-foreground">Total Outfits</span>

                  <span className="text-lg font-bold tabular-nums">{totalOutfits}</span>

                </div>

              </div>

              {/* Measurements toggle link */}

              {view === "orders" ? (

                <button

                  type="button"

                  onClick={() => setView("measurements")}

                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border bg-background px-3 text-xs font-semibold text-primary shadow-sm transition-colors hover:bg-primary/5"

                >

                  <Ruler className="h-3.5 w-3.5" />

                  My Measurements

                </button>

              ) : (

                <button

                  type="button"

                  onClick={() => setView("orders")}

                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border bg-background px-3 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:text-foreground"

                >

                  <ChevronLeft className="h-3.5 w-3.5" />

                  Back to Orders

                </button>

              )}

            </div>

          </div>

        </div>

        {/* ── MEASUREMENTS VIEW ── */}

        {view === "measurements" && (

          <ProfileMeasurements measurements={data.measurements} />

        )}

        {/* ── ORDERS VIEW ── */}

        {view === "orders" && (<>

          {/* Search & Filter Controls */}

          {totalOutfits > 1 && (

            <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:gap-3 sm:p-4">

              <div className="relative min-w-0 flex-1">

                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

                <Input

                  placeholder="Search by outfit name or type..."

                  value={searchQuery}

                  onChange={(e) => setSearchQuery(e.target.value)}

                  className="h-10 bg-background pl-9 text-sm"

                />

              </div>

              {allOutfitStatuses.length > 1 && (

                <>

                  {/* Mobile: filter icon */}

                  <div className="sm:hidden">

                    <Select value={statusFilter} onValueChange={setStatusFilter}>

                      <SelectTrigger className="h-10 w-10 bg-background p-0">

                        <Filter className={`h-4 w-4 ${statusFilter !== "all" ? "text-primary" : "text-muted-foreground"}`} />

                      </SelectTrigger>

                      <SelectContent align="end">

                        <SelectItem value="all">All Statuses</SelectItem>

                        {allOutfitStatuses.map((status) => (

                          <SelectItem key={status} value={status}>

                            {formatStatus(status)}

                          </SelectItem>

                        ))}

                      </SelectContent>

                    </Select>

                  </div>

                  {/* Desktop: full select */}

                  <div className="hidden sm:block">

                    <Select value={statusFilter} onValueChange={setStatusFilter}>

                      <SelectTrigger className="h-10 min-w-[150px] bg-background px-3 text-sm">

                        <SelectValue placeholder="All Statuses" />

                      </SelectTrigger>

                      <SelectContent>

                        <SelectItem value="all">All Statuses</SelectItem>

                        {allOutfitStatuses.map((status) => (

                          <SelectItem key={status} value={status}>

                            {formatStatus(status)}

                          </SelectItem>

                        ))}

                      </SelectContent>

                    </Select>

                  </div>

                </>

              )}

            </div>

          )}

          {/* Empty State */}

          {filteredOrders.length === 0 && (

            <div className="space-y-3 rounded-2xl border border-dashed bg-card px-5 py-14 text-center text-sm text-muted-foreground">

              <Shirt className="h-8 w-8 mx-auto text-muted-foreground/40" />

              <p className="font-medium">No matching outfits found</p>

              <p className="text-xs text-muted-foreground">

                Try clearing search terms or selecting a different status filter.

              </p>

            </div>

          )}

          {/* Orders List */}

          {filteredOrders.map((order: any) => (

            <div key={order.id} className="space-y-5 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">

              {/* Order Header */}

              <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">

                <div className="space-y-0.5">

                  <p className="text-lg font-bold tracking-tight sm:text-xl">

                    Order #{order.orderNumber}

                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">

                    {order.trialDate && (

                      <span className="flex items-center gap-1">

                        <Calendar className="h-3.5 w-3.5 text-primary" />

                        Trial:

                        <strong className="text-foreground">

                          {formatDate(order.trialDate)}

                        </strong>

                      </span>

                    )}

                    {order.deliveryDate && (

                      <span className="flex items-center gap-1">

                        <Package className="h-3.5 w-3.5 text-primary" />

                        Delivery:

                        <strong className="text-foreground">

                          {formatDate(order.deliveryDate)}

                        </strong>

                      </span>

                    )}

                  </div>

                </div>

                <OutfitStatusBadge status={order.status} responsive={false} />

              </div>

              {/* Outfits */}

              <div className="space-y-4">

                {order.outfits.map((outfit: any) => {

                  const canApprove = APPROVAL_ALLOWED_STATUSES.includes(

                    outfit.status

                  );

                  const designRefs = (outfit.references || []).filter(

                    (ref: any) =>

                      ref.type !== "FABRIC" && ref.type !== "COMPLETION"

                  );

                  const fabricRefs = (outfit.references || []).filter(

                    (ref: any) => ref.type === "FABRIC"

                  );

                  const completionRefs = (outfit.references || []).filter(

                    (ref: any) => ref.type === "COMPLETION"

                  );

                  const showCompletionPhotos =

                    completionRefs.length > 0 &&

                    [

                      "PRODUCTION_COMPLETED",

                      "TRIAL",

                      "ALTERATION",

                      "QC",

                      "READY_FOR_DELIVERY",

                      "DELIVERED",

                    ].includes(outfit.status);

                  const outfitPrice = Number(outfit.price) || 0;

                  const addOns = outfit.addOns || [];

                  const addOnsTotal = addOns.reduce(

                    (sum: number, item: any) =>

                      sum + (Number(item.price) || 0),

                    0

                  );

                  const total = outfitPrice + addOnsTotal;

                  const hasAnyPrice = outfitPrice > 0 || addOnsTotal > 0;

                  const formatPrice = (price: number) =>

                    `₹${price.toLocaleString("en-IN")}`;

                  return (

                    <div

                      key={outfit.id}

                      className="space-y-5 rounded-xl border bg-background p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"

                    >

                      {/* Outfit Header */}

                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                        <div className="flex min-w-0 flex-1 items-start gap-3">

                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">

                            <Shirt className="h-5 w-5" />

                          </div>

                          <div className="min-w-0 flex-1 space-y-1">

                            <h4 className="text-sm font-semibold leading-5">

                              {outfit.name}

                            </h4>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">

                              <span>{outfit.type}</span>

                              {outfit.maggamRequired && (

                                <Badge

                                  variant="secondary"

                                  className="px-2 py-0.5 text-[10px]"

                                >

                                  Maggam Work

                                </Badge>

                              )}

                            </div>

                            {/* Price Summary */}

                            <div className="mt-4 w-full max-w-md overflow-hidden rounded-xl border bg-card shadow-sm">

                              {!hasAnyPrice ? (

                                <div className="flex items-center justify-between gap-3 px-3 py-2.5">

                                  <div>

                                    <p className="text-xs font-medium">

                                      Design Price

                                    </p>

                                    <p className="mt-0.5 text-[11px] text-muted-foreground">

                                      Final quotation pending

                                    </p>

                                  </div>

                                  <Badge

                                    variant="outline"

                                    className="shrink-0 border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"

                                  >

                                    To be confirmed

                                  </Badge>

                                </div>

                              ) : (

                                <>

                                  <div className="space-y-3 p-4">

                                    {outfitPrice > 0 && (

                                      <div className="flex items-center justify-between gap-4 text-xs">

                                        <span className="text-muted-foreground">

                                          Outfit / Design

                                        </span>

                                        <span className="shrink-0 font-medium tabular-nums">

                                          {formatPrice(outfitPrice)}

                                        </span>

                                      </div>

                                    )}

                                    {addOns.map((item: any) => (

                                      <div

                                        key={item.id}

                                        className="flex items-center justify-between gap-4 text-xs"

                                      >

                                        <span className="min-w-0 break-words text-muted-foreground">

                                          {item.name}

                                        </span>

                                        <span className="shrink-0 font-medium tabular-nums">

                                          {formatPrice(Number(item.price) || 0)}

                                        </span>

                                      </div>

                                    ))}

                                  </div>

                                  <div className="flex items-center justify-between gap-4 border-t bg-primary/[0.04] px-4 py-3">

                                    <div>

                                      <p className="text-xs font-semibold">

                                        Total Amount

                                      </p>

                                      <p className="text-[10px] text-muted-foreground">

                                        Including add-ons

                                      </p>

                                    </div>

                                    <span className="shrink-0 text-base font-bold tabular-nums">

                                      {formatPrice(total)}

                                    </span>

                                  </div>

                                </>

                              )}

                            </div>

                          </div>

                        </div>

                        {/* Outfit Status */}

                        <div className="flex shrink-0 items-center sm:justify-end">

                          <OutfitStatusBadge status={outfit.status} />

                        </div>

                      </div>

                      {/* Design References */}

                      {designRefs.length > 0 && (

                        <div className="space-y-3 border-t pt-4">

                          <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">

                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">

                              {canApprove

                                ? "Design References (Requires Approval)"

                                : "Confirmed References"}

                            </span>

                            {!canApprove && (

                              <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-muted-foreground dark:bg-neutral-800">

                                Locked for production

                              </span>

                            )}

                          </div>

                          <PortalReferences

                            references={designRefs}

                            token={params.token as string}

                            outfitId={outfit.id}

                            canApprove={canApprove}

                          />

                        </div>

                      )}

                      {/* Customer Material */}

                      {fabricRefs.length > 0 && (

                        <div className="space-y-3 border-t pt-4">

                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">

                            Customer Material

                          </span>

                          <PortalReferences

                            references={fabricRefs}

                            token={params.token as string}

                            outfitId={outfit.id}

                            canApprove={false}

                          />

                        </div>

                      )}

                      {/* Completion Photos */}

                      {showCompletionPhotos && (

                        <div className="space-y-3 border-t pt-4">

                          <div className="flex flex-wrap items-center gap-2">

                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">

                              Finished Outfit

                            </span>

                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">

                              ✓ Ready

                            </span>

                          </div>

                          <PortalReferences

                            references={completionRefs}

                            token={params.token as string}

                            outfitId={outfit.id}

                            canApprove={false}

                          />

                        </div>

                      )}

                      {/* Upload */}

                      {canApprove && (

                        <div className="space-y-3 border-t pt-4">

                          <PortalUpload

                            outfitId={outfit.id}

                            token={params.token as string}

                            maggamRequired={outfit.maggamRequired}

                          />

                        </div>

                      )}

                    </div>

                  );

                })}

              </div>

              {/* Financial Summary */}

              {(order.totalPaid > 0 || Number(order.estimatedAmount) > 0) && (

                <div className="space-y-4 rounded-xl border bg-muted/30 p-4 text-xs sm:p-5">

                  <div className="flex items-center gap-2">

                    <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />

                    <span className="font-medium text-muted-foreground">Payment Summary</span>

                  </div>

                  {(() => {

                    const liveTotal = (order.outfits || []).reduce((s: number, o: any) => {

                      const outfitPrice = Number(o.price) || 0;

                      const addOnsTotal = (o.addOns || []).reduce(

                        (as: number, a: any) => as + (Number(a.price) || 0), 0

                      );

                      return s + outfitPrice + addOnsTotal;

                    }, 0);

                    const displayTotal = liveTotal > 0 ? liveTotal : Number(order.estimatedAmount) || 0;

                    const displayBalance = displayTotal > 0 ? Math.max(0, displayTotal - order.totalPaid) : 0;

                    return (

                      <div className="grid grid-cols-3 gap-2 sm:gap-3">

                        {displayTotal > 0 && (

                          <div>

                            <p className="text-muted-foreground text-[10px]">Total</p>

                            <p className="font-medium font-mono text-xs">₹{displayTotal.toLocaleString()}</p>

                          </div>

                        )}

                        <div>

                          <p className="text-muted-foreground text-[10px]">Paid</p>

                          <p className="font-semibold text-green-600 font-mono text-xs">

                            ₹{order.totalPaid.toLocaleString()}

                          </p>

                        </div>

                        {displayBalance > 0 && (

                          <div>

                            <p className="text-muted-foreground text-[10px]">Balance</p>

                            <p className="font-semibold text-destructive font-mono text-xs">

                              ₹{displayBalance.toLocaleString()}

                            </p>

                          </div>

                        )}

                      </div>

                    );

                  })()}

                  {order.payments && order.payments.length > 0 && (

                    <div className="border-t pt-2 space-y-1.5">

                      {order.payments.map((p: any, idx: number) => (

                        <div key={idx} className="flex items-center justify-between">

                          <span className="text-muted-foreground">

                            {p.method} · {formatDate(p.createdAt)}

                          </span>

                          <span className="font-medium font-mono">

                            ₹{Number(p.amount).toLocaleString()}

                          </span>

                        </div>

                      ))}

                    </div>

                  )}

                </div>

              )}

            </div>

          ))}

        </>

        )}

      </main>

    </div>

  );

}

/* ============================================================

   PORTAL REFERENCES

\============================================================ */

function PortalReferences({

  references,

  token,

  outfitId,

  canApprove,

}: {

  references: any[];

  token: string;

  outfitId: string;

  canApprove: boolean;

}) {

  const [viewerOpen, setViewerOpen] = useState(false);

  const [viewerIndex, setViewerIndex] = useState(0);

  const [localReferences, setLocalReferences] = useState(references);

  useEffect(() => {

    setLocalReferences(references);

  }, [references]);

  const handleDelete = (referenceId: string) => {

    setLocalReferences((prev) => prev.filter((ref) => ref.id !== referenceId));

  };

  return (

    <>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">

        {localReferences.map((ref: any, index: number) => (

          <PortalReferenceCard

            key={ref.id}

            reference={ref}

            token={token}

            outfitId={outfitId}

            canApprove={canApprove}

            onImageClick={() => {

              setViewerIndex(index);

              setViewerOpen(true);

            }}

            onDelete={handleDelete}

          />

        ))}

      </div>

      <ImageViewer

        images={localReferences.map((r: any) => ({

          id: r.id,

          url: r.url,

          filename: r.filename,

        }))}

        initialIndex={viewerIndex}

        open={viewerOpen}

        onClose={() => setViewerOpen(false)}

      />

    </>

  );

}

/* ============================================================

   PORTAL REFERENCE CARD

\============================================================ */

function PortalReferenceCard({

  reference,

  token,

  outfitId,

  canApprove,

  onImageClick,

  onDelete,

}: {

  reference: any;

  token: string;

  outfitId: string;

  canApprove: boolean;

  onImageClick: () => void;

  onDelete: (referenceId: string) => void;

}) {

  const [feedback, setFeedback] = useState<"approved" | "rejected" | null>(

    reference.customerFeedback || null,

  );

  const [loading, setLoading] = useState(false);

  const [deleting, setDeleting] = useState(false);

  async function handleFeedback(action: "approved" | "rejected") {

    setLoading(true);

    try {

      const res = await fetch(`/api/portal/${token}/feedback`, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ referenceId: reference.id, outfitId, feedback: action }),

      });

      if (res.ok) setFeedback(action);

    } catch {

      // Ignore failed feedback requests.

    } finally {

      setLoading(false);

    }

  }

  async function handleDelete() {

    if (!confirm("Are you sure you want to delete this image?")) return;

    setDeleting(true);

    try {

      const res = await fetch(

        `/api/portal/${token}/upload?referenceId=${reference.id}`,

        { method: "DELETE" }

      );

      if (res.ok) {

        onDelete(reference.id);

      } else {

        const error = await res.json().catch(() => ({}));

        alert(error?.error || "Failed to delete image");

      }

    } catch {

      alert("Failed to delete image. Please try again.");

    } finally {

      setDeleting(false);

    }

  }

  return (

    <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">

      <div

        className="relative aspect-[4/5] cursor-pointer overflow-hidden bg-muted"

        onClick={onImageClick}

      >

        <img

          src={reference.url}

          alt="Outfit Reference"

          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"

        />

        {reference.type !== "COMPLETION" && (

          <span

            className={`absolute top-1.5 left-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded shadow-sm ${reference.type === "FABRIC"

              ? "bg-indigo-600 text-white"

              : reference.type === "MAGGAM"

                ? "bg-amber-600 text-white"

                : "bg-slate-700 text-white"

              }`}

          >

            {reference.type === "FABRIC"

              ? "Your Fabric"

              : reference.type === "MAGGAM"

                ? "Maggam"

                : reference.type === "COMPLETION"

                  ? "Finished Outfit"

                  : "Pattern"}

          </span>

        )}

        {feedback && (

          <div

            className={`absolute top-1.5 right-1.5 rounded-full p-1 shadow-md ${feedback === "approved" ? "bg-green-600" : "bg-destructive"

              }`}

          >

            {feedback === "approved" ? (

              <ThumbsUp className="h-3 w-3 text-white" />

            ) : (

              <ThumbsDown className="h-3 w-3 text-white" />

            )}

          </div>

        )}

      </div>

      {reference.type !== "FABRIC" && canApprove && !feedback && (

        <div className="grid grid-cols-2 gap-px bg-border text-[11px]">

          <button

            className="bg-card hover:bg-green-50 text-green-700 py-1.5 font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-50"

            onClick={() => handleFeedback("approved")}

            disabled={loading}

          >

            Approve

          </button>

          <button

            className="bg-card hover:bg-red-50 text-destructive py-1.5 font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-50"

            onClick={() => handleFeedback("rejected")}

            disabled={loading}

          >

            Reject

          </button>

        </div>

      )}

      {reference.type === "FABRIC" && (

        <div className="py-1 text-center text-[10px] font-semibold text-indigo-700 bg-indigo-50">

          Read only

        </div>

      )}

      {feedback && reference.type !== "FABRIC" && (

        <div

          className={`py-1 text-center text-[10px] font-semibold text-white ${feedback === "approved" ? "bg-green-600" : "bg-destructive"

            }`}

        >

          {feedback === "approved" ? "Approved" : "Rejected"}

        </div>

      )}

    </div>

  );

}

/* ============================================================

   CAMERA CAPTURE MODAL

\============================================================ */

function CameraCaptureModal({

  open,

  onClose,

  onCapture,

}: {

  open: boolean;

  onClose: () => void;

  onCapture: (file: File) => void;

}) {

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {

    if (!open) {

      if (stream) stream.getTracks().forEach((track) => track.stop());

      setStream(null);

      setError(null);

      return;

    }

    async function startCamera() {

      if (!navigator.mediaDevices?.getUserMedia) {

        setError("This browser does not support camera capture.");

        return;

      }

      try {

        const mediaStream = await navigator.mediaDevices.getUserMedia({

          video: { facingMode: "environment" },

          audio: false,

        });

        setStream(mediaStream);

        if (videoRef.current) {

          videoRef.current.srcObject = mediaStream;

          await videoRef.current.play();

        }

      } catch {

        setError("Camera access was blocked or unavailable. Please use Upload instead.");

      }

    }

    startCamera();

    return () => {

      if (stream) stream.getTracks().forEach((track) => track.stop());

    };

  }, [open]);

  function handleCapture() {

    const video = videoRef.current;

    if (!video) return;

    const canvas = document.createElement("canvas");

    const width = video.videoWidth || 1280;

    const height = video.videoHeight || 720;

    canvas.width = width;

    canvas.height = height;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(

      (blob) => {

        if (!blob) return;

        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });

        onCapture(file);

        onClose();

      },

      "image/jpeg",

      0.9,

    );

  }

  if (!open) return null;

  return (

    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">

      <div className="w-full max-w-lg space-y-1 rounded-2xl bg-background p-4 shadow-2xl sm:p-5">

        <div className="mb-4 flex items-center justify-between">

          <h4 className="text-sm font-semibold text-slate-900">Take Photo</h4>

          <button

            type="button"

            onClick={onClose}

            className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100"

          >

            Close

          </button>

        </div>

        {error ? (

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">

            {error}

          </div>

        ) : (

          <video

            ref={videoRef}

            autoPlay

            playsInline

            muted

            className="aspect-video w-full rounded-lg bg-black object-cover"

          />

        )}

        <div className="mt-3 flex gap-2">

          <Button className="flex-1" onClick={handleCapture} disabled={!!error}>

            Capture

          </Button>

          <Button variant="outline" className="flex-1" onClick={onClose}>

            Cancel

          </Button>

        </div>

      </div>

    </div>

  );

}

/* ============================================================

   PORTAL UPLOAD

\============================================================ */

function PortalUpload({

  outfitId,

  token,

  maggamRequired,

}: {

  outfitId: string;

  token: string;

  maggamRequired: boolean;

}) {

  const UPLOAD_TYPES = [

    { value: "PATTERN" as const, label: "Pattern", icon: "✨" },

    ...(maggamRequired

      ? [{ value: "MAGGAM" as const, label: "Maggam", icon: "🪡" }]

      : []),

    { value: "FABRIC" as const, label: "My Fabric", icon: "🧵" },

  ];

  const [uploading, setUploading] = useState(false);

  const [uploadError, setUploadError] = useState<string | null>(null);

  const [uploaded, setUploaded] = useState<{ url: string; type: string }[]>([]);

  const [cameraOpen, setCameraOpen] = useState(false);

  const [selectedType, setSelectedType] = useState<"PATTERN" | "MAGGAM" | "FABRIC">("PATTERN");

  async function handleUpload(files: FileList | File | null) {

    if (!files) return;

    setUploading(true);

    setUploadError(null);

    const imageFiles = files instanceof File ? [files] : Array.from(files);

    for (const file of imageFiles) {

      if (file.size > 20 * 1024 * 1024) {

        setUploadError(`"${file.name}" is over 20MB. Please use a smaller image.`);

        continue;

      }

      try {

        const compressed = await compressImage(file);

        const formData = new FormData();

        formData.append("file", compressed);

        formData.append("outfitId", outfitId);

        formData.append("type", selectedType);

        const res = await fetch(`/api/portal/${token}/upload`, {

          method: "POST",

          body: formData,

        });

        if (res.ok) {

          const data = await res.json();

          setUploaded((prev) => [...prev, { url: data.url, type: selectedType }]);

        } else {

          const err = await res.json().catch(() => ({}));

          setUploadError(err?.error ?? `Could not upload "${file.name}". Please try again.`);

        }

      } catch {

        setUploadError("Upload failed. Please check your connection and try again.");

      }

    }

    setUploading(false);

  }

  return (

    <div className="space-y-4">

      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">

        <Sparkles className="h-3.5 w-3.5 text-primary" />

        Share Your References

      </p>

      <div className="flex flex-wrap gap-2">

        {UPLOAD_TYPES.map((t) => (

          <button

            key={t.value}

            type="button"

            onClick={() => setSelectedType(t.value)}

            className={`inline-flex items-center justify-center gap-1 rounded-full border px-2 py-1 text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${selectedType === t.value

              ? "bg-primary text-primary-foreground border-primary"

              : "border-border text-muted-foreground hover:bg-muted"

              }`}

          >

            <span>{t.icon}</span>

            {t.label}

          </button>

        ))}

      </div>

      {uploadError && (

        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-start gap-1.5">

          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />

          <span>{uploadError}</span>

        </div>

      )}

      {uploaded.length > 0 && (

        <div className="flex gap-2 overflow-x-auto pb-1">

          {uploaded.map((item, i) => (

            <div key={i} className="relative h-12 w-12 rounded border overflow-hidden shrink-0">

              <img src={item.url} alt="Uploaded reference" className="object-cover w-full h-full" />

              <div className="absolute top-0.5 right-0.5 bg-green-500 rounded-full p-0.5">

                <Check className="h-2 w-2 text-white" />

              </div>

            </div>

          ))}

        </div>

      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">

        <label className="block">

          <Button

            size="sm"

            variant="outline"

            className="w-full text-xs h-8 border-dashed"

            disabled={uploading}

            asChild

          >

            <span>

              <Upload className="h-3.5 w-3.5 mr-1.5" />

              {uploading ? "Uploading..." : "Upload Photos"}

            </span>

          </Button>

          <input

            type="file"

            className="hidden"

            accept="image/*"

            multiple

            onChange={(e) => handleUpload(e.target.files)}

            disabled={uploading}

          />

        </label>

        <Button

          size="sm"

          variant="outline"

          className="w-full text-xs h-8 border-dashed"

          disabled={uploading}

          onClick={() => setCameraOpen(true)}

        >

          <span className="inline-flex items-center gap-1.5">

            <Camera className="h-3.5 w-3.5" />

            Take Photo

          </span>

        </Button>

        <CameraCaptureModal

          open={cameraOpen}

          onClose={() => setCameraOpen(false)}

          onCapture={(file) => handleUpload(file)}

        />

      </div>

    </div>

  );

}

/* ============================================================

   GARMENT MEASUREMENTS PANEL

\============================================================ */

function GarmentMeasurementsPanel({

  measurements,

  type,

}: {

  measurements: Record<string, string>;

  type: string;

}) {

  const [open, setOpen] = useState(false);

  const filled = Object.entries(measurements).filter(([, v]) => v);

  if (!filled.length) return null;

  return (

    <div className="border-t pt-4">

      <button

        type="button"

        onClick={() => setOpen((v) => !v)}

        className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"

      >

        <span className="flex items-center gap-1.5">

          <Ruler className="h-3.5 w-3.5 text-primary" />

          Garment Measurements · {type}

        </span>

        <span className="text-[10px] font-normal">

          {open ? "Hide" : `Show ${filled.length} field${filled.length !== 1 ? "s" : ""}`}

        </span>

      </button>

      {open && (

        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">

          {filled.map(([field, value]) => (

            <div

              key={field}

              className="flex items-center justify-between text-xs border-b border-dashed border-border/60 py-1"

            >

              <span className="text-muted-foreground">{field}</span>

              <span className="font-semibold font-mono">{value}"</span>

            </div>

          ))}

        </div>

      )}

    </div>

  );

}
