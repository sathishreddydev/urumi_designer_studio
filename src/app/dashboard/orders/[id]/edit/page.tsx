"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Shirt,
  Calendar,
  Loader2,
  Sparkles,
  CreditCard,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { usePermissions } from "@/hooks/use-permissions";
import { Checkbox } from "@/components/ui/checkbox";
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

const OUTFIT_TYPES = [
  "Bridal Blouse",
  "Reception Blouse",
  "Lehenga",
  "Gown",
  "Kurta",
  "Saree Blouse",
  "Anarkali",
  "Sharara",
  "Other",
];

// Statuses before production starts — outfit is fully editable.
// Must match the UPPERCASE values stored in the DB (schema uses pgEnum with UPPERCASE).
const EDITABLE_STATUSES = [
  "DRAFT",
  "DESIGN_IN_PROGRESS",
  "WAITING_FOR_REFERENCES",
  "WAITING_FOR_DEPENDENCIES",
  "PRODUCTION_READY",
];

interface OutfitEntry {
  id?: string; // existing outfits have an ID
  name: string;
  type: string;
  occasion: string;
  price: string;
  maggamRequired: boolean;
  designerId: string;
  status?: string; // current workflow status
  isNew?: boolean; // flag for newly added outfits
  isDeleted?: boolean; // flag for outfits marked for deletion
}

export default function EditOrderPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAdmin } = usePermissions();

  const [trialDate, setTrialDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [outfits, setOutfits] = useState<OutfitEntry[]>([]);
  const [deleteOutfitId, setDeleteOutfitId] = useState<string | null>(null);

  // Fetch existing order
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch order");
      return res.json();
    },
  });

  // Fetch staff for designer assignment
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

  // Populate form from fetched order
  useEffect(() => {
    if (order) {
      setTrialDate(
        order.trialDate
          ? new Date(order.trialDate).toISOString().split("T")[0]
          : ""
      );
      setDeliveryDate(
        order.deliveryDate
          ? new Date(order.deliveryDate).toISOString().split("T")[0]
          : ""
      );
      setNotes(order.notes || "");

      // Map existing outfits to form entries
      const existingOutfits: OutfitEntry[] = (order.outfits || []).map(
        (o: any) => ({
          id: o.id,
          name: o.name || "",
          type: o.type || "",
          occasion: o.occasion || "",
          price: o.price ? String(Number(o.price)) : "",
          maggamRequired: o.maggamRequired || false,
          designerId: o.designerId || "",
          status: o.status || "DRAFT",
          isNew: false,
          isDeleted: false,
        })
      );

      setOutfits(
        existingOutfits.length > 0
          ? existingOutfits
          : [
              {
                name: "",
                type: "",
                occasion: "",
                price: "",
                maggamRequired: false,
                designerId: "",
                isNew: true,
              },
            ]
      );
    }
  }, [order]);

  // Calculations
  const activeOutfits = outfits.filter((o) => !o.isDeleted);
  const estimatedTotal = activeOutfits.reduce(
    (s, o) => s + (Number(o.price) || 0),
    0
  );
  const totalPaid = (order?.payments || []).reduce(
    (s: number, p: any) => s + Number(p.amount),
    0
  );
  const balanceDue = estimatedTotal - totalPaid;

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. Update order-level fields
      await fetch(`/api/orders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trialDate: trialDate || undefined,
          deliveryDate: deliveryDate || undefined,
          estimatedAmount: estimatedTotal > 0 ? estimatedTotal : undefined,
          notes,
        }),
      });

      // 2. Handle outfit changes
      for (const outfit of outfits) {
        const isEditable = outfit.isNew || EDITABLE_STATUSES.includes(outfit.status || "DRAFT");

        if (outfit.isDeleted && outfit.id && isEditable) {
          // Delete existing outfit (only if still editable)
          await fetch(`/api/outfits/${outfit.id}`, { method: "DELETE" });
        } else if (outfit.isNew && outfit.name && outfit.type) {
          // Create new outfit
          await fetch("/api/outfits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: params.id,
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
        } else if (!outfit.isNew && !outfit.isDeleted && outfit.id && isEditable) {
          // Update existing outfit (only if still editable)
          await fetch(`/api/outfits/${outfit.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              price: outfit.price ? Number(outfit.price) : undefined,
              maggamRequired: outfit.maggamRequired,
              designerId: outfit.designerId || undefined,
              deliveryDate: deliveryDate || undefined,
              trialDate: trialDate || undefined,
            }),
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", params.id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      router.push(`/dashboard/orders/${params.id}`);
    },
  });

  function addOutfit() {
    setOutfits((prev) => [
      ...prev,
      {
        name: "",
        type: "",
        occasion: "",
        price: "",
        maggamRequired: false,
        designerId: "",
        isNew: true,
      },
    ]);
  }

  function removeOutfit(index: number) {
    const outfit = outfits[index];
    if (outfit.id && !outfit.isNew) {
      // Existing outfit — confirm deletion
      setDeleteOutfitId(outfit.id);
    } else {
      // New outfit — just remove from list
      setOutfits((prev) => prev.filter((_, i) => i !== index));
    }
  }

  function confirmDeleteOutfit() {
    if (deleteOutfitId) {
      setOutfits((prev) =>
        prev.map((o) =>
          o.id === deleteOutfitId ? { ...o, isDeleted: true } : o
        )
      );
      setDeleteOutfitId(null);
    }
  }

  function updateOutfit(index: number, field: keyof OutfitEntry, value: any) {
    setOutfits((prev) =>
      prev.map((o, i) => (i === index ? { ...o, [field]: value } : o))
    );
  }

  const validOutfitCount = activeOutfits.filter(
    (o) => o.name && o.type
  ).length;
  const canSubmit = validOutfitCount > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) return <p>Order not found</p>;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/orders/${params.id}`}>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Edit Order
            </h1>
            <p className="text-xs text-muted-foreground">
              {order.orderNumber} · {order.customer?.name}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <Link href={`/dashboard/orders/${params.id}`}>
            <Button variant="ghost">Cancel</Button>
          </Link>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!canSubmit || saveMutation.isPending}
          >
            {saveMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Outfits List (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Shirt className="h-5 w-5 text-primary" />
                Outfit Items ({activeOutfits.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Edit existing items or add new ones to this order.
              </p>
            </div>
            <Button size="sm" onClick={addOutfit} className="gap-1">
              <Plus className="h-4 w-4" /> Add Outfit
            </Button>
          </div>

          <div className="space-y-4">
            {outfits.map((outfit, index) => {
              if (outfit.isDeleted) return null;

              const isEditable = outfit.isNew || EDITABLE_STATUSES.includes(outfit.status || "DRAFT");

              return (
                <Card key={outfit.id || `new-${index}`} className={`relative overflow-hidden border ${!isEditable ? "opacity-80" : ""}`}>
                  <CardHeader className="bg-muted/30 pb-3 pt-3 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="font-mono bg-background"
                      >
                        #{activeOutfits.indexOf(outfit) + 1}
                      </Badge>
                      {outfit.isNew && (
                        <Badge variant="secondary" className="text-xs">
                          New
                        </Badge>
                      )}
                      {!isEditable && (
                        <Badge variant="destructive" className="text-xs">
                          In Production
                        </Badge>
                      )}
                      <CardTitle className="text-sm font-medium">
                        {outfit.name || `Outfit Item`}
                      </CardTitle>
                    </div>
                    {activeOutfits.length > 1 && isEditable && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeOutfit(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    {!isEditable && (
                      <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
                        This outfit is in production and cannot be edited or removed.
                      </p>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Item Name */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">
                          Item Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          value={outfit.name}
                          onChange={(e) =>
                            updateOutfit(index, "name", e.target.value)
                          }
                          placeholder="e.g., Heavy Silk Blouse"
                          disabled={!outfit.isNew}
                        />
                      </div>

                      {/* Outfit Type */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">
                          Type <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={outfit.type}
                          onValueChange={(val) =>
                            updateOutfit(index, "type", val)
                          }
                          disabled={!outfit.isNew}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select outfit type" />
                          </SelectTrigger>
                          <SelectContent>
                            {OUTFIT_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Price */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">
                          Estimated price (₹)
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">
                            ₹
                          </span>
                          <Input
                            type="number"
                            className="pl-7"
                            value={outfit.price}
                            onChange={(e) =>
                              updateOutfit(index, "price", e.target.value)
                            }
                            placeholder="0.00"
                            disabled={!isEditable}
                          />
                        </div>
                      </div>

                      {/* Assign Designer (Admin Only) */}
                      {isAdmin && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">
                            Assigned Designer
                          </Label>
                          <Select
                            value={outfit.designerId}
                            onValueChange={(val) =>
                              updateOutfit(index, "designerId", val)
                            }
                            disabled={!isEditable}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Assign later..." />
                            </SelectTrigger>
                            <SelectContent>
                              {designers.map((d: any) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Maggam Work Checkbox */}
                    <div className="flex items-center space-x-2 pt-1">
                      <Checkbox
                        id={`maggam-${index}`}
                        checked={outfit.maggamRequired}
                        onCheckedChange={(checked) =>
                          updateOutfit(
                            index,
                            "maggamRequired",
                            Boolean(checked)
                          )
                        }
                        disabled={!isEditable}
                      />
                      <label
                        htmlFor={`maggam-${index}`}
                        className="text-xs font-medium leading-none cursor-pointer flex items-center gap-1.5"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        Maggam / Hand Embroidery Work Required
                      </label>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right Column: Schedule & Payment Sidebar (5 cols) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
          {/* Customer Info Card (read-only) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border p-3 bg-muted/40 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {order.customer?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.customer?.mobile || order.customer?.email || "No contact info"}
                  </p>
                </div>
                <Badge variant="secondary">{order.orderNumber}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Schedule & Financial Summary Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Schedule & Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Trial Date</Label>
                  <Input
                    type="date"
                    value={trialDate}
                    onChange={(e) => setTrialDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Delivery Date</Label>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              {/* Financial Calculation Summary */}
              <div className="space-y-3 bg-muted/30 p-3 rounded-lg border">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Estimated Total</span>
                  <span className="font-semibold text-sm">
                    ₹{estimatedTotal.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    Paid So Far
                  </span>
                  <span className="font-semibold text-sm text-green-600">
                    ₹{totalPaid.toLocaleString()}
                  </span>
                </div>

                <Separator />

                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="font-medium text-muted-foreground">
                    Balance Due
                  </span>
                  <span
                    className={`font-bold text-sm ${
                      balanceDue > 0 ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    ₹{Math.max(0, balanceDue).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Order Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions, design requests, etc."
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Save Button */}
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!canSubmit || saveMutation.isPending}
                className="w-full"
                size="lg"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes ({validOutfitCount} Item
                    {validOutfitCount !== 1 ? "s" : ""})
                  </>
                )}
              </Button>

              {saveMutation.error && (
                <p className="text-xs font-medium text-destructive text-center">
                  {(saveMutation.error as Error).message}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Outfit Confirmation */}
      <AlertDialog
        open={!!deleteOutfitId}
        onOpenChange={() => setDeleteOutfitId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Outfit</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this outfit and all its related data
              (reference images, production logs, etc.) when you save. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteOutfit}
            >
              Remove Outfit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
