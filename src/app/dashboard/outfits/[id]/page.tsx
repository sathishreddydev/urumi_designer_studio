"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ImageViewer } from "@/components/image-viewer";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Lock,
  Unlock,
  Trash2,
  CheckCircle,
  Image as ImageIcon,
  AlertTriangle,
  Clock,
  ArrowRight,
  Ruler,
  Calendar,
  UserCheck,
  Scissors,
  FileText,
  History,
  Layers,
  Camera,
} from "lucide-react";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "@/hooks/use-toast";

const DEPENDENCY_TYPES = [
  "FABRIC",
  "LINING",
  "DYEING",
  "ACCESSORIES",
  "STONES",
  "CANVAS",
  "CUPS",
];

// Garment-specific measurement fields per outfit type.
// These are the stitching-specific dimensions that vary per garment,
// separate from the customer's body measurements.
const GARMENT_FIELDS: Record<string, string[]> = {
  "Bridal Blouse":     ["Front Length", "Back Length", "Neck Front", "Neck Back", "Sleeve Round", "Armhole"],
  "Reception Blouse":  ["Front Length", "Back Length", "Neck Front", "Neck Back", "Sleeve Round", "Armhole"],
  "Saree Blouse":      ["Front Length", "Back Length", "Neck Front", "Neck Back", "Sleeve Round", "Armhole"],
  Lehenga:             ["Lehenga Length", "Flare / Gher", "Waist Band"],
  Gown:                ["Full Length", "Yoke Length", "Neck Front", "Neck Back", "Slit Start"],
  Kurta:               ["Kurti Length", "Neck Front", "Neck Back", "Side Slit Start"],
  Anarkali:            ["Anarkali Length", "Yoke Length", "Neck Front", "Neck Back", "Flare / Gher"],
  Sharara:             ["Top Length", "Sharara Length", "Neck Front"],
  Other:               ["Length", "Neck Front", "Neck Back"],
};

// Mirrored body section definitions — used for grouped display on outfit detail page
const BODY_SECTIONS = [
  {
    num: "01",
    title: "UPPER BODY",
    fields: ["Shoulder Length", "Upper Bust", "Bust", "Lower Bust", "Waist", "Lower Waist", "Hip"],
  },
  {
    num: "02",
    title: "APEX & SLEEVES",
    fields: ["Apex Point", "Apex Down", "Apex Gap", "Sleeve Length", "Sleeve Loose", "Armhole", "Neck Front", "Neck Back"],
  },
  {
    num: "03",
    title: "BOTTOM (PANT)",
    fields: ["Pant Length", "Pant Waist", "Hip / Seat", "Crotch (Rise)", "Thigh", "Knee", "Ankle", "Bottom Loose"],
  },
] as const;

const ALL_BODY_FIELD_NAMES: string[] = BODY_SECTIONS.flatMap((s) => s.fields as unknown as string[]);

export default function OutfitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can, role } = usePermissions();

  const [whatsappPrompt, setWhatsappPrompt] = useState<{
    customerName: string;
    url: string;
  } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  // Garment-specific measurements (editable inline)
  const [garmentMeasurements, setGarmentMeasurements] = useState<Record<string, string>>({});
  const [garmentMeasurementsDirty, setGarmentMeasurementsDirty] = useState(false);

  // Fetch outfit detail
  const { data: outfit, isLoading } = useQuery({
    queryKey: ["outfit", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/outfits/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Seed garment measurements from saved data when outfit loads
  useEffect(() => {
    if (outfit) {
      const saved = (outfit.garmentMeasurements as Record<string, string>) || {};
      // If no saved garment measurements yet, pre-populate fields from the type template
      if (Object.keys(saved).length === 0) {
        const typeKey = Object.keys(GARMENT_FIELDS).find(
          (k) => k.toLowerCase() === (outfit.type || "").toLowerCase()
        ) || outfit.type;
        const templateFields = GARMENT_FIELDS[typeKey] || GARMENT_FIELDS["Other"] || [];
        const empty: Record<string, string> = {};
        templateFields.forEach((f) => { empty[f] = ""; });
        setGarmentMeasurements(empty);
      } else {
        setGarmentMeasurements(saved);
      }
      setGarmentMeasurementsDirty(false);
    }
  }, [outfit?.id]);

  // Fetch available transitions
  const { data: transitions } = useQuery({
    queryKey: ["outfit-transitions", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/outfits/${params.id}/transition`);
      if (!res.ok) return { availableTransitions: [] };
      return res.json();
    },
    enabled: !!outfit,
  });

  // Transition mutation
  const transitionMutation = useMutation({
    mutationFn: async ({
      newStatus,
      notes,
    }: {
      newStatus: string;
      notes?: string;
    }) => {
      const res = await fetch(`/api/outfits/${params.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus, notes }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Transition failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["outfit", params.id] });
      queryClient.invalidateQueries({
        queryKey: ["outfit-transitions", params.id],
      });
      toast({
        title: "Status updated",
        description: "Outfit transitioned successfully.",
      });

      if (data.notifyCustomer?.whatsappUrl) {
        setWhatsappPrompt({
          customerName: data.notifyCustomer.customerName,
          url: data.notifyCustomer.whatsappUrl,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Transition failed",
        description: error.message || "Could not update outfit status.",
      });
    },
  });

  // Update outfit fields
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/outfits/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outfit", params.id] });
      toast({ title: "Updated", description: "Outfit details saved." });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    },
  });

  // Add dependency
  const addDependencyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/outfits/${params.id}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outfit", params.id] });
      toast({
        title: "Dependency raised",
        description: "Dependency added to this outfit.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed",
        description: error.message,
      });
    },
  });

  // Lock references
  const lockRefsMutation = useMutation({
    mutationFn: async (data: { type: string }) => {
      const res = await fetch(`/api/outfits/${params.id}/references`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lock", type: data.type }),
      });
      if (!res.ok) throw new Error("Failed to lock");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outfit", params.id] });
      queryClient.invalidateQueries({
        queryKey: ["outfit-transitions", params.id],
      });
    },
  });

  // Unlock references
  const unlockRefsMutation = useMutation({
    mutationFn: async (data: { type: string }) => {
      const res = await fetch(`/api/outfits/${params.id}/references`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock", type: data.type }),
      });
      if (!res.ok) throw new Error("Failed to unlock");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outfit", params.id] });
      queryClient.invalidateQueries({
        queryKey: ["outfit-transitions", params.id],
      });
    },
  });

  // Lock single reference
  const lockSingleMutation = useMutation({
    mutationFn: async (refId: string) => {
      const res = await fetch(`/api/outfits/${params.id}/references`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lock-single", id: refId }),
      });
      if (!res.ok) throw new Error("Failed to lock");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outfit", params.id] });
    },
  });

  // Unlock single reference
  const unlockSingleMutation = useMutation({
    mutationFn: async (refId: string) => {
      const res = await fetch(`/api/outfits/${params.id}/references`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock-single", id: refId }),
      });
      if (!res.ok) throw new Error("Failed to unlock");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outfit", params.id] });
    },
  });

  // Upload reference
  const uploadRefMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url, filename } = await uploadRes.json();

      const res = await fetch(`/api/outfits/${params.id}/references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, url, filename }),
      });
      if (!res.ok) throw new Error("Failed to save reference");
      return res.json();
    },
    onMutate: async ({ type }: { file: File; type: string }) => {
      setUploadingType(type);
    },
    onSettled: () => {
      setUploadingType(null);
      queryClient.invalidateQueries({ queryKey: ["outfit", params.id] });
    },
  });

  // Delete reference
  const deleteRefMutation = useMutation({
    mutationFn: async (refId: string) => {
      const res = await fetch(`/api/references/${refId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outfit", params.id] });
    },
  });

  // Delete outfit
  const deleteOutfitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/outfits/${params.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Outfit deleted successfully." });
      router.push("/dashboard/outfits");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-96 animate-pulse rounded bg-muted lg:col-span-4" />
          <div className="h-96 animate-pulse rounded bg-muted lg:col-span-8" />
        </div>
      </div>
    );
  }

  if (!outfit) return <p className="text-muted-foreground">Outfit not found</p>;

  const availableTransitions = transitions?.availableTransitions || [];
  const patternRefs = (outfit.references || []).filter(
    (r: any) => r.type === "PATTERN",
  );
  const maggamRefs = (outfit.references || []).filter(
    (r: any) => r.type === "MAGGAM",
  );
  const fabricRefs = (outfit.references || []).filter(
    (r: any) => r.type === "FABRIC",
  );

  const materialLockedStatuses = [
    "PATTERN_DRAFTING",
    "MAGGAM_WORK",
    "MAGGAM_REVIEW",
    "FABRIC_CUTTING",
    "STITCHING",
    "PRODUCTION_COMPLETED",
    "TRIAL",
    "ALTERATION",
    "QC",
    "READY_FOR_DELIVERY",
    "DELIVERED",
  ];
  const canManageCustomerMaterial =
    (role === "ADMIN" || role === "RECEPTION") &&
    !materialLockedStatuses.includes(outfit.status);

  const lockedStatuses = [
    "PRODUCTION_COMPLETED",
    "TRIAL",
    "ALTERATION",
    "QC",
    "READY_FOR_DELIVERY",
    "DELIVERED",
  ];
  const isLocked = lockedStatuses.includes(outfit.status);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/outfits">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold lg:text-2xl truncate">
                {outfit.name}
              </h1>
              <Badge className={getStatusColor(outfit.status)}>
                {formatStatus(outfit.status)}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {outfit.customer?.name && (
                <span className="font-medium text-foreground">
                  {outfit.customer.name}
                </span>
              )}
              {outfit.customer?.name && " · "}
              {outfit.type}
              {outfit.maggamRequired && " · Maggam Required"}
              {outfit.customer?.occasion && ` · ${outfit.customer.occasion}`}
            </p>
          </div>
        </div>

        {/* Workflow Actions */}
        <div className="flex items-center gap-2">
          {availableTransitions.map((t: any) => (
            <LoadingButton
              key={t.status}
              size="sm"
              loading={transitionMutation.isPending}
              onClick={() => transitionMutation.mutate({ newStatus: t.status })}
            >
              <ArrowRight className="h-3 w-3 mr-1" /> {t.label}
            </LoadingButton>
          ))}
          {can("delete", "outfit") && (
            <Button
              variant="outline"
              size="icon"
              className="text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Metadata & Measurements (Clean List Layout) */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-4">
          {/* Key Outfit Details */}
          <div className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2 border-b pb-2">
              <Scissors className="h-4 w-4" /> Outfit Summary
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Trial Date
                </span>
                <span className="font-medium">
                  {formatDate(outfit.trialDate)}
                </span>
              </div>
              <Separator />

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Delivery Date
                </span>
                <span className="font-medium">
                  {formatDate(outfit.deliveryDate)}
                </span>
              </div>
              <Separator />

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5" /> Designer
                </span>
                <span className="font-medium">
                  {outfit.designer?.name || "Not assigned"}
                </span>
              </div>
              <Separator />

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5" /> Master
                </span>
                <div className="w-1/2">
                  {can("update", "outfit") && role !== "MASTER" ? (
                    <AssignMasterSelect
                      outfitId={outfit.id}
                      currentMasterId={outfit.masterId}
                      onAssign={(masterId) =>
                        updateMutation.mutate({ masterId })
                      }
                    />
                  ) : (
                    <span className="font-medium float-right">
                      {outfit.master?.name || outfit.masterId || "Not assigned"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Measurements */}
          <div className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2 border-b pb-2">
              <Ruler className="h-4 w-4" /> Measurements
            </h2>

            {/* ── BODY MEASUREMENTS (snapshot, read-only) ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Body</p>
                {outfit.customerMeasurements && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">v{outfit.customerMeasurements.version}</span>
                    {outfit.measurementIsSnapshot ? (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">at order time</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300 bg-amber-50">latest</Badge>
                    )}
                  </div>
                )}
              </div>

              {outfit.customerMeasurements ? (
                <div className="space-y-1.5">
                  {!outfit.measurementIsSnapshot && outfit.measurementSnapshotId === null && outfit.customer?.id && role !== "MASTER" && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Showing latest — created before snapshots were tracked.
                    </p>
                  )}

                  {/* Sectioned body measurements */}
                  {BODY_SECTIONS.map((section) => {
                    const vals = outfit.customerMeasurements.values as Record<string, string>;
                    const entries = (section.fields as unknown as string[])
                      .map((f) => [f, vals[f]] as [string, string])
                      .filter(([, v]) => v);
                    if (!entries.length) return null;
                    return (
                      <div key={section.num} className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-primary/60 tabular-nums">{section.num}</span>
                          <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground">{section.title}</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                        <div className="grid grid-cols-3 gap-x-3 gap-y-0.5">
                          {entries.map(([field, value]) => (
                            <div key={field} className="flex justify-between items-center border-b border-muted/40 py-0.5">
                              <span className="text-[11px] text-muted-foreground">{field}</span>
                              <span className="text-[11px] font-semibold">{value}"</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Custom fields not in standard sections */}
                  {(() => {
                    const vals = outfit.customerMeasurements.values as Record<string, string>;
                    const extras = Object.entries(vals).filter(([k, v]) => !ALL_BODY_FIELD_NAMES.includes(k) && v);
                    if (!extras.length) return null;
                    return (
                      <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 pt-1">
                        {extras.map(([field, value]) => (
                          <div key={field} className="flex justify-between items-center border-b border-muted/40 py-0.5">
                            <span className="text-[11px] text-muted-foreground">{field}</span>
                            <span className="text-[11px] font-semibold">{value}"</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {outfit.customer?.id && role !== "MASTER" && (
                    <Link href={`/dashboard/customers/${outfit.customer.id}`} className="text-[11px] text-primary hover:underline mt-1 inline-block">
                      Edit body measurements →
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-1">
                  No body measurements.{" "}
                  {outfit.customer?.id && role !== "MASTER" && (
                    <Link href={`/dashboard/customers/${outfit.customer.id}`} className="text-primary hover:underline">Add →</Link>
                  )}
                </p>
              )}
            </div>

            <Separator />

            {/* ── GARMENT MEASUREMENTS (outfit-specific, editable) ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Garment · <span className="normal-case font-normal">{outfit.type}</span>
                </p>
                {garmentMeasurementsDirty && (
                  <Button
                    size="xs"
                    className="h-6 text-[11px] px-2"
                    onClick={() => {
                      updateMutation.mutate({ garmentMeasurements });
                      setGarmentMeasurementsDirty(false);
                    }}
                  >
                    Save
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                {Object.entries(garmentMeasurements).map(([field, value]) => (
                  <div key={field} className="space-y-0.5">
                    <label className="text-[11px] text-muted-foreground">{field}</label>
                    <Input
                      value={value}
                      onChange={(e) => {
                        setGarmentMeasurements((prev) => ({ ...prev, [field]: e.target.value }));
                        setGarmentMeasurementsDirty(true);
                      }}
                      placeholder="in inches"
                      inputMode="decimal"
                      className="h-7 text-xs px-2"
                    />
                  </div>
                ))}
              </div>

              {Object.keys(garmentMeasurements).length === 0 && (
                <p className="text-xs text-muted-foreground italic">No fields for this garment type.</p>
              )}
            </div>
          </div>

          {/* Customer Material */}
          <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
            <CustomerMaterialSection
              references={fabricRefs}
              canUpload={canManageCustomerMaterial}
              isUploading={uploadingType === "FABRIC"}
              onUpload={(file) =>
                uploadRefMutation.mutate({ file, type: "FABRIC" })
              }
              onDelete={(refId) => deleteRefMutation.mutate(refId)}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Accordion Workflow Sections */}
        <div className="lg:col-span-8">
          <Accordion
            type="multiple"
            defaultValue={role === "MASTER" ? ["references", "dependencies"] : ["references", "dependencies", "design"]}
            className="w-full space-y-4"
          >
            {/* References Section */}
            <AccordionItem
              value="references"
              className="border rounded-lg bg-card px-4"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  {role === "MASTER" ? "Approved References" : "Visual References"}
                  <Badge variant="outline" className="ml-2 text-xs">
                    {/* Count only PATTERN + MAGGAM refs — FABRIC lives in Customer Material */}
                    {(outfit.references || []).filter((r: any) => r.type === "PATTERN" || r.type === "MAGGAM").length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-6">
                {role === "MASTER" ? (
                  // MASTER view — read-only, shows only LOCKED references (already filtered by API)
                  <>
                    {patternRefs.length === 0 && maggamRefs.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                        No approved references yet. The designer will lock references before production starts.
                      </p>
                    ) : (
                      <>
                        {patternRefs.length > 0 && (
                          <ReferenceSection
                            title="Pattern References"
                            type="PATTERN"
                            references={patternRefs}
                            canUpload={false}
                            canSelect={false}
                            canLock={false}
                            isUploading={false}
                            onUpload={() => {}}
                            onSelect={() => {}}
                            onLock={() => {}}
                            onUnlock={() => {}}
                            onDelete={() => {}}
                            onLockSingle={() => {}}
                            onUnlockSingle={() => {}}
                          />
                        )}
                        {maggamRefs.length > 0 && (
                          <ReferenceSection
                            title="Maggam References"
                            type="MAGGAM"
                            references={maggamRefs}
                            canUpload={false}
                            canSelect={false}
                            canLock={false}
                            isUploading={false}
                            onUpload={() => {}}
                            onSelect={() => {}}
                            onLock={() => {}}
                            onUnlock={() => {}}
                            onDelete={() => {}}
                            onLockSingle={() => {}}
                            onUnlockSingle={() => {}}
                          />
                        )}
                      </>
                    )}
                  </>
                ) : (
                  // Designer / Admin view — full upload/lock controls
                  <>
                    <ReferenceSection
                      title="Pattern References"
                      type="PATTERN"
                      references={patternRefs}
                      canUpload={!isLocked && can("upload", "reference")}
                      canSelect={!isLocked && can("select", "reference")}
                      canLock={!isLocked && can("lock", "reference")}
                      isUploading={uploadingType === "PATTERN"}
                      onUpload={(file) =>
                        uploadRefMutation.mutate({ file, type: "PATTERN" })
                      }
                      onSelect={() => {}}
                      onLock={() => lockRefsMutation.mutate({ type: "PATTERN" })}
                      onUnlock={() =>
                        unlockRefsMutation.mutate({ type: "PATTERN" })
                      }
                      onDelete={(refId) => deleteRefMutation.mutate(refId)}
                      onLockSingle={(refId) => lockSingleMutation.mutate(refId)}
                      onUnlockSingle={(refId) => unlockSingleMutation.mutate(refId)}
                    />

                    {outfit.maggamRequired && (
                      <ReferenceSection
                        title="Maggam References"
                        type="MAGGAM"
                        references={maggamRefs}
                        canUpload={!isLocked && can("upload", "reference")}
                        canSelect={!isLocked && can("select", "reference")}
                        canLock={!isLocked && can("lock", "reference")}
                        isUploading={uploadingType === "MAGGAM"}
                        onUpload={(file) =>
                          uploadRefMutation.mutate({ file, type: "MAGGAM" })
                        }
                        onSelect={() => {}}
                        onLock={() => lockRefsMutation.mutate({ type: "MAGGAM" })}
                        onUnlock={() =>
                          unlockRefsMutation.mutate({ type: "MAGGAM" })
                        }
                        onDelete={(refId) => deleteRefMutation.mutate(refId)}
                        onLockSingle={(refId) => lockSingleMutation.mutate(refId)}
                        onUnlockSingle={(refId) =>
                          unlockSingleMutation.mutate(refId)
                        }
                      />
                    )}
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Dependencies Section */}
            {can("read", "dependency") && (
              <AccordionItem
                value="dependencies"
                className="border rounded-lg bg-card px-4"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-2 text-base font-semibold">
                    <Layers className="h-5 w-5 text-primary" />
                    Material Dependencies
                    <Badge variant="outline" className="ml-2 text-xs">
                      {(outfit.dependencies || []).length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4 space-y-4">
                  {!isLocked && can("create", "dependency") && (
                    <Card>
                      <CardContent className="pt-4 pb-4">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const form = new FormData(e.currentTarget);
                            addDependencyMutation.mutate({
                              type: form.get("type"),
                              notes: form.get("notes"),
                            });
                            e.currentTarget.reset();
                          }}
                          className="flex flex-col gap-3 sm:flex-row sm:items-end"
                        >
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Raise Dependency</Label>
                            <Select name="type">
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                {DEPENDENCY_TYPES.map((t) => (
                                  <SelectItem key={t} value={t}>
                                    {t}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Input
                            name="notes"
                            placeholder="Notes"
                            className="h-9 flex-1"
                          />
                          <LoadingButton
                            size="sm"
                            type="submit"
                            loading={addDependencyMutation.isPending}
                            loadingText="Raising..."
                          >
                            Raise
                          </LoadingButton>
                        </form>
                      </CardContent>
                    </Card>
                  )}

                  {(outfit.dependencies || []).length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground border rounded-lg">
                      <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
                      No dependencies raised
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(outfit.dependencies || []).map((dep: any) => (
                        <Card key={dep.id}>
                          <CardContent className="flex items-center justify-between pt-3 pb-3">
                            <div className="flex items-center gap-2">
                              {dep.status === "AVAILABLE" ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : dep.status === "BLOCKED" ? (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              ) : (
                                <Clock className="h-4 w-4 text-yellow-500" />
                              )}
                              <div>
                                <p className="text-sm font-medium">
                                  {dep.type.replace(/_/g, " ")}
                                </p>
                                {dep.notes && (
                                  <p className="text-xs text-muted-foreground">
                                    {dep.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {dep.status !== "AVAILABLE" &&
                                !isLocked &&
                                can("update", "dependency") && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      fetch(
                                        `/api/outfits/${params.id}/dependencies`,
                                        {
                                          method: "PATCH",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            dependencyId: dep.id,
                                            status: "AVAILABLE",
                                          }),
                                        },
                                      ).then(() => {
                                        queryClient.invalidateQueries({
                                          queryKey: ["outfit", params.id],
                                        });
                                        queryClient.invalidateQueries({
                                          queryKey: [
                                            "outfit-transitions",
                                            params.id,
                                          ],
                                        });
                                      });
                                    }}
                                  >
                                    Resolve
                                  </Button>
                                )}
                              <Badge
                                variant={
                                  dep.status === "AVAILABLE"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {dep.status}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Design & Fitting Notes */}
            {can("update", "outfit") && role !== "MASTER" && (
              <AccordionItem
                value="design"
                className="border rounded-lg bg-card px-4"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-2 text-base font-semibold">
                    <FileText className="h-5 w-5 text-primary" />
                    Design & Fitting Instructions
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4 space-y-4">
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">
                      Designer Instructions
                    </Label>
                    <Textarea
                      defaultValue={outfit.designerNotes || ""}
                      placeholder="Design notes, neck pattern preferences, embellishments..."
                      rows={3}
                      onBlur={(e) => {
                        if (e.target.value !== (outfit.designerNotes || "")) {
                          updateMutation.mutate({
                            designerNotes: e.target.value,
                          });
                        }
                      }}
                    />
                    <Textarea
                      defaultValue={outfit.specialInstructions || ""}
                      placeholder="Special tailoring instructions..."
                      rows={2}
                      onBlur={(e) => {
                        if (
                          e.target.value !== (outfit.specialInstructions || "")
                        ) {
                          updateMutation.mutate({
                            specialInstructions: e.target.value,
                          });
                        }
                      }}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">
                      Trial & Alterations
                    </Label>
                    <Textarea
                      defaultValue={outfit.trialNotes || ""}
                      placeholder="Fit feedback during trial..."
                      rows={2}
                      onBlur={(e) => {
                        if (e.target.value !== (outfit.trialNotes || "")) {
                          updateMutation.mutate({ trialNotes: e.target.value });
                        }
                      }}
                    />
                    <Textarea
                      defaultValue={outfit.alterationNotes || ""}
                      placeholder="Alteration fixes (e.g., shorten sleeves, tighten waist)..."
                      rows={2}
                      onBlur={(e) => {
                        if (e.target.value !== (outfit.alterationNotes || "")) {
                          updateMutation.mutate({
                            alterationNotes: e.target.value,
                          });
                        }
                      }}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Timeline & Production History */}
            <AccordionItem
              value="timeline"
              className="border rounded-lg bg-card px-4"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <History className="h-5 w-5 text-primary" />
                  Production Timeline
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                {(outfit.productionLogs || []).length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground border rounded-lg">
                    No activity recorded yet
                  </div>
                ) : (
                  <div className="space-y-3 pl-2">
                    {(outfit.productionLogs || []).map((log: any) => (
                      <div
                        key={log.id}
                        className="flex gap-3 items-start text-sm"
                      >
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        <div>
                          <Badge
                            className={getStatusColor(log.status)}
                            variant="secondary"
                          >
                            {formatStatus(log.status)}
                          </Badge>
                          {log.notes && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {log.notes}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDate(log.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* WhatsApp Dialog */}
      <AlertDialog
        open={!!whatsappPrompt}
        onOpenChange={(open) => !open && setWhatsappPrompt(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notify Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Outfit is ready! Would you like to notify{" "}
              {whatsappPrompt?.customerName} via WhatsApp?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Skip</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (whatsappPrompt?.url) {
                  window.open(whatsappPrompt.url, "_blank");
                }
                setWhatsappPrompt(null);
              }}
            >
              Send WhatsApp
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Outfit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{outfit.name}&quot;? This
              will permanently remove all references, dependencies, and
              production logs for this outfit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteOutfitMutation.mutate()}
            >
              Delete Outfit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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
        streamRef.current.getTracks().forEach((track) => track.stop());
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
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }
      } catch {
        if (!cancelled) {
          setError(
            "Camera access was blocked or unavailable. Please use Upload Image instead.",
          );
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
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
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `camera-${Date.now()}.jpg`, {
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

// ─── REFERENCE SECTION COMPONENT ────────────────────────────────────────────

function ReferenceSection({
  title,
  references,
  canUpload,
  canLock,
  isUploading,
  onUpload,
  onDelete,
  onLockSingle,
  onUnlockSingle,
}: {
  title: string;
  type: string;
  references: any[];
  canUpload: boolean;
  canSelect: boolean;
  canLock: boolean;
  isUploading?: boolean;
  onUpload: (file: File) => void;
  onSelect: (ids: string[]) => void;
  onLock: () => void;
  onUnlock: () => void;
  onDelete: (refId: string) => void;
  onLockSingle: (refId: string) => void;
  onUnlockSingle: (refId: string) => void;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [deleteRefId, setDeleteRefId] = useState<string | null>(null);
  const [loadingRefId, setLoadingRefId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  function openViewer(index: number) {
    setViewerIndex(index);
    setViewerOpen(true);
  }

  async function handleLockToggle(refId: string, isLocked: boolean) {
    setLoadingRefId(refId);
    try {
      if (isLocked) {
        onUnlockSingle(refId);
      } else {
        onLockSingle(refId);
      }
    } finally {
      setTimeout(() => setLoadingRefId(null), 600);
    }
  }

  async function handleDelete(refId: string) {
    setLoadingRefId(refId);
    setDeleteRefId(null);
    onDelete(refId);
    setTimeout(() => setLoadingRefId(null), 600);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          {title}
        </h3>
        {canUpload && (
          <div className="flex items-center gap-2">
            {isUploading ? (
              <LoadingButton
                size="sm"
                variant="outline"
                loading={true}
                loadingText="Uploading..."
              />
            ) : (
              <>
                <label>
                  <Button size="sm" variant="outline" asChild>
                    <span>
                      <Plus className="h-3 w-3 mr-1" /> Upload Image
                    </span>
                  </Button>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files) {
                        Array.from(files).forEach((file) => onUpload(file));
                      }
                    }}
                  />
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCameraOpen(true)}
                >
                  <span className="inline-flex items-center gap-1.5">
  <Camera className="h-3.5 w-3.5" />
  Take Photo
</span>
                </Button>
                <CameraCaptureModal
                  open={cameraOpen}
                  onClose={() => setCameraOpen(false)}
                  onCapture={(file) => onUpload(file)}
                />
              </>
            )}
          </div>
        )}
      </div>

      {references.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
          No references uploaded
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {references.map((ref: any, index: number) => {
            const isLocked = ref.status === "LOCKED";
            const isLoading = loadingRefId === ref.id;

            return (
              <div
                key={ref.id}
                className={`relative rounded-lg border-2 overflow-hidden transition-all ${
                  isLocked
                    ? "border-green-500"
                    : ref.isCustomerUpload
                      ? "border-dashed border-blue-300"
                      : "border-transparent hover:border-muted-foreground/30"
                }`}
              >
                <img
                  src={ref.url}
                  alt=""
                  className="aspect-square w-full object-cover cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => openViewer(index)}
                />

                {isLoading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                )}

                {canLock && !isLoading && (
                  <button
                    className={`absolute top-1.5 right-1.5 rounded-full p-1.5 ${
                      isLocked
                        ? "bg-green-600 text-white"
                        : "bg-black/60 text-white hover:bg-black/80"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLockToggle(ref.id, isLocked);
                    }}
                    aria-label={isLocked ? "Unlock" : "Lock"}
                  >
                    {isLocked ? (
                      <Lock className="h-3 w-3" />
                    ) : (
                      <Unlock className="h-3 w-3" />
                    )}
                  </button>
                )}

                {!isLoading && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 flex items-center justify-between">
                    <span
                      className={`text-[10px] font-medium ${
                        isLocked
                          ? "text-green-300"
                          : ref.isCustomerUpload
                            ? "text-yellow-300"
                            : "text-gray-300"
                      }`}
                    >
                      {ref.isCustomerUpload
                        ? "Customer"
                        : isLocked
                          ? "Locked"
                          : "Draft"}
                    </span>
                    {canUpload && !isLocked && !ref.isCustomerUpload && (
                      <button
                        className="text-red-400 hover:text-red-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteRefId(ref.id);
                        }}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ImageViewer
        images={references}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />

      <AlertDialog
        open={!!deleteRefId}
        onOpenChange={(open) => !open && setDeleteRefId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reference</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this image? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteRefId) {
                  handleDelete(deleteRefId);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── ASSIGN MASTER SELECT ───────────────────────────────────────────────────

function AssignMasterSelect({
  currentMasterId,
  onAssign,
}: {
  outfitId: string;
  currentMasterId: string | null;
  onAssign: (masterId: string) => void;
}) {
  const { isAdmin, role } = usePermissions();

  // Only ADMIN and DESIGNER can assign masters — guard the query
  const canFetch = isAdmin || role === "DESIGNER";

  const { data: staff } = useQuery({
    queryKey: ["staff-masters"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) return [];
      const users = await res.json();
      return users.filter((u: any) => u.role === "MASTER" && u.active);
    },
    enabled: canFetch,
  });

  if (!canFetch) return null;

  return (
    <select
      className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
      value={currentMasterId || ""}
      onChange={(e) => onAssign(e.target.value)}
    >
      <option value="">Select Master</option>
      {(staff || []).map((m: any) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

// ─── CUSTOMER MATERIAL SECTION (Simple display only) ────────────────────────

function CustomerMaterialSection({
  references,
  canUpload,
  isUploading,
  onUpload,
  onDelete,
}: {
  references: any[];
  canUpload: boolean;
  isUploading?: boolean;
  onUpload: (file: File) => void;
  onDelete: (refId: string) => void;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [deleteRefId, setDeleteRefId] = useState<string | null>(null);
  const [loadingRefId, setLoadingRefId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  async function handleDelete(refId: string) {
    setLoadingRefId(refId);
    setDeleteRefId(null);
    onDelete(refId);
    setTimeout(() => setLoadingRefId(null), 600);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          Customer Material
        </h3>

        {canUpload && (
          <div className="flex items-center gap-2">
            {isUploading ? (
              <LoadingButton
                size="sm"
                variant="outline"
                loading={true}
                loadingText="Uploading..."
              />
            ) : (
              <>
                <label>
                  <Button size="sm" variant="outline" asChild>
                    <span>
                      <Plus className="h-3 w-3 mr-1" /> Upload
                    </span>
                  </Button>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files) {
                        Array.from(files).forEach((file) => onUpload(file));
                      }
                    }}
                  />
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCameraOpen(true)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5" />
                    Take Photo
                  </span>
                </Button>
                <CameraCaptureModal
                  open={cameraOpen}
                  onClose={() => setCameraOpen(false)}
                  onCapture={(file) => onUpload(file)}
                />
              </>
            )}
          </div>
        )}
      </div>

      {references.length === 0 ? (
        <div className="py-3 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
          No material images
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {references.map((ref: any, index: number) => {
            const isLoading = loadingRefId === ref.id;

            return (
              <div
                key={ref.id}
                className="relative rounded-lg border overflow-hidden"
              >
                <img
                  src={ref.url}
                  alt="Customer material"
                  className="aspect-square w-full object-cover cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => {
                    setViewerIndex(index);
                    setViewerOpen(true);
                  }}
                />

                {isLoading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                )}

                {canUpload && !isLoading && (
                  <button
                    className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteRefId(ref.id);
                    }}
                    aria-label="Delete material"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ImageViewer
        images={references}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />

      <AlertDialog
        open={!!deleteRefId}
        onOpenChange={(open) => !open && setDeleteRefId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Material</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this customer material image? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteRefId) {
                  handleDelete(deleteRefId);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
