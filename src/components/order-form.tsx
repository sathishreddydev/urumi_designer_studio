"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Shirt, Calendar, UserCheck, Loader as Loader2, Sparkles, CreditCard, ImagePlus, X, Camera, Save, Calendar as CalendarIcon } from "lucide-react";
import { OutfitTypeSelect } from "@/components/outfit-type-select";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
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

// Statuses where outfit fields are still editable
const EDITABLE_STATUSES = [
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
  "READY_FOR_DELIVERY"
];

// ─── Camera Modal ────────────────────────────────────────────────────────────

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
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setError(null);
      return;
    }

    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser does not support camera capture.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        if (!cancelled)
          setError(
            "Camera access was blocked or unavailable. Please use Upload Material Photos instead.",
          );
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [open]);

  function handleCapture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `customer-material-${Date.now()}.jpg`, {
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface OutfitAddOn {
  id: string;
  name: string;
  price: string; // string in form state, converted to number on save
  notes: string;
}

interface OutfitEntry {
  id?: string;
  name: string;
  type: string;
  occasion: string;
  price: string;
  maggamRequired: boolean;
  designerId: string;
  fabricImages: File[]; // new images to upload
  existingFabricRefs?: any[]; // already-saved refs (edit mode)
  addOns: OutfitAddOn[];
  status?: string;
  isNew?: boolean;
  isDeleted?: boolean;
}

function emptyAddOn(): OutfitAddOn {
  return { id: crypto.randomUUID(), name: "", price: "", notes: "" };
}

function emptyOutfit(isNew = true): OutfitEntry {
  return {
    name: "",
    type: "",
    occasion: "",
    price: "",
    maggamRequired: false,
    designerId: "",
    fabricImages: [],
    existingFabricRefs: [],
    addOns: [],
    isNew,
  };
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface OrderFormProps {
  /** When provided the form operates in edit mode */
  orderId?: string;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function OrderForm({ orderId }: OrderFormProps) {
  const isEditMode = Boolean(orderId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get("customerId") || "";
  const queryClient = useQueryClient();
  const { isAdmin } = usePermissions();

  // ── Form State ──────────────────────────────────────────────────────────────
  const [customerId, setCustomerId] = useState(preselectedCustomerId);
  const [trialDate, setTrialDate] = useState<Date | undefined>(undefined);
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceMethod, setAdvanceMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [outfits, setOutfits] = useState<OutfitEntry[]>([emptyOutfit()]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraIndex, setCameraIndex] = useState<number | null>(null);
  const [deleteOutfitId, setDeleteOutfitId] = useState<string | null>(null);
  const [outfitTypeSearch, setOutfitTypeSearch] = useState("");

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const res = await fetch("/api/customers?limit=100");
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
    enabled: !isEditMode,
  });

  const { data: order, isLoading: isLoadingOrder } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) throw new Error("Failed to fetch order");
      return res.json();
    },
    enabled: isEditMode,
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

  const customers = customersData?.customers || [];
  const designers = (staff || []).filter((u: any) => u.role === "DESIGNER" && u.active);
  const selectedCustomer = customers.find((c: any) => c.id === customerId);

  // ── Populate form in edit mode ──────────────────────────────────────────────
  useEffect(() => {
    if (!order) return;

    setTrialDate(
      order.trialDate ? new Date(order.trialDate) : undefined,
    );
    setDeliveryDate(
      order.deliveryDate ? new Date(order.deliveryDate) : undefined,
    );
    setNotes(order.notes || "");

    const existingOutfits: OutfitEntry[] = (order.outfits || []).map(
      (o: any) => ({
        id: o.id,
        name: o.name || "",
        type: o.type || "",
        occasion: o.occasion || "",
        price: o.price ? String(Number(o.price)) : "",
        maggamRequired: o.maggamRequired || false,
        designerId: o.designerId || "",
        fabricImages: [],
        existingFabricRefs: (o.references || []).filter(
          (r: any) => r.type === "FABRIC",
        ),
        addOns: (o.addOns || []).map((a: any) => ({
          id: a.id || crypto.randomUUID(),
          name: a.name || "",
          price: String(a.price ?? ""),
          notes: a.notes || "",
        })),
        status: o.status || "DRAFT",
        isNew: false,
        isDeleted: false,
      }),
    );

    setOutfits(existingOutfits.length > 0 ? existingOutfits : [emptyOutfit()]);
  }, [order]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const activeOutfits = outfits.filter((o) => !o.isDeleted);
  const estimatedTotal = activeOutfits.reduce((s, o) => {
    const outfitPrice = Number(o.price) || 0;
    const addOnsTotal = (o.addOns || []).reduce((as, a) => as + (Number(a.price) || 0), 0);
    return s + outfitPrice + addOnsTotal;
  }, 0);
  const advance = Number(advanceAmount) || 0;
  const alreadyPaid = isEditMode
    ? (order?.payments || [])
      .filter((p: any) => p.status === "SETTLED" || !p.status)
      .reduce((s: number, p: any) => s + Number(p.amount), 0)
    : 0;
  const totalPaid = alreadyPaid + advance;
  const remainingBalance = estimatedTotal - alreadyPaid;
  const isFullyPaid = isEditMode && remainingBalance <= 0;
  const balanceDue = estimatedTotal - totalPaid;

  // ── Create mutation ─────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      const validOutfits = outfits.filter((o) => o.name && o.type);
      const calculatedTotal = validOutfits.reduce((s, o) => {
        const outfitPrice = Number(o.price) || 0;
        const addOnsTotal = (o.addOns || []).reduce((as, a) => as + (Number(a.price) || 0), 0);
        return s + outfitPrice + addOnsTotal;
      }, 0);

      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          trialDate: trialDate?.toISOString() || undefined,
          deliveryDate: deliveryDate?.toISOString() || undefined,
          estimatedAmount: calculatedTotal > 0 ? calculatedTotal : undefined,
          advanceAmount: advanceAmount ? Number(advanceAmount) : undefined,
          notes: notes || undefined,
        }),
      });
      if (!orderRes.ok) throw new Error("Failed to create order");
      const newOrder = await orderRes.json();

      for (const outfit of validOutfits) {
        const outfitRes = await fetch("/api/outfits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: newOrder.id,
            name: outfit.name,
            type: outfit.type,
            occasion: outfit.occasion || undefined,
            price: outfit.price ? Number(outfit.price) : undefined,
            maggamRequired: outfit.maggamRequired,
            deliveryDate: deliveryDate?.toISOString() || undefined,
            trialDate: trialDate?.toISOString() || undefined,
            designerId: outfit.designerId || undefined,
            addOns: (outfit.addOns || [])
              .filter((a) => a.name && a.price)
              .map((a) => ({ id: a.id, name: a.name, price: Number(a.price), notes: a.notes || undefined })),
          }),
        });

        if (outfitRes.ok && outfit.fabricImages.length > 0) {
          const createdOutfit = await outfitRes.json();
          for (const file of outfit.fabricImages) {
            const formData = new FormData();
            formData.append("file", file);
            const uploadRes = await fetch("/api/upload", {
              method: "POST",
              body: formData,
            });
            if (uploadRes.ok) {
              const { url, filename } = await uploadRes.json();
              await fetch(`/api/outfits/${createdOutfit.id}/references`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "FABRIC", url, filename }),
              });
            }
          }
        }
      }

      if (advanceAmount && Number(advanceAmount) > 0) {
        const paymentRes = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: newOrder.id,
            amount: Number(advanceAmount),
            method: advanceMethod,
            notes: "Advance payment at order creation",
          }),
        });
        if (!paymentRes.ok) {
          const err = await paymentRes.json().catch(() => ({}));
          throw new Error(
            err.error ||
            "Order created but advance payment failed — please add it manually from the order page.",
          );
        }
      }

      return newOrder;
    },
    onSuccess: (newOrder) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      router.push(`/dashboard/orders/${newOrder.id}`);
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Order creation failed",
        description: err.message,
      });
    },
  });

  // ── Save (edit) mutation ────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const orderRes = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trialDate: trialDate?.toISOString() || undefined,
          deliveryDate: deliveryDate?.toISOString() || undefined,
          estimatedAmount: estimatedTotal > 0 ? estimatedTotal : undefined,
          notes,
        }),
      });
      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save order details");
      }

      // Record advance/additional payment if entered
      if (advanceAmount && Number(advanceAmount) > 0) {
        const paymentRes = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            amount: Number(advanceAmount),
            method: advanceMethod,
            notes: "Payment recorded via order edit",
          }),
        });
        if (!paymentRes.ok) {
          const err = await paymentRes.json().catch(() => ({}));
          throw new Error(
            err.error ||
            "Order saved but payment failed — please add it manually from the order page.",
          );
        }
      }

      for (const outfit of outfits) {
        const isEditable =
          outfit.isNew || EDITABLE_STATUSES.includes(outfit.status || "DRAFT");

        if (outfit.isDeleted && outfit.id && isEditable) {
          await fetch(`/api/outfits/${outfit.id}`, { method: "DELETE" });
        } else if (outfit.isNew && outfit.name && outfit.type) {
          const outfitRes = await fetch("/api/outfits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId,
              name: outfit.name,
              type: outfit.type,
              occasion: outfit.occasion || undefined,
              price: outfit.price ? Number(outfit.price) : undefined,
              maggamRequired: outfit.maggamRequired,
              deliveryDate: deliveryDate?.toISOString() || undefined,
              trialDate: trialDate?.toISOString() || undefined,
              designerId: outfit.designerId || undefined,
              addOns: (outfit.addOns || [])
                .filter((a) => a.name && a.price)
                .map((a) => ({ id: a.id, name: a.name, price: Number(a.price), notes: a.notes || undefined })),
            }),
          });

          // Upload any fabric images for the new outfit
          if (outfitRes.ok && outfit.fabricImages.length > 0) {
            const createdOutfit = await outfitRes.json();
            for (const file of outfit.fabricImages) {
              const formData = new FormData();
              formData.append("file", file);
              const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: formData,
              });
              if (uploadRes.ok) {
                const { url, filename } = await uploadRes.json();
                await fetch(`/api/outfits/${createdOutfit.id}/references`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ type: "FABRIC", url, filename }),
                });
              }
            }
          }
        } else if (
          !outfit.isNew &&
          !outfit.isDeleted &&
          outfit.id &&
          isEditable
        ) {
          await fetch(`/api/outfits/${outfit.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: outfit.name,
              type: outfit.type,
              occasion: outfit.occasion || undefined,
              price: outfit.price ? Number(outfit.price) : undefined,
              maggamRequired: outfit.maggamRequired,
              designerId: outfit.designerId || undefined,
              deliveryDate: deliveryDate?.toISOString() || undefined,
              trialDate: trialDate?.toISOString() || undefined,
              addOns: (outfit.addOns || [])
                .filter((a) => a.name && a.price)
                .map((a) => ({ id: a.id, name: a.name, price: Number(a.price), notes: a.notes || undefined })),
            }),
          });

          // Upload any new fabric images added to an existing outfit
          if (outfit.fabricImages.length > 0) {
            for (const file of outfit.fabricImages) {
              const formData = new FormData();
              formData.append("file", file);
              const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: formData,
              });
              if (uploadRes.ok) {
                const { url, filename } = await uploadRes.json();
                await fetch(`/api/outfits/${outfit.id}/references`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ type: "FABRIC", url, filename }),
                });
              }
            }
          }
        } else if (
          !outfit.isNew &&
          !outfit.isDeleted &&
          outfit.id &&
          !isEditable
        ) {
          // Outfit is in production — only update add-ons (always allowed by API)
          await fetch(`/api/outfits/${outfit.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              addOns: (outfit.addOns || [])
                .filter((a) => a.name && a.price)
                .map((a) => ({ id: a.id, name: a.name, price: Number(a.price), notes: a.notes || undefined })),
            }),
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setAdvanceAmount("");
      toast({ title: "Order saved", description: "Changes have been saved." });
      router.push(`/dashboard/orders/${orderId}`);
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: err.message,
      });
    },
  });

  // ── Outfit helpers ──────────────────────────────────────────────────────────
  function addOutfit() {
    setOutfits((prev) => [...prev, emptyOutfit()]);
  }

  function removeOutfit(index: number) {
    const outfit = outfits[index];
    if (outfit.id && !outfit.isNew) {
      setDeleteOutfitId(outfit.id);
    } else {
      setOutfits((prev) => prev.filter((_, i) => i !== index));
    }
  }

  function confirmDeleteOutfit() {
    if (!deleteOutfitId) return;
    setOutfits((prev) =>
      prev.map((o) =>
        o.id === deleteOutfitId ? { ...o, isDeleted: true } : o,
      ),
    );
    setDeleteOutfitId(null);
  }

  function updateOutfit(index: number, field: keyof OutfitEntry, value: any) {
    setOutfits((prev) =>
      prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)),
    );
  }

  function handleFabricImageSelect(index: number, files: FileList | null) {
    if (!files) return;
    const newFiles = Array.from(files).filter((f) =>
      ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(f.type),
    );
    setOutfits((prev) =>
      prev.map((o, i) =>
        i === index
          ? { ...o, fabricImages: [...o.fabricImages, ...newFiles] }
          : o,
      ),
    );
  }

  function removeFabricImage(outfitIndex: number, imageIndex: number) {
    setOutfits((prev) =>
      prev.map((o, i) =>
        i === outfitIndex
          ? {
            ...o,
            fabricImages: o.fabricImages.filter((_, fi) => fi !== imageIndex),
          }
          : o,
      ),
    );
  }

  // ── Guards ──────────────────────────────────────────────────────────────────
  const validOutfitCount = activeOutfits.filter((o) => o.name && o.type).length;
  const canSubmit = isEditMode
    ? validOutfitCount > 0
    : Boolean(customerId && validOutfitCount > 0);

  const isPending = isEditMode
    ? saveMutation.isPending
    : createMutation.isPending;

  const mutationError = isEditMode ? saveMutation.error : createMutation.error;

  const backUrl = isEditMode
    ? `/dashboard/orders/${orderId}`
    : preselectedCustomerId
      ? `/dashboard/customers/${preselectedCustomerId}`
      : "/dashboard/orders";

  // ── Loading state (edit only) ───────────────────────────────────────────────
  if (isEditMode && isLoadingOrder) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isEditMode && !order) return <p>Order not found</p>;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b pb-4 gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link href={backUrl}>
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight sm:text-2xl truncate">
              {isEditMode ? "Edit Order" : "Create New Order"}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {isEditMode
                ? `${order.orderNumber} · ${order.customer?.name}`
                : "Configure garments, schedules, and payment details."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href={backUrl} className="hidden sm:block">
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={() =>
              isEditMode ? saveMutation.mutate() : createMutation.mutate()
            }
            disabled={!canSubmit || isPending}
          >
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {isEditMode ? (
              <>
                <Save className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">Save Changes</span>
                <span className="sm:hidden">Save</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Save Order</span>
                <span className="sm:hidden">Save</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Outfits (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Shirt className="h-5 w-5 text-primary" />
                Outfit Items ({activeOutfits.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEditMode
                  ? "Edit existing items or add new ones to this order."
                  : "Add one or multiple items to this customer order."}
              </p>
            </div>
            <Button size="sm" onClick={addOutfit} className="gap-1">
              <Plus className="h-4 w-4" /> Add Outfit
            </Button>
          </div>

          <div className="space-y-4">
            {outfits.map((outfit, index) => {
              if (outfit.isDeleted) return null;

              const isEditable =
                !isEditMode ||
                outfit.isNew ||
                EDITABLE_STATUSES.includes(outfit.status || "DRAFT");

              const displayIndex = activeOutfits.indexOf(outfit) + 1;

              return (
                <Card
                  key={outfit.id || `new-${index}`}
                  className={`relative overflow-hidden border ${!isEditable ? "opacity-80" : ""
                    }`}
                >
                  <CardHeader className="bg-muted/30 pb-3 pt-3 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="font-mono bg-background"
                      >
                        #{displayIndex}
                      </Badge>
                      {isEditMode && outfit.isNew && (
                        <Badge variant="secondary" className="text-xs">
                          New
                        </Badge>
                      )}
                      {isEditMode && !isEditable && (
                        <Badge variant="destructive" className="text-xs">
                          In Production
                        </Badge>
                      )}
                      <CardTitle className="text-sm font-medium">
                        {outfit.name || `Outfit Item ${displayIndex}`}
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
                    {isEditMode && !isEditable && (
                      <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
                        This outfit is in production — name, type, price and other fields are locked. You can still edit add-ons below.
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
                          disabled={!isEditable}
                        />
                      </div>

                      {/* Outfit Type */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">
                          Type <span className="text-destructive">*</span>
                        </Label>
                        <OutfitTypeSelect
                          value={outfit.type}
                          onValueChange={(val) =>
                            updateOutfit(index, "type", val)
                          }
                          disabled={!isEditable}
                        />
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
                            disabled={isEditMode && !isEditable}
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
                            disabled={isEditMode && !isEditable}
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
                            Boolean(checked),
                          )
                        }
                        disabled={isEditMode && !isEditable}
                      />
                      <label
                        htmlFor={`maggam-${index}`}
                        className="text-xs font-medium leading-none cursor-pointer flex items-center gap-1.5"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        Maggam / Hand Embroidery Work Required
                      </label>
                    </div>

                    <Separator />

                    {/* Add-ons Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          <Plus className="h-3.5 w-3.5 text-primary" />
                          Add-ons (Sourced Items)
                        </Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const updated = [...outfits];
                            updated[index].addOns = [...updated[index].addOns, emptyAddOn()];
                            setOutfits(updated);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Add Item
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Items sourced externally (e.g., dupatta) with separate pricing
                      </p>

                      {outfit.addOns.length > 0 && (
                        <div className="space-y-2">
                          {outfit.addOns.map((addOn, addOnIdx) => (
                            <div key={addOn.id} className="flex gap-2 items-start p-2 border rounded-md">
                              <div className="flex-1 grid grid-cols-2 gap-2">
                                <Input
                                  placeholder="Item name"
                                  value={addOn.name}
                                  onChange={(e) => {
                                    const updated = [...outfits];
                                    updated[index].addOns[addOnIdx].name = e.target.value;
                                    setOutfits(updated);
                                  }}
                                  className="h-8 text-xs"
                                />
                                <Input
                                  placeholder="Price"
                                  type="number"
                                  value={addOn.price}
                                  onChange={(e) => {
                                    const updated = [...outfits];
                                    updated[index].addOns[addOnIdx].price = e.target.value;
                                    setOutfits(updated);
                                  }}
                                  className="h-8 text-xs"
                                />
                                <Input
                                  placeholder="Notes (optional)"
                                  value={addOn.notes}
                                  onChange={(e) => {
                                    const updated = [...outfits];
                                    updated[index].addOns[addOnIdx].notes = e.target.value;
                                    setOutfits(updated);
                                  }}
                                  className="h-8 text-xs col-span-2"
                                />
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const updated = [...outfits];
                                  updated[index].addOns = updated[index].addOns.filter((_, i) => i !== addOnIdx);
                                  setOutfits(updated);
                                }}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Fabric Images */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <ImagePlus className="h-3.5 w-3.5 text-primary" />
                        Customer Material Images
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {isEditMode
                          ? "Add new photos or view existing material images."
                          : "Upload photos of the customer's fabric material (optional)."}
                      </p>

                      {/* Existing refs (edit mode) */}
                      {isEditMode &&
                        (outfit.existingFabricRefs || []).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {(outfit.existingFabricRefs || []).map(
                              (ref: any) => (
                                <div
                                  key={ref.id}
                                  className="relative w-16 h-16 rounded-md overflow-hidden border"
                                >
                                  <img
                                    src={ref.url}
                                    alt="Fabric"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ),
                            )}
                          </div>
                        )}

                      {/* New image previews */}
                      {outfit.fabricImages.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {outfit.fabricImages.map((file, imgIdx) => (
                            <div
                              key={imgIdx}
                              className="relative group w-16 h-16 rounded-md overflow-hidden border"
                            >
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`Fabric ${imgIdx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => removeFabricImage(index, imgIdx)}
                                className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upload + Camera buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        <label
                          htmlFor={`fabric-upload-${index}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md cursor-pointer hover:bg-muted transition-colors"
                        >
                          <ImagePlus className="h-3.5 w-3.5" />
                          {outfit.fabricImages.length > 0 ||
                            (outfit.existingFabricRefs || []).length > 0
                            ? "Add More"
                            : "Upload Material Photos"}
                        </label>
                        <input
                          id={`fabric-upload-${index}`}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="hidden"
                          onChange={(e) =>
                            handleFabricImageSelect(index, e.target.files)
                          }
                        />

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setCameraIndex(index);
                            setCameraOpen(true);
                          }}
                        >
                          <Camera className="h-3.5 w-3.5 mr-1.5" />
                          Take Photo
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right Column: Customer & Payment Sidebar (5 cols) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
          {/* Customer Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                {isEditMode ? "Customer" : "Customer Assignment"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isEditMode ? (
                // Edit: read-only customer display
                <div className="rounded-md border p-3 bg-muted/40 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {order.customer?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.customer?.mobile ||
                        order.customer?.email ||
                        "No contact info"}
                    </p>
                  </div>
                  <Badge variant="secondary">{order.orderNumber}</Badge>
                </div>
              ) : preselectedCustomerId && selectedCustomer ? (
                // New + preselected: show locked customer
                <div className="rounded-md border p-3 bg-muted/40 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {selectedCustomer.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedCustomer.mobile ||
                        selectedCustomer.email ||
                        "No contact info"}
                    </p>
                  </div>
                  <Badge variant="secondary">Preselected</Badge>
                </div>
              ) : (
                // New: customer selector
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Select Customer *
                  </Label>
                  <Select
                    value={customerId}
                    onValueChange={(val) => setCustomerId(val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Search or select customer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingCustomers ? (
                        <div className="flex items-center justify-center p-2 text-xs text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Loading...
                        </div>
                      ) : (
                        customers.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.mobile})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schedule & Payment Card */}
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal text-xs h-9 ${!trialDate && "text-muted-foreground"}`}
                      >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0" />
                        {trialDate ? format(trialDate, "dd MMM yyyy") : "Pick a date"}
                        {trialDate && (
                          <span
                            role="button"
                            aria-label="Clear trial date"
                            className="ml-auto opacity-50 hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); setTrialDate(undefined); }}
                          >
                            <X className="h-3 w-3" />
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={trialDate}
                        onSelect={setTrialDate}
                        disabled={isEditMode ? undefined : { before: new Date() }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Delivery Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal text-xs h-9 ${!deliveryDate && "text-muted-foreground"}`}
                      >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0" />
                        {deliveryDate ? format(deliveryDate, "dd MMM yyyy") : "Pick a date"}
                        {deliveryDate && (
                          <span
                            role="button"
                            aria-label="Clear delivery date"
                            className="ml-auto opacity-50 hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); setDeliveryDate(undefined); }}
                          >
                            <X className="h-3 w-3" />
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={deliveryDate}
                        onSelect={setDeliveryDate}
                        disabled={isEditMode ? undefined : { before: new Date() }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <Separator />

              {/* Financial Summary */}
              <div className="space-y-3 bg-muted/30 p-3 rounded-lg border">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Estimated Total</span>
                  <span className="font-semibold text-sm">
                    ₹{estimatedTotal.toLocaleString()}
                  </span>
                </div>

                {isEditMode && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Already Paid</span>
                    <span className="font-semibold text-sm text-green-600">
                      ₹{alreadyPaid.toLocaleString()}
                    </span>
                  </div>
                )}

                {isFullyPaid ? (
                  <div className="flex items-center justify-between rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 font-medium">
                    <span>Payment complete</span>
                    <span className="font-bold">Fully Paid ✓</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold flex items-center justify-between">
                      <span>{isEditMode ? "Add Payment (₹)" : "Advance Payment (₹)"}</span>
                      <CreditCard className="h-3 w-3 text-muted-foreground" />
                    </Label>
                    {isEditMode && (
                      <p className="text-[10px] text-muted-foreground">
                        Enter an amount to record a new payment. Leave blank to keep the balance unchanged.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={advanceAmount}
                        onChange={(e) => setAdvanceAmount(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        max={isEditMode ? remainingBalance : undefined}
                        className="bg-background flex-1"
                      />
                      <Select
                        value={advanceMethod}
                        onValueChange={setAdvanceMethod}
                      >
                        <SelectTrigger className="h-9 w-28 px-2 text-xs">
                          <SelectValue placeholder="Method" />
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
                )}

                <Separator />

                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="font-medium text-muted-foreground">
                    Balance Due
                  </span>
                  <span
                    className={`font-bold text-sm ${balanceDue > 0 ? "text-red-600" : "text-emerald-600"
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

              {/* Submit Button */}
              <Button
                onClick={() =>
                  isEditMode ? saveMutation.mutate() : createMutation.mutate()
                }
                disabled={!canSubmit || isPending}
                className="w-full"
                size="lg"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditMode ? "Saving Changes..." : "Creating Order..."}
                  </>
                ) : isEditMode ? (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes ({validOutfitCount} Item
                    {validOutfitCount !== 1 ? "s" : ""})
                  </>
                ) : (
                  `Create Order (${validOutfitCount} Item${validOutfitCount !== 1 ? "s" : ""
                  })`
                )}
              </Button>

              {mutationError && (
                <p className="text-xs font-medium text-destructive text-center">
                  {(mutationError as Error).message}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Camera Modal */}
      <CameraCaptureModal
        open={cameraOpen}
        onClose={() => {
          setCameraOpen(false);
          setCameraIndex(null);
        }}
        onCapture={(file) => {
          if (cameraIndex === null) return;
          setOutfits((prev) =>
            prev.map((o, i) =>
              i === cameraIndex
                ? { ...o, fabricImages: [...o.fabricImages, file] }
                : o,
            ),
          );
          setCameraIndex(null);
        }}
      />

      {/* Delete Outfit Confirmation (edit mode) */}
      <AlertDialog
        open={!!deleteOutfitId}
        onOpenChange={() => setDeleteOutfitId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Outfit</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this outfit and all its related data
              (reference images, production logs, etc.) when you save. Are you
              sure?
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
