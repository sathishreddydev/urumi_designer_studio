"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Shirt } from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/hooks/use-permissions";

const OUTFIT_TYPES = [
  "Bridal Blouse", "Reception Blouse", "Lehenga", "Gown",
  "Kurta", "Saree Blouse", "Anarkali", "Sharara", "Other",
];

interface OutfitEntry {
  name: string;
  type: string;
  occasion: string;
  price: string;
  maggamRequired: boolean;
  designerId: string;
}

export default function NewOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get("customerId") || "";
  const queryClient = useQueryClient();
  const { isAdmin } = usePermissions();

  const [customerId, setCustomerId] = useState(preselectedCustomerId);
  const [trialDate, setTrialDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [outfits, setOutfits] = useState<OutfitEntry[]>([
    { name: "", type: "", occasion: "", price: "", maggamRequired: false, designerId: "" },
  ]);

  const { data: customers } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const res = await fetch("/api/customers?limit=100");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

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
  const selectedCustomer = customers?.customers?.find((c: any) => c.id === customerId);

  const createMutation = useMutation({
    mutationFn: async () => {
      const validOutfits = outfits.filter((o) => o.name && o.type);
      // Auto-calculate estimated total from outfit prices
      const calculatedTotal = validOutfits.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
      const finalEstimated = estimatedAmount ? Number(estimatedAmount) : (calculatedTotal > 0 ? calculatedTotal : undefined);

      // 1. Create order
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          trialDate: trialDate || undefined,
          deliveryDate: deliveryDate || undefined,
          estimatedAmount: finalEstimated,
          advanceAmount: advanceAmount ? Number(advanceAmount) : undefined,
          notes: notes || undefined,
        }),
      });
      if (!orderRes.ok) throw new Error("Failed to create order");
      const order = await orderRes.json();

      // 2. Create outfits with price
      for (const outfit of validOutfits) {
        await fetch("/api/outfits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            name: outfit.name,
            type: outfit.type,
            occasion: outfit.occasion || undefined,
            price: outfit.price ? Number(outfit.price) : undefined,
            maggamRequired: outfit.maggamRequired,
            deliveryDate: deliveryDate || undefined,
            trialDate: trialDate || undefined,
            designerId: outfit.designerId || undefined,
          }),
        });
      }

      // 3. Record advance as first payment if provided
      if (advanceAmount && Number(advanceAmount) > 0) {
        await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            amount: Number(advanceAmount),
            method: "CASH",
            notes: "Advance payment at order creation",
          }),
        });
      }

      return order;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      router.push(`/dashboard/orders/${order.id}`);
    },
  });

  function addOutfit() {
    setOutfits([...outfits, { name: "", type: "", occasion: "", price: "", maggamRequired: false, designerId: "" }]);
  }

  function removeOutfit(index: number) {
    if (outfits.length <= 1) return;
    setOutfits(outfits.filter((_, i) => i !== index));
  }

  function updateOutfit(index: number, field: keyof OutfitEntry, value: any) {
    setOutfits(outfits.map((o, i) => (i === index ? { ...o, [field]: value } : o)));
  }

  const canSubmit = customerId && outfits.some((o) => o.name && o.type);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={preselectedCustomerId ? `/dashboard/customers/${preselectedCustomerId}` : "/dashboard/orders"}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold lg:text-3xl">New Order</h1>
      </div>

      {/* Customer Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Customer</CardTitle>
        </CardHeader>
        <CardContent>
          {preselectedCustomerId && selectedCustomer ? (
            <div className="rounded-md border p-3 bg-muted/50">
              <p className="text-sm font-medium">{selectedCustomer.name}</p>
              <p className="text-xs text-muted-foreground">{selectedCustomer.mobile}</p>
            </div>
          ) : (
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers?.customers?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} - {c.mobile}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Dates & Payment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Schedule & Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Trial Date</Label>
              <Input type="date" value={trialDate} onChange={(e) => setTrialDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Delivery Date</Label>
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Estimated Total (₹)
                {outfits.some(o => o.price) && (
                  <span className="text-muted-foreground font-normal ml-1">
                    — auto: ₹{outfits.reduce((s, o) => s + (Number(o.price) || 0), 0).toLocaleString()}
                  </span>
                )}
              </Label>
              <Input
                type="number"
                value={estimatedAmount}
                onChange={(e) => setEstimatedAmount(e.target.value)}
                placeholder={outfits.some(o => o.price)
                  ? `Auto: ${outfits.reduce((s, o) => s + (Number(o.price) || 0), 0)}`
                  : "e.g., 25000"
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Advance Payment (₹)</Label>
              <Input
                type="number"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="e.g., 10000"
              />
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
        </CardContent>
      </Card>

      {/* Outfits */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Outfits ({outfits.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={addOutfit}>
              <Plus className="h-3 w-3" /> Add More
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {outfits.map((outfit, index) => (
            <div key={index} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shirt className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Outfit {index + 1}</span>
                </div>
                {outfits.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeOutfit(index)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Name *</Label>
                  <Input
                    value={outfit.name}
                    onChange={(e) => updateOutfit(index, "name", e.target.value)}
                    placeholder="e.g., Bridal Blouse"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type *</Label>
                  <select
                    value={outfit.type}
                    onChange={(e) => updateOutfit(index, "type", e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="">Select type</option>
                    {OUTFIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price (₹)</Label>
                  <Input
                    type="number"
                    value={outfit.price}
                    onChange={(e) => updateOutfit(index, "price", e.target.value)}
                    placeholder="e.g., 15000"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Occasion</Label>
                  <Input
                    value={outfit.occasion}
                    onChange={(e) => updateOutfit(index, "occasion", e.target.value)}
                    placeholder="Wedding"
                    className="h-9"
                  />
                </div>
                {isAdmin && (
                  <div className="space-y-1">
                    <Label className="text-xs">Assign Designer</Label>
                    <select
                      value={outfit.designerId}
                      onChange={(e) => updateOutfit(index, "designerId", e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    >
                      <option value="">Assign later</option>
                      {designers.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`maggam-${index}`}
                  checked={outfit.maggamRequired}
                  onChange={(e) => updateOutfit(index, "maggamRequired", e.target.checked)}
                />
                <Label htmlFor={`maggam-${index}`} className="text-xs">Maggam Work Required</Label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Link href={preselectedCustomerId ? `/dashboard/customers/${preselectedCustomerId}` : "/dashboard/orders"}>
          <Button variant="outline" className="w-full">Cancel</Button>
        </Link>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={!canSubmit || createMutation.isPending}
        >
          {createMutation.isPending ? "Creating..." : `Create Order with ${outfits.filter(o => o.name && o.type).length} Outfit(s)`}
        </Button>
      </div>

      {createMutation.error && (
        <p className="text-sm text-destructive">{createMutation.error.message}</p>
      )}
    </div>
  );
}
