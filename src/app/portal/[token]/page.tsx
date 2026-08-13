"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
  Filter,
} from "lucide-react";

const STATUS_ORDER = [
  "DRAFT", "DESIGN_IN_PROGRESS", "WAITING_FOR_REFERENCES",
  "WAITING_FOR_DEPENDENCIES", "PRODUCTION_READY",
  "PATTERN_DRAFTING", "MAGGAM_WORK", "MAGGAM_REVIEW", "FABRIC_CUTTING",
  "STITCHING", "PRODUCTION_COMPLETED",
  "TRIAL", "ALTERATION", "QC",
  "READY_FOR_DELIVERY", "DELIVERED",
];

const statusProgress: Record<string, number> = {
  DRAFT: 5, DESIGN_IN_PROGRESS: 12, WAITING_FOR_REFERENCES: 18,
  WAITING_FOR_DEPENDENCIES: 22, PRODUCTION_READY: 28,
  PATTERN_DRAFTING: 38, MAGGAM_WORK: 48, MAGGAM_REVIEW: 55, FABRIC_CUTTING: 62,
  STITCHING: 72, PRODUCTION_COMPLETED: 80,
  TRIAL: 85, ALTERATION: 88, QC: 92,
  READY_FOR_DELIVERY: 96, DELIVERED: 100,
};

// Before these statuses: customer can approve/reject references and upload images
const APPROVAL_ALLOWED_STATUSES = [
  "DRAFT", "DESIGN_IN_PROGRESS", "WAITING_FOR_REFERENCES", "WAITING_FOR_DEPENDENCIES",
];

export default function CustomerPortalPage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
        setError("Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [params.token]);

  // Realtime: SSE for live updates
  useEffect(() => {
    if (!data) return;

    let eventSource: EventSource | null = null;

    function refetchData() {
      fetch(`/api/portal/${params.token}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((newData) => { if (newData) setData(newData); });
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

  // Filter outfits across all orders
  const filteredOrders = useMemo(() => {
    if (!data?.orders) return [];

    return data.orders
      .map((order: any) => {
        let outfits = order.outfits || [];

        // Status filter
        if (statusFilter !== "all") {
          outfits = outfits.filter((o: any) => o.status === statusFilter);
        }

        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          outfits = outfits.filter(
            (o: any) =>
              o.name?.toLowerCase().includes(q) ||
              o.type?.toLowerCase().includes(q)
          );
        }

        return { ...order, outfits };
      })
      .filter((order: any) => order.outfits.length > 0);
  }, [data, searchQuery, statusFilter]);

  // Unique outfit statuses for filter
  const allOutfitStatuses = useMemo(() => {
    if (!data?.orders) return [];
    const statuses = new Set<string>();
    data.orders.forEach((order: any) =>
      (order.outfits || []).forEach((o: any) => statuses.add(o.status))
    );
    return STATUS_ORDER.filter((s) => statuses.has(s));
  }, [data]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="space-y-3 text-center">
          <Scissors className="h-8 w-8 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading your outfits...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <Scissors className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-destructive font-medium">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Please contact the studio for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalOutfits = data.orders.reduce((s: number, o: any) => s + (o.outfits?.length || 0), 0);
  const totalPaid = data.orders.reduce((s: number, o: any) => s + (o.totalPaid || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center gap-3 px-4 py-3 max-w-5xl">
          <Scissors className="h-5 w-5 text-primary" />
          <span className="font-bold text-sm">Designer Studio</span>
          <span className="text-xs text-muted-foreground ml-auto">Customer Portal</span>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl p-4 py-6">
        {/* Desktop: Side-by-side layout */}
        <div className="lg:grid lg:grid-cols-[320px_1fr] lg:gap-6">
          {/* Left Sidebar — Customer Info + Measurements (sticky on desktop) */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start mb-6 lg:mb-0">
            {/* Customer greeting */}
            <Card>
              <CardContent className="pt-5 pb-5">
                <h2 className="text-xl font-bold">Hello, {data.customer.name}!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Track the progress of your outfits
                </p>
                <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                  <div>
                    <p className="text-lg font-bold">{totalOutfits}</p>
                    <p className="text-[10px] text-muted-foreground">Outfits</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">₹{totalPaid.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Paid</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{data.orders.length}</p>
                    <p className="text-[10px] text-muted-foreground">Orders</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Measurements — read-only */}
            {data.measurements && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Ruler className="h-4 w-4" /> Your Measurements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {Object.entries(data.measurements as Record<string, string>).map(
                      ([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-muted-foreground text-xs">{key}</span>
                          <span className="font-medium text-xs">{value || "—"}</span>
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Content — Orders & Outfits */}
          <div className="space-y-4">
            {/* Search & Filter */}
            {totalOutfits > 1 && (
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search outfits..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 bg-card"
                  />
                </div>
                {allOutfitStatuses.length > 1 && (
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-9 rounded-md border border-input bg-card px-3 text-sm"
                  >
                    <option value="all">All Status</option>
                    {allOutfitStatuses.map((status) => (
                      <option key={status} value={status}>{formatStatus(status)}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* No results */}
            {filteredOrders.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  {searchQuery || statusFilter !== "all"
                    ? "No outfits matching your search"
                    : "No outfits yet. Check back soon!"}
                </CardContent>
              </Card>
            )}

            {/* Orders */}
            {filteredOrders.map((order: any) => {
              const orderBalance = order.estimatedAmount
                ? Math.max(0, Number(order.estimatedAmount) - order.totalPaid)
                : 0;

              return (
                <Card key={order.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{order.orderNumber}</CardTitle>
                      <Badge className={getStatusColor(order.status)} variant="secondary">
                        {order.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {order.trialDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Trial: {formatDate(order.trialDate)}
                        </span>
                      )}
                      {order.deliveryDate && (
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" /> Delivery: {formatDate(order.deliveryDate)}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Outfits */}
                    {order.outfits.map((outfit: any) => {
                      const canApprove = APPROVAL_ALLOWED_STATUSES.includes(outfit.status);
                      const progress = statusProgress[outfit.status] || 0;

                      return (
                        <div key={outfit.id} className="rounded-lg border p-3 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Shirt className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">{outfit.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {outfit.type}
                                  {outfit.maggamRequired && " · Maggam"}
                                </p>
                              </div>
                            </div>
                            <Badge className={getStatusColor(outfit.status)}>
                              {formatStatus(outfit.status)}
                            </Badge>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Progress</span>
                              <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>

                          {progress > 0 && progress < 100 && (
                            <p className="text-[11px] text-muted-foreground">
                              Current: <span className="font-medium text-foreground">{formatStatus(outfit.status)}</span>
                            </p>
                          )}
                          {progress === 100 && (
                            <p className="text-[11px] text-green-600 font-medium">✓ Delivered</p>
                          )}

                          {/* References with zoom */}
                          {outfit.references.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                                {canApprove ? "Review & Approve References" : "Final References"}
                              </p>
                              <PortalReferences
                                references={outfit.references}
                                token={params.token as string}
                                outfitId={outfit.id}
                                canApprove={canApprove}
                              />
                              {!canApprove && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  References are locked — production has started.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Customer upload — only before production */}
                          {canApprove && (
                            <PortalUpload outfitId={outfit.id} token={params.token as string} />
                          )}
                        </div>
                      );
                    })}

                    {/* Payment summary */}
                    {(order.totalPaid > 0 || order.estimatedAmount) && (
                      <div className="border-t pt-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <CreditCard className="h-3.5 w-3.5" /> Payments
                          </span>
                          <span className="font-semibold text-green-600">
                            ₹{order.totalPaid.toLocaleString()}
                          </span>
                        </div>
                        {order.estimatedAmount && (
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>Estimated: ₹{Number(order.estimatedAmount).toLocaleString()}</span>
                            {orderBalance > 0 && (
                              <span className="text-red-600 font-medium">
                                Balance: ₹{orderBalance.toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground py-4">
              <p>Questions? Contact the studio directly.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── PORTAL REFERENCES WITH ZOOM ────────────────────────────────────────────

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
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
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

      {/* Full-screen image viewer with zoom */}
      <ImageViewer
        images={references.map((r: any) => ({ id: r.id, url: r.url, filename: r.filename }))}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}

// ─── PORTAL UPLOAD COMPONENT ────────────────────────────────────────────────

function PortalUpload({ outfitId, token }: { outfitId: string; token: string }) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string[]>([]);

  async function handleUpload(files: FileList | null) {
    if (!files) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("outfitId", outfitId);
        formData.append("type", "PATTERN");

        const res = await fetch(`/api/portal/${token}/upload`, {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setUploaded((prev) => [...prev, data.url]);
        }
      } catch {
        // Ignore individual upload errors
      }
    }

    setUploading(false);
  }

  return (
    <div className="border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Upload Inspiration Images
      </p>

      {uploaded.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {uploaded.map((url, i) => (
            <div key={i} className="relative">
              <img src={url} alt="" className="aspect-square rounded object-cover" />
              <div className="absolute top-0.5 right-0.5 bg-green-500 rounded-full p-0.5">
                <Check className="h-2.5 w-2.5 text-white" />
              </div>
            </div>
          ))}
        </div>
      )}

      <label>
        <Button size="sm" variant="outline" className="w-full" disabled={uploading} asChild>
          <span>
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Uploading..." : "Choose Images"}
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
      <p className="text-[10px] text-muted-foreground mt-1 text-center">
        Share your inspiration photos. Our designer will review them.
      </p>
    </div>
  );
}

// ─── PORTAL REFERENCE CARD ──────────────────────────────────────────────────

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
    reference.customerFeedback || null
  );
  const [loading, setLoading] = useState(false);

  async function handleFeedback(action: "approved" | "rejected") {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/${token}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId: reference.id, outfitId, feedback: action }),
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
    <div className="relative rounded-lg overflow-hidden border">
      <img
        src={reference.url}
        alt="Reference"
        className="aspect-square w-full object-cover cursor-pointer"
        onClick={onImageClick}
      />

      {/* Feedback indicator */}
      {feedback && (
        <div className={`absolute top-1 right-1 rounded-full p-1 ${
          feedback === "approved" ? "bg-green-500" : "bg-red-500"
        }`}>
          {feedback === "approved" ? (
            <ThumbsUp className="h-2.5 w-2.5 text-white" />
          ) : (
            <ThumbsDown className="h-2.5 w-2.5 text-white" />
          )}
        </div>
      )}

      {/* Action buttons — only before production and no feedback yet */}
      {canApprove && !feedback && (
        <div className="absolute bottom-0 left-0 right-0 flex">
          <button
            className="flex-1 bg-green-600/90 text-white py-1.5 flex items-center justify-center gap-1 text-[10px] font-medium hover:bg-green-700 disabled:opacity-50"
            onClick={(e) => { e.stopPropagation(); handleFeedback("approved"); }}
            disabled={loading}
          >
            <ThumbsUp className="h-3 w-3" /> Approve
          </button>
          <button
            className="flex-1 bg-red-600/90 text-white py-1.5 flex items-center justify-center gap-1 text-[10px] font-medium hover:bg-red-700 disabled:opacity-50"
            onClick={(e) => { e.stopPropagation(); handleFeedback("rejected"); }}
            disabled={loading}
          >
            <ThumbsDown className="h-3 w-3" /> Reject
          </button>
        </div>
      )}

      {/* Feedback label */}
      {feedback && (
        <div className={`absolute bottom-0 left-0 right-0 py-1 text-center text-[10px] font-medium text-white ${
          feedback === "approved" ? "bg-green-600/90" : "bg-red-600/90"
        }`}>
          {feedback === "approved" ? "✓ Approved" : "✗ Rejected"}
        </div>
      )}
    </div>
  );
}
