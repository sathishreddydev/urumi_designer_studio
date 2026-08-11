"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Copy, CreditCard, Shirt, UserCircle } from "lucide-react";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { LoadingButton } from "@/components/ui/loading-button";

const OUTFIT_TYPES = [
  "Bridal Blouse", "Reception Blouse", "Lehenga", "Gown",
  "Kurta", "Saree Blouse", "Anarkali", "Sharara", "Other",
];

export default function OrderDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const { can, isAdmin } = usePermissions();
  const [showAddOutfit, setShowAddOutfit] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);

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

  if (isLoading) {
    return <div className="h-8 w-64 animate-pulse rounded bg-muted" />;
  }

  if (!order) return <p>Order not found</p>;

  const totalPaid = (order.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
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
        {can("update", "order") && (
          <div className="flex gap-2">
            <Link href={`/dashboard/orders/${params.id}/invoice`}>
              <Button variant="outline" size="sm">Invoice</Button>
            </Link>
            <Link href={`/dashboard/orders/${params.id}/edit`}>
              <Button variant="outline" size="sm">Edit</Button>
            </Link>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Estimated</p>
              <p className="text-base font-bold">
                {order.estimatedAmount ? `₹${Number(order.estimatedAmount).toLocaleString()}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Advance</p>
              <p className="text-base font-bold text-blue-600">
                {order.advanceAmount ? `₹${Number(order.advanceAmount).toLocaleString()}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-base font-bold text-green-600">₹{totalPaid.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className={`text-base font-bold ${
                order.estimatedAmount && (Number(order.estimatedAmount) - totalPaid) > 0
                  ? "text-red-600" : "text-green-600"
              }`}>
                {order.estimatedAmount
                  ? `₹${Math.max(0, Number(order.estimatedAmount) - totalPaid).toLocaleString()}`
                  : "—"}
              </p>
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

                  {/* Admin assignment controls */}
                  {isAdmin && (
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
            {can("create", "payment") && (
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
    </div>
  );
}
