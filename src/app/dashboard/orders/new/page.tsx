"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Shirt,
  Calendar,
  UserCheck,
  Loader2,
  Sparkles,
  CreditCard,
  ImagePlus,
  X,
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
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!open) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setStream(null);
      setError(null);
      return;
    }

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser does not support camera capture.");
        return;
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }
      } catch {
        setError("Camera access was blocked or unavailable. Please use Upload Material Photos instead.");
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [open]);

  function handleCapture() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `customer-material-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      onCapture(file);
      onClose();
    }, "image/jpeg", 0.9);
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

interface OutfitEntry {
  name: string;
  type: string;
  occasion: string;
  price: string;
  maggamRequired: boolean;
  designerId: string;
  fabricImages: File[];
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
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceMethod, setAdvanceMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraIndex, setCameraIndex] = useState<number | null>(null);
  const [outfits, setOutfits] = useState<OutfitEntry[]>([
    {
      name: "",
      type: "",
      occasion: "",
      price: "",
      maggamRequired: false,
      designerId: "",
      fabricImages: [],
    },
  ]);

  // Queries
  const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const res = await fetch("/api/customers?limit=100");
      if (!res.ok) throw new Error("Failed to fetch customers");
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

  const customers = customersData?.customers || [];
  const designers = (staff || []).filter((u: any) => u.role === "DESIGNER");
  const selectedCustomer = customers.find((c: any) => c.id === customerId);

  // Calculations
  const estimatedTotal = outfits.reduce(
    (s, o) => s + (Number(o.price) || 0),
    0,
  );
  const advance = Number(advanceAmount) || 0;
  const balanceDue = estimatedTotal - advance;

  // Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const validOutfits = outfits.filter((o) => o.name && o.type);
      const calculatedTotal = validOutfits.reduce(
        (sum, o) => sum + (Number(o.price) || 0),
        0,
      );

      // 1. Create order
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          trialDate: trialDate || undefined,
          deliveryDate: deliveryDate || undefined,
          estimatedAmount: calculatedTotal > 0 ? calculatedTotal : undefined,
          advanceAmount: advanceAmount ? Number(advanceAmount) : undefined,
          notes: notes || undefined,
        }),
      });
      if (!orderRes.ok) throw new Error("Failed to create order");
      const order = await orderRes.json();

      // 2. Create outfits with price and upload fabric images
      for (const outfit of validOutfits) {
        const outfitRes = await fetch("/api/outfits", {
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

        if (outfitRes.ok && outfit.fabricImages.length > 0) {
          const createdOutfit = await outfitRes.json();
          // Upload each fabric image
          for (const file of outfit.fabricImages) {
            const formData = new FormData();
            formData.append("file", file);
            const uploadRes = await fetch("/api/upload", {
              method: "POST",
              body: formData,
            });
            if (uploadRes.ok) {
              const { url, filename } = await uploadRes.json();
              // Save as fabric reference for this outfit
              await fetch(`/api/outfits/${createdOutfit.id}/references`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "FABRIC", url, filename }),
              });
            }
          }
        }
      }

      // 3. Record advance as first payment if provided
      if (advanceAmount && Number(advanceAmount) > 0) {
        await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            amount: Number(advanceAmount),
            method: advanceMethod,
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
    setOutfits((prev) => [
      ...prev,
      {
        name: "",
        type: "",
        occasion: "",
        price: "",
        maggamRequired: false,
        designerId: "",
        fabricImages: [],
      },
    ]);
  }

  function removeOutfit(index: number) {
    if (outfits.length <= 1) return;
    setOutfits((prev) => prev.filter((_, i) => i !== index));
  }

  function updateOutfit(index: number, field: keyof OutfitEntry, value: any) {
    setOutfits((prev) =>
      prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)),
    );
  }

  function handleFabricImageSelect(index: number, files: FileList | null) {
    if (!files) return;
    const newFiles = Array.from(files).filter((f) =>
      ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(f.type)
    );
    setOutfits((prev) =>
      prev.map((o, i) =>
        i === index
          ? { ...o, fabricImages: [...o.fabricImages, ...newFiles] }
          : o
      )
    );
  }

  function removeFabricImage(outfitIndex: number, imageIndex: number) {
    setOutfits((prev) =>
      prev.map((o, i) =>
        i === outfitIndex
          ? { ...o, fabricImages: o.fabricImages.filter((_, fi) => fi !== imageIndex) }
          : o
      )
    );
  }

  const validOutfitCount = outfits.filter((o) => o.name && o.type).length;
  const canSubmit = Boolean(customerId && validOutfitCount > 0);

  const backUrl = preselectedCustomerId
    ? `/dashboard/customers/${preselectedCustomerId}`
    : "/dashboard/orders";

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href={backUrl}>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Create New Order
            </h1>
            <p className="text-xs text-muted-foreground">
              Configure garments, schedules, and initial payment details.
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <Link href={backUrl}>
            <Button variant="ghost">Cancel</Button>
          </Link>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
          >
            {createMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Order
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
                Outfit Items ({outfits.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Add one or multiple items to this customer order.
              </p>
            </div>
            <Button size="sm" onClick={addOutfit} className="gap-1">
              <Plus className="h-4 w-4" /> Add Outfit
            </Button>
          </div>

          <div className="space-y-4">
            {outfits.map((outfit, index) => (
              <Card key={index} className="relative overflow-hidden border">
                <CardHeader className="bg-muted/30 pb-3 pt-3 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="font-mono bg-background"
                    >
                      #{index + 1}
                    </Badge>
                    <CardTitle className="text-sm font-medium">
                      {outfit.name || `Outfit Item ${index + 1}`}
                    </CardTitle>
                  </div>
                  {outfits.length > 1 && (
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
                      <Label className="text-xs font-semibold">Estimated price (₹)</Label>
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
                        />
                      </div>
                    </div>

                    {/* Occasion */}
                    {/* <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Occasion</Label>
                      <Input
                        value={outfit.occasion}
                        onChange={(e) =>
                          updateOutfit(index, "occasion", e.target.value)
                        }
                        placeholder="e.g., Reception, Sangeet"
                      />
                    </div> */}

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
                        updateOutfit(index, "maggamRequired", Boolean(checked))
                      }
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

                  {/* Fabric Images Upload */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <ImagePlus className="h-3.5 w-3.5 text-primary" />
                      Customer Material Images
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Upload photos of the customer's fabric material (optional)
                    </p>

                    {/* Image Previews */}
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

                    {/* Upload Button */}
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        htmlFor={`fabric-upload-${index}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md cursor-pointer hover:bg-muted transition-colors"
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        {outfit.fabricImages.length > 0
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
                        <span className="inline-flex items-center gap-1.5">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-3.5 w-3.5"
                          >
                            <path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3l-1.5-2Z" />
                            <circle cx="12" cy="12" r="3.5" />
                          </svg>
                          Take Photo
                        </span>
                      </Button>
                    </div>

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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right Column: Customer & Payment Sidebar (5 cols) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
          {/* Customer Selection Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                Customer Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {preselectedCustomerId && selectedCustomer ? (
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
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />{" "}
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

                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span>Advance Payment (₹)</span>
                    <CreditCard className="h-3 w-3 text-muted-foreground" />
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={advanceAmount}
                      onChange={(e) => setAdvanceAmount(e.target.value)}
                      placeholder="0.00"
                      className="bg-background flex-1"
                    />
                    <select
                      value={advanceMethod}
                      onChange={(e) => setAdvanceMethod(e.target.value)}
                      className="flex h-9 rounded-md border border-input bg-background px-2 text-xs w-28"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="CARD">Card</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="font-medium text-muted-foreground">
                    Balance Due
                  </span>
                  <span
                    className={`font-bold text-sm ${
                      balanceDue < 0 ? "text-destructive" : "text-emerald-600"
                    }`}
                  >
                    ₹{balanceDue > 0 ? balanceDue.toLocaleString() : 0}
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

              {/* Form Submission Button */}
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit || createMutation.isPending}
                className="w-full"
                size="lg"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Order...
                  </>
                ) : (
                  `Create Order (${validOutfitCount} Item${
                    validOutfitCount !== 1 ? "s" : ""
                  })`
                )}
              </Button>

              {createMutation.error && (
                <p className="text-xs font-medium text-destructive text-center">
                  {(createMutation.error as Error).message}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
