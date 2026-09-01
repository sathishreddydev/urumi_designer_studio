"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageViewer } from "@/components/image-viewer";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";
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
  Clock,
  Sparkles,
  Camera,
  ChevronDown,
} from "lucide-react";

const STATUS_ORDER = [
  "DRAFT",
  "DESIGN_IN_PROGRESS",
  "WAITING_FOR_REFERENCES",
  "WAITING_FOR_DEPENDENCIES",
  "PRODUCTION_READY",
  "PATTERN_DRAFTING",
  "MAGGAM_WORK",
  "MAGGAM_REVIEW",
  "MAGGAM_REVIEWED",
  "FABRIC_CUTTING",
  "STITCHING",
  "PRODUCTION_COMPLETED",
  "TRIAL",
  "ALTERATION",
  "QC",
  "READY_FOR_DELIVERY",
  "DELIVERED",
];

const STATUS_PROGRESS: Record<string, number> = {
  DRAFT: 5,
  DESIGN_IN_PROGRESS: 12,
  WAITING_FOR_REFERENCES: 18,
  WAITING_FOR_DEPENDENCIES: 22,
  PRODUCTION_READY: 28,
  PATTERN_DRAFTING: 38,
  MAGGAM_WORK: 48,
  MAGGAM_REVIEW: 55,
  MAGGAM_REVIEWED: 59,
  FABRIC_CUTTING: 62,
  STITCHING: 72,
  PRODUCTION_COMPLETED: 80,
  TRIAL: 85,
  ALTERATION: 88,
  QC: 92,
  READY_FOR_DELIVERY: 96,
  DELIVERED: 100,
};

const APPROVAL_ALLOWED_STATUSES = [
  "DRAFT",
  "DESIGN_IN_PROGRESS",
  "WAITING_FOR_REFERENCES",
  "WAITING_FOR_DEPENDENCIES",
];

export default function CustomerPortalPage() {
  const params = useParams();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Profile Measurements accordion
  // Closed by default on mobile.
  // Desktop always shows the measurements.
  const [profileMeasurementsOpen, setProfileMeasurementsOpen] = useState(false);

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

    let eventSource: EventSource | null = null;

    function refetchData() {
      fetch(`/api/portal/${params.token}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((newData) => {
          if (newData) setData(newData);
        });
    }

    try {
      eventSource = new EventSource(`/api/portal/${params.token}/events`);

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);

          if (parsed.type === "update") {
            refetchData();
          }
        } catch {}
      };
    } catch {}

    return () => {
      eventSource?.close();
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

        return {
          ...order,
          outfits,
        };
      })
      .filter((order: any) => order.outfits.length > 0);
  }, [data, searchQuery, statusFilter]);

  const allOutfitStatuses = useMemo(() => {
    if (!data?.orders) return [];

    const statuses = new Set<string>();

    data.orders.forEach((order: any) =>
      (order.outfits || []).forEach((o: any) => statuses.add(o.status)),
    );

    return STATUS_ORDER.filter((s) => statuses.has(s));
  }, [data]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <div className="relative flex justify-center">
            <Scissors className="h-10 w-10 text-primary animate-bounce" />
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
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md text-center border-destructive/20 shadow-lg">
          <CardContent className="pt-8 pb-8 space-y-3">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />

            <h3 className="text-lg font-semibold">Access Error</h3>

            <p className="text-sm text-muted-foreground">{error}</p>

            <p className="text-xs text-muted-foreground">
              Please contact the urumi by mounika team to request a fresh portal
              link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalOutfits = data.orders.reduce(
    (s: number, o: any) => s + (o.outfits?.length || 0),
    0,
  );

  return (
    <div className="min-h-screen bg-neutral-50/50 dark:bg-background">
      {/* Header */}
      <header className="border-b bg-card/90 backdrop-blur-md sticky top-0 z-20">
        <div className="container mx-auto flex items-center justify-between px-3 py-3 max-w-6xl gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-primary/10 p-1.5 rounded-md shrink-0">
              <Scissors className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
            </div>

            <span className="font-semibold text-sm sm:text-base tracking-tight truncate">
              urumi by mounika
            </span>
          </div>

          <Badge variant="outline" className="text-xs font-normal shrink-0">
            Customer Dashboard
          </Badge>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl p-4 md:p-6 space-y-6">
        {/* Top Greeting & Overview Banner */}
        <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-6 border border-primary/10">
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                Welcome back, {data.customer.name}
              </h1>

              <p className="text-xs text-muted-foreground mt-1 sm:text-sm">
                Real-time status of your tailored outfits and reference
                approvals.
              </p>
            </div>

            <div className="flex items-center gap-4 bg-card/80 backdrop-blur px-3 py-2 rounded-lg border text-xs self-start">
              <div>
                <span className="text-muted-foreground block">
                  Active Orders
                </span>

                <span className="font-semibold text-sm">
                  {data.orders.length}
                </span>
              </div>

              <div className="h-8 w-px bg-border" />

              <div>
                <span className="text-muted-foreground block">
                  Total Outfits
                </span>

                <span className="font-semibold text-sm">{totalOutfits}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          {/* Left Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            {/* =====================================================
                PROFILE MEASUREMENTS
                Mobile = Accordion / Closed by default
                Desktop = Always visible
            ====================================================== */}
            {data.measurements && (
              <Card className="shadow-sm">
                {/* Mobile Header */}
                <button
                  type="button"
                  onClick={() => setProfileMeasurementsOpen((value) => !value)}
                  className="md:hidden w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="text-sm font-semibold flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-primary" />
                    Profile Measurements
                  </span>

                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                      profileMeasurementsOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Desktop Header */}
                <CardHeader className="hidden md:block pb-3 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-primary" />
                    Profile Measurements
                  </CardTitle>
                </CardHeader>

                {/* Mobile + Desktop Content */}
                <CardContent
                  className={`
                    pt-4
                    ${profileMeasurementsOpen ? "block" : "hidden"}
                    md:block
                  `}
                >
                  <div className="space-y-2">
                    {Object.entries(
                      data.measurements as Record<string, string>,
                    ).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between text-xs py-1 border-b border-dashed border-border/60 last:border-0"
                      >
                        <span className="text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </span>

                        <span className="font-medium font-mono text-foreground">
                          {value || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </aside>

          {/* Right Content */}
          <div className="space-y-5">
            {/* Search & Filter Controls */}
            {totalOutfits > 1 && (
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

                  <Input
                    placeholder="Search by outfit name or type..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-card h-9 text-xs"
                  />
                </div>

                {allOutfitStatuses.length > 1 && (
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-auto bg-card px-3 text-xs">
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
                )}
              </div>
            )}

            {/* Empty State */}
            {filteredOrders.length === 0 && (
              <Card className="shadow-sm">
                <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-2">
                  <Shirt className="h-8 w-8 mx-auto text-muted-foreground/40" />

                  <p className="font-medium">No matching outfits found</p>

                  <p className="text-xs text-muted-foreground">
                    Try clearing search terms or selecting a different status
                    filter.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Orders List */}
            {filteredOrders.map((order: any) => {
              const orderBalance = order.estimatedAmount
                ? Math.max(0, Number(order.estimatedAmount) - order.totalPaid)
                : 0;

              return (
                <Card key={order.id} className="shadow-sm border">
                  <CardHeader className="bg-card border-b pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <CardTitle className="text-base font-bold">
                          Order #{order.orderNumber}
                        </CardTitle>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
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

                      <Badge
                        className={getStatusColor(order.status)}
                        variant="outline"
                      >
                        {formatStatus(order.status)}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-6">
                    {/* Outfits Grid */}
                    <div className="space-y-4">
                      {order.outfits.map((outfit: any) => {
                        const canApprove = APPROVAL_ALLOWED_STATUSES.includes(
                          outfit.status,
                        );

                        const progress = STATUS_PROGRESS[outfit.status] || 0;

                        const designRefs = (outfit.references || []).filter(
                          (ref: any) => ref.type !== "FABRIC",
                        );

                        const fabricRefs = (outfit.references || []).filter(
                          (ref: any) => ref.type === "FABRIC",
                        );

                        return (
                          <div
                            key={outfit.id}
                            className="rounded-lg border bg-card p-4 space-y-4 shadow-2xs"
                          >
                            {/* Outfit Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                                  <Shirt className="h-4 w-4" />
                                </div>

                                <div>
                                  <h4 className="font-semibold text-sm">
                                    {outfit.name}
                                  </h4>

                                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                    <span>{outfit.type}</span>

                                    {outfit.maggamRequired && (
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] px-1.5 py-0"
                                      >
                                        Maggam Work
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="mt-1 text-xs">
                                    {outfit.price || (outfit.addOns && outfit.addOns.length > 0) ? (
                                      (() => {
                                        const outfitPrice = Number(outfit.price) || 0;
                                        const addOnsTotal = (outfit.addOns || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
                                        const total = outfitPrice + addOnsTotal;
                                        return (
                                          <span className="font-semibold text-foreground">
                                            ₹{total.toLocaleString()}
                                            {addOnsTotal > 0 && outfitPrice > 0 && (
                                              <span className="font-normal text-muted-foreground ml-1 text-[10px]">
                                                (₹{outfitPrice.toLocaleString()} + ₹{addOnsTotal.toLocaleString()} add-ons)
                                              </span>
                                            )}
                                          </span>
                                        );
                                      })()
                                    ) : (
                                      <span className="italic text-amber-600">
                                        ⏳ Price to be confirmed
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <Badge className={getStatusColor(outfit.status)}>
                                {formatStatus(outfit.status)}
                              </Badge>
                            </div>

                            {/* Detailed Progress Bar */}
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Status:
                                  <strong className="text-foreground">
                                    {formatStatus(outfit.status)}
                                  </strong>
                                </span>

                                <span className="font-semibold font-mono">
                                  {progress}%
                                </span>
                              </div>

                              <Progress value={progress} className="h-2" />
                            </div>

                            {/* Garment Measurements */}
                            {outfit.garmentMeasurements &&
                              Object.values(
                                outfit.garmentMeasurements as Record<
                                  string,
                                  string
                                >,
                              ).some(Boolean) && (
                                <GarmentMeasurementsPanel
                                  measurements={outfit.garmentMeasurements}
                                  type={outfit.type}
                                />
                              )}

                            {/* Add-ons Display */}
                            {outfit.addOns && outfit.addOns.length > 0 && (
                              <div className="bg-blue-50 dark:bg-blue-950/20 p-2.5 rounded-md text-xs space-y-1.5">
                                <p className="font-medium text-blue-700 dark:text-blue-300">
                                  Add-ons (Sourced Items)
                                </p>
                                <ul className="space-y-1">
                                  {outfit.addOns.map((addOn: any) => (
                                    <li key={addOn.id} className="flex justify-between items-start gap-2">
                                      <div>
                                        <span className="font-medium">{addOn.name}</span>
                                        {addOn.notes && <span className="text-muted-foreground"> — {addOn.notes}</span>}
                                      </div>
                                      <span className="font-semibold text-nowrap">₹{Number(addOn.price).toLocaleString()}</span>
                                    </li>
                                  ))}
                                </ul>
                                {(() => {
                                  const addOnsTotal = outfit.addOns.reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
                                  return addOnsTotal > 0 ? (
                                    <div className="border-t border-blue-200 dark:border-blue-800 pt-1.5 flex justify-between font-semibold text-blue-700 dark:text-blue-300">
                                      <span>Add-ons Total</span>
                                      <span>₹{addOnsTotal.toLocaleString()}</span>
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            )}

                            {/* Design Reference Images */}
                            {designRefs.length > 0 && (
                              <div className="space-y-2 pt-2 border-t">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-muted-foreground">
                                    {canApprove
                                      ? "Design References (Requires Approval)"
                                      : "Confirmed References"}
                                  </span>

                                  {!canApprove && (
                                    <span className="text-[10px] text-muted-foreground bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
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
                              <div className="space-y-2 pt-2 border-t">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-muted-foreground">
                                    Customer Material
                                  </span>
                                </div>

                                <PortalReferences
                                  references={fabricRefs}
                                  token={params.token as string}
                                  outfitId={outfit.id}
                                  canApprove={false}
                                />
                              </div>
                            )}

                            {/* Upload Components */}
                            {canApprove && (
                              <div className="pt-2 border-t space-y-3">
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

            {/* Financial Summary Footer */}
                    {(order.totalPaid > 0 || order.estimatedAmount) && (
                      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900/50 p-3.5 border space-y-3 text-xs">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />

                          <span className="font-medium text-muted-foreground">
                            Payment Summary
                          </span>
                        </div>

                        {(() => {
                          // Compute live total from outfits (price + addOns) — more accurate than estimatedAmount
                          const liveTotal = (order.outfits || []).reduce((s: number, o: any) => {
                            const outfitPrice = Number(o.price) || 0;
                            const addOnsTotal = (o.addOns || []).reduce((as: number, a: any) => as + (Number(a.price) || 0), 0);
                            return s + outfitPrice + addOnsTotal;
                          }, 0);
                          const displayTotal = liveTotal > 0 ? liveTotal : Number(order.estimatedAmount) || 0;
                          const displayBalance = displayTotal > 0 ? Math.max(0, displayTotal - order.totalPaid) : 0;
                          return (
                            <div className="grid grid-cols-3 gap-2 text-center">
                              {displayTotal > 0 && (
                                <div>
                                  <p className="text-muted-foreground text-[10px]">Total</p>
                                  <p className="font-medium font-mono text-xs">₹{displayTotal.toLocaleString()}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-muted-foreground text-[10px]">Paid</p>
                                <p className="font-semibold text-green-600 font-mono text-xs">₹{order.totalPaid.toLocaleString()}</p>
                              </div>
                              {displayBalance > 0 && (
                                <div>
                                  <p className="text-muted-foreground text-[10px]">Balance</p>
                                  <p className="font-semibold text-destructive font-mono text-xs">₹{displayBalance.toLocaleString()}</p>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Individual payment records */}
                        {order.payments && order.payments.length > 0 && (
                          <div className="border-t pt-2 space-y-1.5">
                            {order.payments.map((p: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between"
                              >
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ============================================================
   PORTAL REFERENCES
============================================================ */

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

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {references.map((ref: any, index: number) => (
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
          />
        ))}
      </div>

      <ImageViewer
        images={references.map((r: any) => ({
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
============================================================ */

function PortalReferenceCard({
  reference,
  token,
  outfitId,
  canApprove,
  onImageClick,
}: {
  reference: any;
  token: string;
  outfitId: string;
  canApprove: boolean;
  onImageClick: () => void;
}) {
  const [feedback, setFeedback] = useState<"approved" | "rejected" | null>(
    reference.customerFeedback || null,
  );

  const [loading, setLoading] = useState(false);

  async function handleFeedback(action: "approved" | "rejected") {
    setLoading(true);

    try {
      const res = await fetch(`/api/portal/${token}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          referenceId: reference.id,
          outfitId,
          feedback: action,
        }),
      });

      if (res.ok) {
        setFeedback(action);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="group relative rounded-lg overflow-hidden border bg-background shadow-2xs flex flex-col">
      <div
        className="relative aspect-square cursor-pointer overflow-hidden"
        onClick={onImageClick}
      >
        <img
          src={reference.url}
          alt="Outfit Reference"
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-200"
        />

        {/* Reference type label */}
        <span
          className={`absolute top-1.5 left-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded shadow-sm ${
            reference.type === "FABRIC"
              ? "bg-indigo-600 text-white"
              : reference.type === "MAGGAM"
                ? "bg-amber-600 text-white"
                : "bg-slate-700 text-white"
          }`}
        >
          {reference.type === "FABRIC"
            ? "Customer Material"
            : reference.type === "MAGGAM"
              ? "Maggam"
              : "Pattern"}
        </span>

        {feedback && (
          <div
            className={`absolute top-1.5 right-1.5 rounded-full p-1 shadow-md ${
              feedback === "approved" ? "bg-green-600" : "bg-destructive"
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
            <ThumbsUp className="h-3 w-3" />
            Approve
          </button>

          <button
            className="bg-card hover:bg-red-50 text-destructive py-1.5 font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
            onClick={() => handleFeedback("rejected")}
            disabled={loading}
          >
            <ThumbsDown className="h-3 w-3" />
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
          className={`py-1 text-center text-[10px] font-semibold text-white ${
            feedback === "approved" ? "bg-green-600" : "bg-destructive"
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
============================================================ */

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
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

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
          video: {
            facingMode: "environment",
          },
          audio: false,
        });

        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }
      } catch {
        setError(
          "Camera access was blocked or unavailable. Please use Upload instead.",
        );
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
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

        const file = new File([blob], `camera-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        onCapture(file);
        onClose();
      },
      "image/jpeg",
      0.9,
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-3 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
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
============================================================ */

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
    {
      value: "PATTERN" as const,
      label: "Pattern",
      icon: "✨",
    },

    ...(maggamRequired
      ? [
          {
            value: "MAGGAM" as const,
            label: "Maggam",
            icon: "🪡",
          },
        ]
      : []),

    {
      value: "FABRIC" as const,
      label: "My Fabric",
      icon: "🧵",
    },
  ];
  const [uploading, setUploading] = useState(false);

  const [uploaded, setUploaded] = useState<{ url: string; type: string }[]>([]);

  const [cameraOpen, setCameraOpen] = useState(false);

  const [selectedType, setSelectedType] = useState<
    "PATTERN" | "MAGGAM" | "FABRIC"
  >("PATTERN");

  async function handleUpload(files: FileList | File | null) {
    if (!files) return;

    setUploading(true);

    const imageFiles = files instanceof File ? [files] : Array.from(files);

    for (const file of imageFiles) {
      try {
        const formData = new FormData();

        formData.append("file", file);
        formData.append("outfitId", outfitId);
        formData.append("type", selectedType);

        const res = await fetch(`/api/portal/${token}/upload`, {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();

          setUploaded((prev) => [
            ...prev,
            {
              url: data.url,
              type: selectedType,
            },
          ]);
        }
      } catch {
        // Handle upload errors per file
      }
    }

    setUploading(false);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Share Your References
      </p>

      {/* Type selector pills */}
      <div className="flex flex-wrap gap-1.5">
        {UPLOAD_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setSelectedType(t.value)}
            className={`inline-flex items-center justify-center gap-1 rounded-full border px-2 py-1 text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              selectedType === t.value
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Uploaded previews */}
      {uploaded.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {uploaded.map((item, i) => (
            <div
              key={i}
              className="relative h-12 w-12 rounded border overflow-hidden shrink-0"
            >
              <img
                src={item.url}
                alt="Uploaded reference"
                className="object-cover w-full h-full"
              />

              <div className="absolute top-0.5 right-0.5 bg-green-500 rounded-full p-0.5">
                <Check className="h-2 w-2 text-white" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
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
============================================================ */

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
    <div className="pt-2 border-t">
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
          {open
            ? "Hide"
            : `Show ${filled.length} field${filled.length !== 1 ? "s" : ""}`}
        </span>
      </button>

      {open && (
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
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
