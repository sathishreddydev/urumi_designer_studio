"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Shirt,
  Trash2,
  ImageIcon,
  ImagePlus,
  Camera,
  X,
  Calendar,
  ExternalLink,
  Plus,
  AlertTriangle,
  ChevronUp,
} from "lucide-react";

import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/hooks/use-toast";
import { ImageViewer } from "@/components/image-viewer";
import { CameraCaptureModal } from "@/components/camera-capture-modal";
import { OutfitTypeSelect } from "@/components/outfit-type-select";

// ─── Per-Outfit Status Updater ───────────────────────────────────────────────

function OutfitStatusUpdater({
  outfitId,
  orderId,
  disabled,
}: {
  outfitId: string;
  orderId: string;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();

  const { data: transitions } = useQuery({
    queryKey: ["outfit-transitions", outfitId],
    queryFn: async () => {
      const res = await fetch(`/api/outfits/${outfitId}/transition`);
      if (!res.ok) return { availableTransitions: [] };
      return res.json();
    },
    enabled: !disabled,
  });

  const transitionMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await fetch(`/api/outfits/${outfitId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Transition failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({
        queryKey: ["outfit-transitions", outfitId],
      });
      toast({ title: "Status updated" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed",
        description: error.message,
      });
    },
  });

  const available: { status: string; label: string }[] =
    transitions?.availableTransitions ?? [];

  if (disabled || available.length === 0) return null;

  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-2">
      <span className="text-[11px] font-medium text-muted-foreground">
        Move to
      </span>
      <div className="flex flex-wrap justify-end gap-1.5">
        {available.map((t) => (
          <LoadingButton
            key={t.status}
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2.5 text-xs bg-background"
            loading={
              transitionMutation.isPending &&
              transitionMutation.variables === t.status
            }
            onClick={() => transitionMutation.mutate(t.status)}
          >
            <ArrowRight className="h-3 w-3" />
            {t.label}
          </LoadingButton>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { can, isAdmin } = usePermissions();

  // Resolve back destination from ?from= param
  const from = searchParams.get("from");
  const customerIdParam = searchParams.get("customerId");
  // from=orders        → /dashboard/orders
  // from=customer      → /dashboard/customers/[id]
  // from=consultations → /dashboard/consultations
  // default            → customer detail if available, else /dashboard/orders

  // Inline Section Expansion States (No Modals)
  const [showAddOutfit, setShowAddOutfit] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Image Viewer State
  const [viewerImages, setViewerImages] = useState<any[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Validation & Form Reset Keys
  const [paymentAmountError, setPaymentAmountError] = useState("");
  const [outfitFormKey, setOutfitFormKey] = useState(0);
  const [paymentFormKey, setPaymentFormKey] = useState(0);
  const [newOutfitFabricImages, setNewOutfitFabricImages] = useState<File[]>(
    [],
  );
  const [cameraOpen, setCameraOpen] = useState(false);

  // Stable blob URLs for fabric image previews — revoked when images change or component unmounts
  const blobUrlsRef = useRef<string[]>([]);
  const fabricPreviewUrls = useMemo(() => {
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    const urls = newOutfitFabricImages.map((f) => URL.createObjectURL(f));
    blobUrlsRef.current = urls;
    return urls;
  }, [newOutfitFabricImages]);
  useEffect(() => () => blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch order details");
      return res.json();
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  const designers = useMemo(
    () => staff.filter((u: any) => u.role === "DESIGNER"),
    [staff],
  );
  const masters = useMemo(
    () => staff.filter((u: any) => u.role === "MASTER"),
    [staff],
  );

  // Derived Calculations
  const { totalPaid, orderTotal, balance, missingPriceOutfits } =
    useMemo(() => {
      if (!order)
        return {
          totalPaid: 0,
          orderTotal: 0,
          balance: 0,
          missingPriceOutfits: [],
        };

      const paid = (order.payments || [])
        .filter((p: any) => p.status === "SETTLED" || !p.status)
        .reduce((s: number, p: any) => s + Number(p.amount), 0);

      const calculatedTotal = (order.outfits || []).reduce(
        (s: number, o: any) => {
          const outfitPrice = Number(o.price) || 0;
          const addOnsTotal = (o.addOns || []).reduce((as: number, a: any) => as + (Number(a.price) || 0), 0);
          return s + outfitPrice + addOnsTotal;
        },
        0,
      );

      // Use live outfit+addOns sum as source of truth.
      // Fall back to order.estimatedAmount only when no outfit prices are set yet.
      const estimated = calculatedTotal > 0 ? calculatedTotal : (Number(order.estimatedAmount) || 0);
      // Outfits with no price AND no addOns = truly unpriced
      const unpriced = (order.outfits || []).filter(
        (o: any) => {
          const hasOutfitPrice = o.price !== null && o.price !== undefined && String(o.price).trim() !== "";
          const hasAddOns = (o.addOns || []).length > 0;
          return !hasOutfitPrice && !hasAddOns;
        }
      );

      return {
        totalPaid: paid,
        orderTotal: calculatedTotal,
        balance: estimated - paid,
        missingPriceOutfits: unpriced,
      };
    }, [order]);

  // Mutations
  const addOutfitMutation = useMutation({
    mutationFn: async (data: any) => {
      const { fabricImages = [], ...outfitData } = data;
      const res = await fetch("/api/outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...outfitData, orderId: params.id }),
      });
      if (!res.ok) throw new Error("Failed to add outfit");
      const createdOutfit = await res.json();

      for (const file of fabricImages as File[]) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) continue;

        const { url, filename } = await uploadRes.json();
        await fetch(`/api/outfits/${createdOutfit.id}/references`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "FABRIC", url, filename }),
        });
      }

      return createdOutfit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", params.id] });
      setShowAddOutfit(false);
      setOutfitFormKey((prev) => prev + 1);
      setNewOutfitFabricImages([]);
      toast({ title: "Outfit Added", description: "New item added to order." });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({
      outfitId,
      designerId,
      masterId,
    }: {
      outfitId: string;
      designerId?: string;
      masterId?: string;
    }) => {
      const res = await fetch(`/api/outfits/${outfitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designerId, masterId }),
      });
      if (!res.ok) throw new Error("Failed to assign staff");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", params.id] });
      toast({ title: "Assignment Updated" });
    },
  });

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
      setPaymentFormKey((prev) => prev + 1);
      setPaymentAmountError("");
      toast({
        title: "Payment Recorded",
        description: "Payment status updated.",
      });
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Failed",
        description: err.message,
      });
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to void payment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", params.id] });
      toast({ title: "Payment Voided" });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orders/${params.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete order");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Order Deleted",
        description: "Order and related records removed.",
      });
      const deleteBackHref =
        from === "orders"
          ? "/dashboard/orders"
          : from === "consultations"
            ? "/dashboard/consultations"
            : from === "customer" && (customerIdParam || order?.customer?.id)
              ? `/dashboard/customers/${customerIdParam || order?.customer?.id}`
              : "/dashboard/orders";
      router.push(deleteBackHref);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: error.message,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto p-4 animate-pulse">
        <div className="h-10 bg-muted rounded-md w-1/3" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-64 bg-muted rounded-md lg:col-span-2" />
          <div className="h-64 bg-muted rounded-md" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Order not found.</p>
        <Button variant="link" onClick={() => router.push(from === "customer" && customerIdParam ? `/dashboard/customers/${customerIdParam}` : "/dashboard/orders")}>
          Back to Orders
        </Button>
      </div>
    );
  }

  const isCompleted = order.status === "Completed";
  const portalUrl = order.portalToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${order.portalToken}`
    : null;

  return (
    <div className="font-sans space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={
              from === "orders"
                ? "/dashboard/orders"
                : from === "consultations"
                  ? "/dashboard/consultations"
                  : from === "customer" && (customerIdParam || order.customer?.id)
                    ? `/dashboard/customers/${customerIdParam || order.customer?.id}`
                    : order.customer?.id
                      ? `/dashboard/customers/${order.customer.id}`
                      : "/dashboard/orders"
            }
          >
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold leading-6 tracking-tight sm:text-xl">
                {order.orderNumber}
              </h1>
              <Badge
                className={`${getStatusColor(order.status)} text-xs leading-4`}
              >
                {order.status}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-4 text-muted-foreground">
              Customer:{" "}
              <span className="font-medium text-foreground">
                {order.customer?.name}
              </span>{" "}
              ({order.customer?.mobile})
            </p>
          </div>
        </div>

        {/* Top Header Actions */}
        {can("update", "order") && !isCompleted && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                if (missingPriceOutfits.length > 0) {
                  toast({
                    variant: "destructive",
                    title: "Cannot generate invoice",
                    description: `Missing pricing on: ${missingPriceOutfits.map((o: any) => o.name).join(", ")}`,
                  });
                  return;
                }
                router.push(`/dashboard/orders/${params.id}/invoice`);
              }}
            >
              Invoice
            </Button>
            <Link href={`/dashboard/orders/${params.id}/edit`}>
              <Button variant="outline" size="sm" className="text-xs">
                Edit
              </Button>
            </Link>
            {can("delete", "order") && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-destructive border-destructive/20 hover:bg-destructive/10"
                onClick={() => setShowDeleteConfirm((prev) => !prev)}
              >
                <Trash2 className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Inline Delete Confirmation Panel */}
      {showDeleteConfirm && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg space-y-3">
          <div className="flex items-center gap-2 text-destructive font-medium text-sm">
            <AlertTriangle className="h-4 w-4" /> Confirm Deletion of Order{" "}
            {order.orderNumber}
          </div>
          <p className="text-xs text-muted-foreground">
            This operation cannot be undone. All outfits, attachments,
            assignments, and payments will be permanently removed.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <LoadingButton
              variant="destructive"
              size="sm"
              loading={deleteOrderMutation.isPending}
              onClick={() => deleteOrderMutation.mutate()}
            >
              Confirm & Delete
            </LoadingButton>
          </div>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Outfits Workspace */}
        <div className="font-sans text-sm lg:col-span-7 space-y-4 lg:overflow-y-auto order-2 lg:order-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold leading-5 flex items-center gap-2">
                <Shirt className="h-4 w-4 text-primary" />
                Outfits ({order.outfits?.length || 0})
              </CardTitle>
              {!isCompleted && can("create", "outfit") && (
                <Button
                  size="sm"
                  variant={showAddOutfit ? "secondary" : "default"}
                  className="gap-1"
                  onClick={() => setShowAddOutfit(!showAddOutfit)}
                >
                  {showAddOutfit ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {showAddOutfit ? "Close Form" : "Add Outfit"}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {/* Inline Add Outfit Form Panel */}
              {showAddOutfit && (
                <form
                  key={outfitFormKey}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    addOutfitMutation.mutate({
                      name: form.get("name"),
                      type: form.get("type"),
                      occasion: form.get("occasion") || undefined,
                      price: form.get("price")
                        ? Number(form.get("price"))
                        : undefined,
                      maggamRequired: form.get("maggamRequired") === "on",
                      designerId:
                        form.get("designerId") === "none"
                          ? undefined
                          : form.get("designerId"),
                      fabricImages: newOutfitFabricImages,
                    });
                  }}
                  className="bg-muted/40 p-4 border rounded-lg space-y-4 my-2 transition-all"
                >
                  <p className="text-sm font-semibold leading-5 border-b pb-2">
                    New Outfit Details
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold" htmlFor="name">
                        Item Name
                      </Label>
                      <Input
                        id="name"
                        name="name"
                        placeholder="e.g., Heavy Silk Blouse"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold" htmlFor="type">
                        Type
                      </Label>
                      <OutfitTypeSelect name="type" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        className="text-xs font-semibold"
                        htmlFor="occasion"
                      >
                        Occasion
                      </Label>
                      <Input
                        id="occasion"
                        name="occasion"
                        placeholder="e.g. Wedding Reception"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold" htmlFor="price">
                        Estimated Price (₹)
                      </Label>
                      <Input
                        id="price"
                        name="price"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                      />
                    </div>
                    {isAdmin && (
                      <div className="space-y-1.5">
                        <Label
                          className="text-xs font-semibold"
                          htmlFor="designerId"
                        >
                          Assigned Designer
                        </Label>
                        <Select name="designerId" defaultValue="none">
                          <SelectTrigger id="designerId">
                            <SelectValue placeholder="Assign later..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              Assign later...
                            </SelectItem>
                            {designers.map((designer: any) => (
                              <SelectItem key={designer.id} value={designer.id}>
                                {designer.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="maggamRequired"
                      id="maggamRequired"
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label
                      htmlFor="maggamRequired"
                      className="text-xs font-medium leading-4"
                    >
                      Requires Maggam Work
                    </Label>
                  </div>
                  <div className="space-y-2 border-t pt-3">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <ImagePlus className="h-3.5 w-3.5 text-primary" />
                      Customer Material Images
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Upload photos of the customer's fabric material
                      (optional).
                    </p>
                    {newOutfitFabricImages.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {newOutfitFabricImages.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="relative group h-16 w-16 overflow-hidden rounded-md border"
                          >
                            <img
                              src={fabricPreviewUrls[index]}
                              alt={`Fabric ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setNewOutfitFabricImages((current) =>
                                  current.filter(
                                    (_, fileIndex) => fileIndex !== index,
                                  ),
                                )
                              }
                              className="absolute right-0 top-0 rounded-bl bg-destructive p-0.5 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                              aria-label={`Remove fabric image ${index + 1}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        htmlFor="new-outfit-fabric-upload"
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium leading-4 transition-colors hover:bg-muted"
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        {newOutfitFabricImages.length > 0
                          ? "Add More"
                          : "Upload Material Photos"}
                      </label>
                      <input
                        id="new-outfit-fabric-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) {
                            setNewOutfitFabricImages((current) => [
                              ...current,
                              ...Array.from(e.target.files || []),
                            ]);
                          }
                          e.currentTarget.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setCameraOpen(true)}
                      >
                        <Camera className="mr-1.5 h-3.5 w-3.5" />
                        Take Photo
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1 border-t">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAddOutfit(false);
                        setOutfitFormKey((prev) => prev + 1);
                        setNewOutfitFabricImages([]);
                      }}
                    >
                      Cancel
                    </Button>
                    <LoadingButton
                      type="submit"
                      size="sm"
                      loading={addOutfitMutation.isPending}
                    >
                      Save Outfit Item
                    </LoadingButton>
                  </div>
                </form>
              )}

              {/* Outfits List */}
              {(order.outfits || []).length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                  No outfits added to this order yet.
                </div>
              ) : (
                (order.outfits || []).map((outfit: any) => (
                  <div
                    key={outfit.id}
                    className="border rounded-lg p-4 space-y-3 bg-card hover:border-accent transition-colors"
                  >
                    {/* Card header: name left, price + status right */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/outfits/${outfit.id}?from=order&orderId=${params.id}`}
                          className="text-sm font-semibold leading-5 hover:underline flex items-center gap-1.5"
                        >
                          {outfit.name}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {outfit.type}{" "}
                          {outfit.maggamRequired ? "• Maggam Work" : ""}
                        </p>
                        {outfit.occasion && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Occasion: {outfit.occasion}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1">
                        <Badge className={getStatusColor(outfit.status)}>
                          {formatStatus(outfit.status)}
                        </Badge>
                        <p className="text-sm font-bold leading-5">
                          {(() => {
                            const outfitPrice = Number(outfit.price) || 0;
                            const addOnsTotal = (outfit.addOns || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
                            const total = outfitPrice + addOnsTotal;
                            if (total > 0) return `₹${total.toLocaleString()}`;
                            return <span className="text-amber-600 text-xs font-normal">Price Pending</span>;
                          })()}
                        </p>
                      </div>
                    </div>

                    {/* Status transition row — full width, visually separate */}
                    <OutfitStatusUpdater
                      outfitId={outfit.id}
                      orderId={params.id as string}
                      disabled={isCompleted || !can("update", "outfit")}
                    />

                    {/* Add-ons Display */}
                    {outfit.addOns && outfit.addOns.length > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-950/20 p-2.5 rounded-md text-xs space-y-1.5">
                        <p className="font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1">
                          <Plus className="h-3.5 w-3.5" /> Add-ons (Sourced Items)
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
                        {/* Add-ons subtotal */}
                        {(() => {
                          const addOnsTotal = outfit.addOns.reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
                          const outfitPrice = Number(outfit.price) || 0;
                          return (
                            <div className="border-t border-blue-200 dark:border-blue-800 pt-1.5 mt-1 flex justify-between font-semibold">
                              <span className="text-blue-700 dark:text-blue-300">
                                Outfit Total
                                {outfitPrice > 0 && (
                                  <span className="font-normal text-muted-foreground ml-1">
                                    (₹{outfitPrice.toLocaleString()} + ₹{addOnsTotal.toLocaleString()} add-ons)
                                  </span>
                                )}
                              </span>
                              <span className="text-blue-700 dark:text-blue-300 text-nowrap">
                                ₹{(outfitPrice + addOnsTotal).toLocaleString()}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Customer Fabric References */}
                    {(() => {
                      const fabricRefs = (outfit.references || []).filter(
                        (r: any) => r.type === "FABRIC",
                      );
                      return (
                        <div className="bg-muted/40 p-2.5 rounded-md text-xs space-y-1.5">
                          <p className="font-medium text-muted-foreground flex items-center gap-1">
                            <ImageIcon className="h-3.5 w-3.5" /> Material
                            Attachments{" "}
                            {fabricRefs.length > 0 && `(${fabricRefs.length})`}
                          </p>
                          {fabricRefs.length > 0 ? (
                            <div className="flex gap-2 flex-wrap">
                              {fabricRefs.map((ref: any, idx: number) => (
                                <button
                                  key={ref.id}
                                  type="button"
                                  className="h-12 w-12 rounded border overflow-hidden relative focus:ring-2 focus:ring-primary"
                                  onClick={() => {
                                    setViewerImages(
                                      fabricRefs.map((r: any) => ({
                                        id: r.id,
                                        url: r.url,
                                        filename: r.filename,
                                      })),
                                    );
                                    setViewerIndex(idx);
                                    setViewerOpen(true);
                                  }}
                                >
                                  <img
                                    src={ref.url}
                                    alt={ref.filename || "Fabric reference"}
                                    className="h-full w-full object-cover"
                                  />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-muted-foreground">
                              No customer material uploaded yet.
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Admin Staff Assignments */}
                    {isAdmin && !isCompleted && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t text-xs">
                        <div className="space-y-1">
                          <Label className="text-[11px] leading-4 text-muted-foreground">
                            Assigned Designer
                          </Label>
                          <Select
                            value={outfit.designerId || "none"}
                            onValueChange={(val) =>
                              assignMutation.mutate({
                                outfitId: outfit.id,
                                designerId: val === "none" ? undefined : val,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Unassigned</SelectItem>
                              {designers.map((d: any) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] leading-4 text-muted-foreground">
                            Assigned Master
                          </Label>
                          <Select
                            value={outfit.masterId || "none"}
                            onValueChange={(val) =>
                              assignMutation.mutate({
                                outfitId: outfit.id,
                                masterId: val === "none" ? undefined : val,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Unassigned</SelectItem>
                              {masters.map((m: any) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Key Schedule & Financials */}
        <div className="font-sans text-sm lg:col-span-5 space-y-4 lg:sticky lg:top-4 order-1 lg:order-2">
          {/* Order Details & Dates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold leading-5 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Key Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-5">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-xs text-muted-foreground">
                  Ordered Date
                </span>
                <span className="text-sm font-medium">
                  {formatDate(order.orderDate)}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-xs text-muted-foreground">
                  Trial Date
                </span>
                <span className="text-sm font-medium text-amber-700">
                  {formatDate(order.trialDate)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  Target Delivery
                </span>
                <span className="text-sm font-semibold text-primary">
                  {formatDate(order.deliveryDate)}
                </span>
              </div>

              {portalUrl && (
                <div className="pt-2">
                  <a
                    href={portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Client Tracking Portal <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment & Financial Card */}
          {can("read", "payment") && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold leading-5 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" /> Payment
                  Summary
                </CardTitle>
                {!isCompleted && can("create", "payment") && balance > 0 && (
                  <Button
                    size="sm"
                    variant={showAddPayment ? "secondary" : "outline"}
                    className="h-8 text-xs gap-1"
                    onClick={() => {
                      setShowAddPayment(!showAddPayment);
                      setPaymentAmountError("");
                    }}
                  >
                    {showAddPayment ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    {showAddPayment ? "Close" : "Payment"}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-5">
                {/* Visual Financial Summary Bar */}
                <div className="grid grid-cols-3 gap-2 bg-muted/50 p-3 rounded-lg text-center">
                  <div>
                    <span className="text-[11px] leading-4 text-muted-foreground uppercase tracking-wider">
                      Total
                    </span>
                    <p className="font-bold text-sm">
                      ₹{(orderTotal > 0 ? orderTotal : (Number(order.estimatedAmount) || 0)).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] leading-4 text-muted-foreground uppercase tracking-wider">
                      Paid
                    </span>
                    <p className="font-bold text-sm text-green-600">
                      ₹{totalPaid.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] leading-4 text-muted-foreground uppercase tracking-wider">
                      Balance
                    </span>
                    <p
                      className={`font-bold text-sm ${balance > 0 ? "text-destructive" : "text-green-600"}`}
                    >
                      {balance < 0
                        ? `₹${Math.abs(balance).toLocaleString()} over`
                        : `₹${balance.toLocaleString()}`}
                    </p>
                  </div>
                </div>

                {/* Inline Add Payment Form Panel */}
                {showAddPayment && (
                  <form
                    key={paymentFormKey}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      const amount = Number(form.get("amount"));

                      if (!Number.isFinite(amount) || amount <= 0) {
                        setPaymentAmountError("Please enter a valid amount.");
                        return;
                      }
                      if (balance > 0 && amount > balance) {
                        setPaymentAmountError(
                          `Amount exceeds total balance (₹${balance.toLocaleString()})`,
                        );
                        return;
                      }

                      setPaymentAmountError("");
                      addPaymentMutation.mutate({
                        amount,
                        method: form.get("method"),
                        notes: form.get("notes"),
                        outfitId:
                          form.get("outfitId") === "none"
                            ? undefined
                            : form.get("outfitId"),
                        transactionRef: form.get("transactionRef") || undefined,
                      });
                    }}
                    className="bg-muted/40 p-3.5 border rounded-lg space-y-3 transition-all"
                  >
                    <p className="text-xs font-semibold border-b pb-1.5">
                      Record New Payment
                    </p>
                    <div className="space-y-1">
                      <Label className="text-xs">Allocation</Label>
                      <Select name="outfitId" defaultValue="none">
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Whole Order" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Whole Order</SelectItem>
                          {(order.outfits || []).map((o: any) => {
                              const outfitPrice = Number(o.price) || 0;
                              const addOnsTotal = (o.addOns || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
                              const total = outfitPrice + addOnsTotal;
                              return (
                                <SelectItem key={o.id} value={o.id}>
                                  {o.name}{total > 0 ? ` (₹${total.toLocaleString()})` : ""}
                                </SelectItem>
                              );
                            })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="amount" className="text-xs">
                          Amount (₹)
                        </Label>
                        <Input
                          id="amount"
                          name="amount"
                          type="number"
                          placeholder="5000"
                          min="1"
                          className="h-8 text-xs"
                          required
                          onChange={() =>
                            paymentAmountError && setPaymentAmountError("")
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="method" className="text-xs">
                          Method
                        </Label>
                        <Select name="method" defaultValue="UPI" required>
                          <SelectTrigger id="method" className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CASH">Cash</SelectItem>
                            <SelectItem value="UPI">UPI</SelectItem>
                            <SelectItem value="CARD">Card</SelectItem>
                            <SelectItem value="BANK_TRANSFER">
                              Bank Transfer
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {paymentAmountError && (
                      <p className="text-[11px] text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />{" "}
                        {paymentAmountError}
                      </p>
                    )}

                    <div className="space-y-1">
                      <Label htmlFor="transactionRef" className="text-xs">
                        Transaction Ref / UPI ID
                      </Label>
                      <Input
                        id="transactionRef"
                        name="transactionRef"
                        placeholder="Optional"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="notes" className="text-xs">
                        Notes
                      </Label>
                      <Input
                        id="notes"
                        name="notes"
                        placeholder="Optional notes"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1 border-t">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setShowAddPayment(false);
                          setPaymentFormKey((prev) => prev + 1);
                          setPaymentAmountError("");
                        }}
                      >
                        Cancel
                      </Button>
                      <LoadingButton
                        type="submit"
                        size="sm"
                        className="h-7 text-xs"
                        loading={addPaymentMutation.isPending}
                      >
                        Save Payment
                      </LoadingButton>
                    </div>
                  </form>
                )}

                {/* Individual Payment Transactions */}
                <div className="space-y-2 pt-2">
                  {(order.payments || []).length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-2">
                      No payments recorded.
                    </p>
                  ) : (
                    (order.payments || []).map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-xs py-2 border-b last:border-0"
                      >
                        <div>
                          <div className="font-medium flex items-center gap-1.5">
                            <span>{p.method}</span>
                            {p.transactionRef && (
                              <span className="text-muted-foreground">
                                ({p.transactionRef})
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(p.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">
                            ₹{Number(p.amount).toLocaleString()}
                          </span>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => deletePaymentMutation.mutate(p.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <CameraCaptureModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) =>
          setNewOutfitFabricImages((current) => [...current, file])
        }
      />

      {/* Global Image Viewer Component */}
      <ImageViewer
        images={viewerImages}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}
