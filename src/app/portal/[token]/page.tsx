"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";
import { Scissors, Calendar, Package, CreditCard, Shirt, Upload, Check, ThumbsUp, ThumbsDown } from "lucide-react";

const statusProgress: Record<string, number> = {
  DRAFT: 5, DESIGN_IN_PROGRESS: 15, WAITING_FOR_REFERENCES: 20,
  WAITING_FOR_DEPENDENCIES: 25, PRODUCTION_READY: 30,
  PATTERN_DRAFTING: 40, MAGGAM_WORK: 50, FABRIC_CUTTING: 60,
  STITCHING: 70, PRODUCTION_COMPLETED: 80,
  TRIAL: 85, ALTERATION: 88, QC: 92,
  READY_FOR_DELIVERY: 95, DELIVERED: 100,
};

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
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Scissors className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Designer Studio</h1>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl space-y-6 p-4 py-8">
        {/* Customer greeting */}
        <div>
          <h2 className="text-2xl font-bold">Hello, {data.customer.name}!</h2>
          <p className="text-muted-foreground">Here's the progress of your outfits</p>
        </div>

        {/* Orders */}
        {data.orders.map((order: any) => (
          <Card key={order.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{order.orderNumber}</CardTitle>
                <Badge variant="secondary">{order.status}</Badge>
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
              {order.outfits.map((outfit: any) => (
                <div key={outfit.id} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Shirt className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{outfit.name}</p>
                        <p className="text-xs text-muted-foreground">{outfit.type}</p>
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
                      <span>{statusProgress[outfit.status] || 0}%</span>
                    </div>
                    <Progress value={statusProgress[outfit.status] || 0} className="h-2" />
                  </div>

                  {/* Locked references — with approve/reject */}
                  {outfit.references.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        Final References
                      </p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {outfit.references.map((ref: any) => (
                          <PortalReferenceCard
                            key={ref.id}
                            reference={ref}
                            token={params.token as string}
                            outfitId={outfit.id}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Customer upload inspiration */}
                  <PortalUpload outfitId={outfit.id} token={params.token as string} />
                </div>
              ))}

              {/* Payment summary */}
              {order.payments.length > 0 && (
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <CreditCard className="h-3.5 w-3.5" /> Payments
                    </span>
                    <span className="font-semibold">₹{order.totalPaid.toLocaleString()}</span>
                  </div>
                  {order.estimatedAmount && (
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Estimated: ₹{Number(order.estimatedAmount).toLocaleString()}</span>
                      <span>
                        Balance: ₹{Math.max(0, Number(order.estimatedAmount) - order.totalPaid).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
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
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">
          Upload Inspiration Images
        </p>
      </div>

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
}: {
  reference: any;
  token: string;
  outfitId: string;
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
      {/* Feedback overlay */}
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
      {/* Action buttons */}
      {!feedback && (
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
      {/* Feedback message */}
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
