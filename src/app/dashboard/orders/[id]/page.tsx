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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [paymentAmountError, setPaymentAmountError] = useState("");

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
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add payment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", params.id] });
      setShowAddPayment(false);
      toast({ title: "Payment recorded", description: "Payment has been saved." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Failed", description: err.message });
    },
  });

  // Delete payment
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await fetch(`/api/payments/${paymentId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to void payment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", params.id] });
      toast({ title: "Payment voided" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Failed", description: err.message });
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

  const totalPaid = (order.payments || [])
    .filter((p: any) => p.status === "SETTLED" || !p.status) // legacy rows without status count as settled
    .reduce((s: number, p: any) => s + Number(p.amount), 0);
  const orderTotal = (order.outfits || []).reduce((s: number, o: any) => s + (Number(o.price) || 0), 0);
  const missingPriceOutfits = (order.outfits || []).filter(
    (outfit: any) => outfit.price === null || outfit.price === undefined || String(outfit.price).trim() === "",
  );
  const isCompleted = order.status === "Completed";
  const portalUrl = order.portalToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${order.portalToken}`
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-2 sm:gap-3">
        <Link href={order.customer?.id ? `/dashboard/customers/${order.customer.id}` : "/dashboard/orders"}>
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 sm:h-10 sm:w-10"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold lg:text-2xl truncate">{order.orderNumber}</h1>
            <Badge className={`${getStatusColor(order.status)} shrink-0`}>{order.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {order.customer?.name} · {order.customer?.mobile}
          </p>
          {portalUrl && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Portal: <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">{portalUrl}</a>
            </p>
          )}
        </div>
        {can("update", "order") && !isCompleted && (
          <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 px-2"
              onClick={() => {
                if (missingPriceOutfits.length > 0) {
                  toast({
                    variant: "destructive",
                    title: "Cannot open invoice",
                    description: `Add prices for: ${missingPriceOutfits.map((outfit: any) => outfit.name).join(", ")}.`,
                  });
                  return;
                }
                router.push(`/dashboard/orders/${params.id}/invoice`);
              }}
            >
              <span className="hidden sm:inline">Invoice</span>
              <span className="sm:hidden">Inv</span>
            </Button>
            <Link href={`/dashboard/orders/${params.id}/edit`}>
              <Button variant="outline" size="sm" className="text-xs h-8 px-2">Edit</Button>
            </Link>
            {can("delete", "order") && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs h-8 px-2"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
        <div className="rounded-lg border bg-card px-3 py-2.5">
          <p className="text-[10px] text-muted-foreground">Order Date</p>
          <p className="text-sm font-medium">{formatDate(order.orderDate)}</p>
        </div>
        <div className="rounded-lg border bg-card px-3 py-2.5">
          <p className="text-[10px] text-muted-foreground">Trial Date</p>
          <p className="text-sm font-medium">{formatDate(order.trialDate)}</p>
        </div>
        <div className="rounded-lg border bg-card px-3 py-2.5 col-span-2 sm:col-span-1">
          <p className="text-[10px] text-muted-foreground">Delivery Date</p>
          <p className="text-sm font-medium">{formatDate(order.deliveryDate)}</p>
        </div>
      </div>

      {/* Payment Summary */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Estimated</p>
              <p className="text-sm font-bold sm:text-base">
                {order.estimatedAmount ? `₹${Number(order.estimatedAmount).toLocaleString()}` : (orderTotal > 0 ? `₹${orderTotal.toLocaleString()}` : "—")}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Paid</p>
              <p className="text-sm font-bold text-green-600 sm:text-base">₹{totalPaid.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Balance</p>
              {(() => {
                const estimated = Number(order.estimatedAmount) || orderTotal;
                const bal = estimated - totalPaid;
                if (estimated <= 0) return <p className="text-sm font-bold sm:text-base">—</p>;
                if (bal < 0) {
                  return (
                    <p className="text-sm font-bold text-amber-600 sm:text-base">
                      ₹{Math.abs(bal).toLocaleString()} over
                    </p>
                  );
                }
                return (
                  <p className={`text-sm font-bold sm:text-base ${bal > 0 ? "text-red-600" : "text-green-600"}`}>
                    ₹{bal.toLocaleString()}
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
          {/* Add Outfit Button */}
          {!isCompleted && can("create", "outfit") && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowAddOutfit(!showAddOutfit)}>
                <Shirt className="h-3 w-3" /> Add Outfit
              </Button>
            </div>
          )}

          {/* Add Outfit Form */}
          {showAddOutfit && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    addOutfitMutation.mutate({
                      name: form.get("name"),
                      type: form.get("type"),
                      maggamRequired: form.get("maggamRequired") === "on",
                    });
                  }}
                  className="flex flex-col gap-3 sm:flex-row sm:items-end"
                >
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Outfit Name</Label>
                    <Input name="name" placeholder="e.g. Bridal Blouse" className="h-9" required />
                  </div>
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Type</Label>
                    <Select name="type" required>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {OUTFIT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" name="maggamRequired" id="maggamRequired" className="h-4 w-4" />
                    <Label htmlFor="maggamRequired" className="text-xs">Maggam</Label>
                  </div>
                  <LoadingButton size="sm" type="submit" loading={addOutfitMutation.isPending} loadingText="Adding...">
                    Add
                  </LoadingButton>
                </form>
              </CardContent>
            </Card>
          )}

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
                  {/* Outfit name + badge — stacked on mobile */}
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/dashboard/outfits/${outfit.id}`} className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Shirt className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="font-medium truncate">{outfit.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground ml-6">
                        {outfit.type}{outfit.maggamRequired && " · Maggam"}
                      </p>
                      <p className="text-xs ml-6 mt-0.5">
                        {outfit.price
                          ? <span className="font-medium text-foreground">₹{Number(outfit.price).toLocaleString()}</span>
                          : <span className="italic text-amber-600">⏳ Price not set yet</span>
                        }
                      </p>
                    </Link>
                    <Badge className={`${getStatusColor(outfit.status)} text-[10px] shrink-0 max-w-[130px] truncate`}>
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
                        <Select
                          value={outfit.designerId || "none"}
                          onValueChange={(value) =>
                            assignMutation.mutate({ outfitId: outfit.id, designerId: value === "none" ? undefined : value })
                          }
                        >
                          <SelectTrigger className="h-7 flex-1 rounded px-2 text-xs">
                            <SelectValue placeholder="No Designer" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Designer</SelectItem>
                            {designers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <UserCircle className="h-3 w-3 text-muted-foreground" />
                        <Select
                          value={outfit.masterId || "none"}
                          onValueChange={(value) =>
                            assignMutation.mutate({ outfitId: outfit.id, masterId: value === "none" ? undefined : value })
                          }
                        >
                          <SelectTrigger className="h-7 flex-1 rounded px-2 text-xs">
                            <SelectValue placeholder="No Master" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Master</SelectItem>
                            {masters.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
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
                      const amount = Number(form.get("amount"));
                      const knownOrderTotal = orderTotal > 0
                        ? orderTotal
                        : Number(order.estimatedAmount) || 0;
                      const balance = knownOrderTotal > 0 ? knownOrderTotal - totalPaid : null;
                      if (!Number.isFinite(amount) || amount <= 0) {
                        setPaymentAmountError("Enter an amount greater than ₹0.");
                        return;
                      }
                      if (balance !== null && amount > balance) {
                        setPaymentAmountError(`Maximum allowed: ₹${Math.max(0, balance).toLocaleString()}.`);
                        return;
                      }
                      setPaymentAmountError("");
                      addPaymentMutation.mutate({
                          amount,
                          method: form.get("method"),
                          notes: form.get("notes"),
                          outfitId: form.get("outfitId") === "none" ? undefined : form.get("outfitId"),
                          transactionRef: form.get("transactionRef") || undefined,
                      });
                    }}
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Apply To Outfit</Label>
                        <Select name="outfitId" defaultValue="none">
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Whole Order" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Whole Order</SelectItem>
                          {(order.outfits || []).map((o: any) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.name} - {o.price != null ? `₹${Number(o.price).toLocaleString()}` : "Price not set"}
                            </SelectItem>
                          ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Amount (₹)</Label>
                        <div>
                          <Input
                            name="amount"
                            type="number"
                            placeholder="5000"
                            min="1"
                            step="1"
                            className={paymentAmountError ? "h-9 border-destructive focus-visible:ring-destructive" : "h-9"}
                            onChange={() => paymentAmountError && setPaymentAmountError("")}
                            required
                          />
                          {paymentAmountError && (
                            <p className="mt-1 text-right text-[11px] text-destructive" role="alert">
                              {paymentAmountError}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Method</Label>
                        <Select name="method" required defaultValue="CASH">
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CASH">Cash</SelectItem>
                            <SelectItem value="UPI">UPI</SelectItem>
                            <SelectItem value="CARD">Card</SelectItem>
                            <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Transaction / Ref</Label>
                        <Input name="transactionRef" placeholder="Txn ref / UPI ID" className="h-9" />
                      </div>
                    </div>
                    <Input name="notes" placeholder="Notes (optional)" className="h-9" />
                    <LoadingButton size="sm" type="submit" loading={addPaymentMutation.isPending} loadingText="Saving..." className="w-full sm:w-auto">
                      Record Payment
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
                      <div key={payment.id} className="flex items-start justify-between gap-3 text-sm py-1">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{payment.method}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(payment.createdAt)}</p>
                          {payment.transactionRef && (
                            <p className="text-xs text-muted-foreground truncate">Ref: {payment.transactionRef}</p>
                          )}
                          {payment.outfitId && (
                            <p className="text-xs text-muted-foreground truncate">
                              For: {(order.outfits || []).find((o: any) => o.id === payment.outfitId)?.name || "Outfit"}
                            </p>
                          )}
                          {payment.notes && (
                            <p className="text-xs text-muted-foreground truncate">{payment.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="font-semibold whitespace-nowrap">₹{Number(payment.amount).toLocaleString()}</p>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:bg-destructive/10"
                              onClick={() => deletePaymentMutation.mutate(payment.id)}
                              disabled={deletePaymentMutation.isPending}
                              title="Void payment"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between font-semibold text-sm">
                      <span>Total Paid</span>
                      <span>₹{totalPaid.toLocaleString()}</span>
                    </div>
                    {(() => {
                      const estimated = Number(order.estimatedAmount) || orderTotal;
                      if (estimated > 0 && totalPaid > estimated) {
                        return (
                          <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                            ⚠ Overpaid by ₹{(totalPaid - estimated).toLocaleString()}
                          </p>
                        );
                      }
                      return null;
                    })()}
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
