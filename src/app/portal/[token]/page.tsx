"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  IndianRupee,
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

// Statuses where references can still be approved/rejected by customer
const APPROVAL_ALLOWED_STATUSES = [
  "DRAFT", "DESIGN_IN_PROGRESS", "WAITING_FOR_REFERENCES", "WAITING_FOR_DEPENDENCIES",
];

export default function CustomerPortalPage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center gap-3 px-4 py-3">
          <Scissors className="h-5 w-5 text-primary" />
          <span className="font-bold text-sm">Designer Studio</span>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl space-y-6 p-4 py-6">
        {/* Customer greeting */}
        <div>
          <h2 className="text-2xl font-bold">Hello, {data.customer.name}!</h2>
          <p className="text-sm text-muted-foreground">Track the progress of your outfits below</p>
        </div>

        {/* Measurements Card */}
        {data.measurements && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Ruler className="h-4 w-4" /> Your Measurements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {Object.entries(data.measurements as Record<string, string>).map(
                  ([key, value]) => (
                    <div key={key}>
                      <p className="text-[11px] text-muted-foreground">{key}</p>
                      <p className="text-sm font-medium">{value || "—"}</p>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Orders */}
        {data.orders.map((order: any) => {
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

                      {/* Status timeline (simplified) */}
                      {progress > 0 && progress < 100 && (
                        <p className="text-[11px] text-muted-foreground">
                          Current stage: <span className="font-medium text-foreground">{formatStatus(outfit.status)}</span>
                        </p>
                      )}
                      {progress === 100 && (
                        <p className="text-[11px] text-green-600 font-medium">
                          ✓ Delivered
                        </p>
                      )}

                      {/* Locked references — with approve/reject only before production */}
                      {outfit.references.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">
                            {canApprove ? "Review & Approve References" : "Final References"}
                          </p>
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {outfit.references.map((ref: any) => (
                              <PortalReferenceCard
                                key={ref.id}
                                reference={ref}
                                token={params.token as string}
                                outfitId={outfit.id}
                                canApprove={canApprove}
                              />
                            ))}
                          </div>
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
      </main>
    </div>
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

      {/* Uploaded thumbnails */}
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

      {/* Upload button */}
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

// ─── PORTAL REFERENCE CARD — APPROVE/REJECT ─────────────────────────────────

function PortalReferenceCard({
  reference,
  token,
  outfitId,
  canApprove,
}: {
  reference: any;
  token: string;
  outfitId: string;
  canApprove: boolean;
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
        className="aspect-square w-full object-cover"
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
      {/* Action buttons — only if approval is allowed and no feedback yet */}
      {canApprove && !feedback && (
        <div className="absolute bottom-0 left-0 right-0 flex">
          <button
            className="flex-1 bg-green-600/90 text-white py-1.5 flex items-center justify-center gap-1 text-[10px] font-medium hover:bg-green-700 disabled:opacity-50"
            onClick={() => handleFeedback("approved")}
            disabled={loading}
          >
            <ThumbsUp className="h-3 w-3" /> Approve
          </button>
          <button
            className="flex-1 bg-red-600/90 text-white py-1.5 flex items-center justify-center gap-1 text-[10px] font-medium hover:bg-red-700 disabled:opacity-50"
            onClick={() => handleFeedback("rejected")}
            disabled={loading}
          >
            <ThumbsDown className="h-3 w-3" /> Reject
          </button>
        </div>
      )}
      {/* Feedback status label */}
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
