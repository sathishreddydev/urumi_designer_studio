"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, CreditCard, Shirt, UserCircle, Trash2, ImageIcon } from "lucide-react";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/hooks/use-toast";
import { ImageViewer } from "@/components/image-viewer";

const OUTFIT_TYPES = [
  "Bridal Blouse", "Reception Blouse", "Lehenga", "Gown",
  "Kurta", "Saree Blouse", "Anarkali", "Sharara", "Other",
];

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can, isAdmin } = usePermissions();
  const [showAddOutfit, setShowAddOutfit] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewerImages, setViewerImages] = useState<any[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Fetch staff for assignment
  const { data: staff } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  const designers = (staff || []).filter((u: any) => u.role === "DESIGNER");
  const masters = (staff || []).filter((u: any) => u.role === "MASTER");

  // Add outfit mutation
  const addOutfitMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, orderId: params.id }),
      });
      if (!res.ok) throw new Error("Failed to add outfit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", params.id] });
      setShowAddOutfit(false);
    },
  });

  // Assign designer/master
  const assignMutation = useMutation({
    mutationFn: async ({ outfitId, designerId, masterId }: { outfitId: string; designerId?: string; masterId?: string }) => {
      const res = await fetch(`/api/outfits/${outfitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designerId, masterId }),
      });
      if (!res.ok) throw new Error("Failed to assign");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", params.id] });
    },
  });

  // Add payment
  const addPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, orderId: params.id }),
      });
      if (!res.ok) throw new Error("Failed to add payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", params.id] });
      setShowAddPayment(false);
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orders/${params.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Order and all related data deleted." });
      router.push("/dashboard/orders");
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Delete failed", description: error.message });
    },
  });

  if (isLoading) {
    return <div className="h-8 w-64 animate-pulse rounded bg-muted" />;
  }

  if (!order) return <p>Order not found</p>;

  const totalPaid = (order.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const orderTotal = (order.outfits || []).reduce((s: number, o: any) => s + (Number(o.price) || 0), 0);
  const isCompleted = order.status === "Completed";
  const portalUrl = order.portalToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${order.portalToken}`
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/customers/${order.customer?.id || ""}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold lg:text-2xl">{order.orderNumber}</h1>
            <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {order.customer?.name} · {order.customer?.mobile}
          </p>
        </div>
        {can("update", "order") && !isCompleted && (
          <div className="flex gap-2">
            <Link href={`/dashboard/orders/${params.id}/invoice`}>
              <Button variant="outline" size="sm">Invoice</Button>
            </Link>
            <Link href={`/dashboard/orders/${params.id}/edit`}>
              <Button variant="outline" size="sm">Edit</Button>
            </Link>
            {can("delete", "order") && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-3 w-3" /> Delete
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <Card><CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground">Order Date</p>
          <p className="text-sm font-medium">{formatDate(order.orderDate)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground">Trial Date</p>
          <p className="text-sm font-medium">{formatDate(order.trialDate)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground">Delivery Date</p>
          <p className="text-sm font-medium">{formatDate(order.deliveryDate)}</p>
        </CardContent></Card>
      </div>

      {/* Payment Summary */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Estimated</p>
              <p className="text-base font-bold">
                {order.estimatedAmount ? `₹${Number(order.estimatedAmount).toLocaleString()}` : (orderTotal > 0 ? `₹${orderTotal.toLocaleString()}` : "—")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-base font-bold text-green-600">₹{totalPaid.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Balance</p>
              {(() => {
                const estimated = Number(order.estimatedAmount) || orderTotal;
                const bal = estimated - totalPaid;
                return (
                  <p className={`text-base font-bold ${bal > 0 ? "text-red-600" : "text-green-600"}`}>
                    {estimated > 0 ? `₹${Math.max(0, bal).toLocaleString()}` : "—"}
                  </p>
                );
              })()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="outfits">
        <TabsList>
          <TabsTrigger value="outfits">Outfits ({(order.outfits || []).length})</TabsTrigger>
          {can("read", "payment") && (
            <TabsTrigger value="payments">Payments ({(order.payments || []).length})</TabsTrigger>
          )}
        </TabsList>

        {/* Outfits Tab */}
        <TabsContent value="outfits" className="space-y-3 mt-4">
          {/* Outfits List */}
          {(order.outfits || []).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No outfits added yet
              </CardContent>
            </Card>
          ) : (
            (order.outfits || []).map((outfit: any) => (
              <Card key={outfit.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/dashboard/outfits/${outfit.id}`} className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Shirt className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="font-medium truncate">{outfit.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground ml-6">
                        {outfit.type}{outfit.maggamRequired && " · Maggam"}
                      </p>
                    </Link>
                    <Badge className={getStatusColor(outfit.status)}>
                      {formatStatus(outfit.status)}
                    </Badge>
                  </div>

                  {/* Fabric Images Thumbnails */}
                  {(() => {
                    const fabricRefs = (outfit.references || []).filter((r: any) => r.type === "FABRIC");
                    if (fabricRefs.length === 0) return null;
                    return (
                      <div className="mt-2 ml-6">
                        <p className="text-[10px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" /> Customer Material ({fabricRefs.length})
                        </p>
                        <div className="flex gap-1.5 flex-wrap">
                          {fabricRefs.map((ref: any, idx: number) => (
                            <div
                              key={ref.id}
                              className="h-10 w-10 rounded border overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                              onClick={(e) => {
                                e.preventDefault();
                                setViewerImages(fabricRefs.map((r: any) => ({ id: r.id, url: r.url, filename: r.filename, status: r.status })));
                                setViewerIndex(idx);
                                setViewerOpen(true);
                              }}
                            >
                              <img src={ref.url} alt="Fabric" className="h-full w-full object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Admin assignment controls */}
                  {isAdmin && !isCompleted && (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center border-t pt-3">
                      <div className="flex items-center gap-2 flex-1">
                        <UserCircle className="h-3 w-3 text-muted-foreground" />
                        <select
                          className="h-7 rounded border border-input bg-background px-2 text-xs flex-1"
                          value={outfit.designerId || ""}
                          onChange={(e) =>
                            assignMutation.mutate({ outfitId: outfit.id, designerId: e.target.value || undefined })
                          }
                        >
                          <option value="">No Designer</option>
                          {designers.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <UserCircle className="h-3 w-3 text-muted-foreground" />
                        <select
                          className="h-7 rounded border border-input bg-background px-2 text-xs flex-1"
                          value={outfit.masterId || ""}
                          onChange={(e) =>
                            assignMutation.mutate({ outfitId: outfit.id, masterId: e.target.value || undefined })
                          }
                        >
                          <option value="">No Master</option>
                          {masters.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Payments Tab */}
        {can("read", "payment") && (
          <TabsContent value="payments" className="space-y-3 mt-4">
            {!isCompleted && can("create", "payment") && (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setShowAddPayment(!showAddPayment)}>
                  <CreditCard className="h-3 w-3" /> Add Payment
                </Button>
              </div>
            )}

            {showAddPayment && (
              <Card>
                <CardContent className="pt-4 pb-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      addPaymentMutation.mutate({
                        amount: Number(form.get("amount")),
                        method: form.get("method"),
                        notes: form.get("notes"),
                      });
                    }}
                    className="flex flex-col gap-3 sm:flex-row sm:items-end"
                  >
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs">Amount (₹)</Label>
                      <Input name="amount" type="number" placeholder="5000" className="h-9" required />
                    </div>
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs">Method</Label>
                      <select name="method" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" required>
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="CARD">Card</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                      </select>
                    </div>
                    <Input name="notes" placeholder="Notes" className="h-9 flex-1" />
                    <LoadingButton size="sm" type="submit" loading={addPaymentMutation.isPending} loadingText="Saving...">
                      Record
                    </LoadingButton>
                  </form>
                </CardContent>
              </Card>
            )}

            {(order.payments || []).length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  No payments recorded
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-2">
                    {(order.payments || []).map((payment: any) => (
                      <div key={payment.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium">{payment.method}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(payment.createdAt)}</p>
                        </div>
                        <p className="font-semibold">₹{Number(payment.amount).toLocaleString()}</p>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between font-semibold text-sm">
                      <span>Total</span>
                      <span>₹{totalPaid.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete order {order.orderNumber}? This will permanently remove
              all outfits, references, dependencies, and payments associated with this order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteOrderMutation.mutate()}
            >
              Delete Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Viewer */}
      <ImageViewer
        images={viewerImages}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}
