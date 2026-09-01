"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
  ZoomIn,
  IndianRupee,
} from "lucide-react";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "@/hooks/use-toast";
import { VoiceNoteRecorder } from "@/components/voice-note-recorder";
import { VoiceToTextButton } from "@/components/voice-to-text-button";
import { MeasurementZoomModal } from "@/components/measurement-zoom-modal";
import {
  OutfitMeasurements,
  GARMENT_FIELDS,
} from "@/components/outfit-measurements";

const DEPENDENCY_TYPES = [
  "FABRIC",
  "LINING",
  "DYEING",
  "ACCESSORIES",
  "STONES",
  "CANVAS",
  "CUPS",
];



export default function OutfitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { can, role } = usePermissions();

  // Resolve back destination from ?from= param
  const from = searchParams.get("from");
  const orderId = searchParams.get("orderId");
  const backHref =
    from === "production"
      ? "/dashboard/production"
      : from === "stitching-maggam"
        ? "/dashboard/stitching-maggam"
        : from === "order" && orderId
          ? `/dashboard/orders/${orderId}`
          : from === "blockers"
            ? "/dashboard/blockers"
            : from === "appointments"
              ? "/dashboard/appointments"
              : "/dashboard/outfits";
  const backLabel =
    from === "production"
      ? "Production"
      : from === "stitching-maggam"
        ? "Stitching & Maggam"
        : from === "order" && orderId
          ? "Order"
          : from === "blockers"
            ? "Blockers"
            : from === "appointments"
              ? "Appointments"
              : "Outfits";

  const [whatsappPrompt, setWhatsappPrompt] = useState<{
    customerName: string;
    url: string;
  } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [showMeasurementZoom, setShowMeasurementZoom] = useState(false);

  // Garment-specific measurements (editable inline)
  const [garmentMeasurements, setGarmentMeasurements] = useState<
    Record<string, string>
  >({});
  const [garmentMeasurementsDirty, setGarmentMeasurementsDirty] =
    useState(false);

  // Voice notes
  const [voiceNotes, setVoiceNotes] = useState<
    { id: string; url: string; label: string; createdAt: string }[]
  >([]);

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
      const saved =
        (outfit.garmentMeasurements as Record<string, string>) || {};
      // If no saved garment measurements yet, pre-populate fields from the type template
      if (Object.keys(saved).length === 0) {
        const typeKey =
          Object.keys(GARMENT_FIELDS).find(
            (k) => k.toLowerCase() === (outfit.type || "").toLowerCase(),
          ) || outfit.type;
        const templateFields =
          GARMENT_FIELDS[typeKey] || GARMENT_FIELDS["Other"] || [];
        const empty: Record<string, string> = {};
        templateFields.forEach((f) => {
          empty[f] = "";
        });
        setGarmentMeasurements(empty);
      } else {
        setGarmentMeasurements(saved);
      }
      setGarmentMeasurementsDirty(false);
      // Seed voice notes — re-seed whenever server data changes
      setVoiceNotes(outfit.voiceNotes || []);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outfit?.id, outfit?.garmentMeasurements]);

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
    mutationFn: async ({
      file,
      type,
      isWorkPhoto,
    }: {
      file: File;
      type: string;
      isWorkPhoto?: boolean;
    }) => {
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
        body: JSON.stringify({
          type,
          url,
          filename,
          isWorkPhoto: isWorkPhoto === true,
        }),
      });
      if (!res.ok) throw new Error("Failed to save reference");
      return res.json();
    },
    onMutate: async ({
      type,
      isWorkPhoto,
    }: {
      file: File;
      type: string;
      isWorkPhoto?: boolean;
    }) => {
      setUploadingType(isWorkPhoto ? "COMPLETION" : type);
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
      router.push(backHref);
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
          <div className="h-96 animate-pulse rounded bg-muted lg:col-span-7" />
          <div className="h-96 animate-pulse rounded bg-muted lg:col-span-5" />
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
    (r: any) => r.type === "FABRIC" && !r.isWorkPhoto,
  );

  // Completion / work photos — stored as FABRIC type with isWorkPhoto = true
  const completionRefs = (outfit.references || []).filter(
    (r: any) => r.isWorkPhoto === true,
  );

  // Completion photo upload is available from PRODUCTION_COMPLETED onwards
  const completionStatuses = [
    "PRODUCTION_COMPLETED",
    "TRIAL",
    "ALTERATION",
    "QC",
    "READY_FOR_DELIVERY",
    "DELIVERED",
  ];
  const canUploadCompletion =
    (role === "ADMIN" || role === "RECEPTION" || role === "DESIGNER") &&
    completionStatuses.includes(outfit.status);

  const materialLockedStatuses = [
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
      {/* Header — single row: back | title+badge | actions+delete */}
      <div className="flex items-center gap-2 border-b pb-4">
        {/* Back button */}
        <Link href={backHref} className="shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" title={`Back to ${backLabel}`}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        {/* Title + badge + subtitle */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm font-bold sm:text-base lg:text-xl truncate">
              {outfit.name}
            </h1>
            <Badge
              className={`${getStatusColor(outfit.status)} shrink-0 text-[10px] sm:text-xs whitespace-nowrap`}
            >
              {formatStatus(outfit.status)}
            </Badge>
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
            {outfit.customer?.name && (
              <span className="font-medium text-foreground">
                {outfit.customer.name}
              </span>
            )}
            {outfit.customer?.name && " · "}
            {outfit.type}
            {outfit.maggamRequired && " · Maggam"}
          </p>
        </div>

        {/* Right side: action button(s) + delete — always stay on the right */}
        <div className="flex items-center gap-1.5 shrink-0">
          {availableTransitions.map((t: any) => (
            <LoadingButton
              key={t.status}
              size="sm"
              loading={transitionMutation.isPending}
              onClick={() => transitionMutation.mutate({ newStatus: t.status })}
              className="text-xs h-8 px-2.5 whitespace-nowrap"
            >
              <ArrowRight className="h-3 w-3 mr-1 shrink-0" />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">Next</span>
            </LoadingButton>
          ))}
          {can("delete", "outfit") && (
            <Button
              variant="outline"
              size="icon"
              className="text-destructive border-destructive/30 hover:bg-destructive/10 h-8 w-8 shrink-0"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Metadata & Measurements */}
        <div className="lg:col-span-7 space-y-4 lg:overflow-y-auto order-2 lg:order-1">
          <Accordion
            type="multiple"
            defaultValue={
              role === "MASTER"
                ? ["references", "dependencies"]
                : ["references", "dependencies", "design"]
            }
            className="w-full space-y-4"
          >
            {/* References Section */}
            <AccordionItem
              value="references"
              className="border rounded-lg bg-card px-3 sm:px-4"
            >
              <AccordionTrigger className="hover:no-underline py-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                  {role === "MASTER"
                    ? "Approved References"
                    : "Visual References"}
                  <Badge variant="outline" className="ml-1 text-[10px]">
                    {/* Count only PATTERN + MAGGAM refs — FABRIC lives in Customer Material */}
                    {
                      (outfit.references || []).filter(
                        (r: any) => r.type === "PATTERN" || r.type === "MAGGAM",
                      ).length
                    }
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-6">
                {role === "MASTER" ? (
                  // MASTER view — read-only, shows only LOCKED references (already filtered by API)
                  <>
                    {patternRefs.length === 0 && maggamRefs.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                        No approved references yet. The designer will lock
                        references before production starts.
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
                      onLock={() =>
                        lockRefsMutation.mutate({ type: "PATTERN" })
                      }
                      onUnlock={() =>
                        unlockRefsMutation.mutate({ type: "PATTERN" })
                      }
                      onDelete={(refId) => deleteRefMutation.mutate(refId)}
                      onLockSingle={(refId) => lockSingleMutation.mutate(refId)}
                      onUnlockSingle={(refId) =>
                        unlockSingleMutation.mutate(refId)
                      }
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
                        onLock={() =>
                          lockRefsMutation.mutate({ type: "MAGGAM" })
                        }
                        onUnlock={() =>
                          unlockRefsMutation.mutate({ type: "MAGGAM" })
                        }
                        onDelete={(refId) => deleteRefMutation.mutate(refId)}
                        onLockSingle={(refId) =>
                          lockSingleMutation.mutate(refId)
                        }
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
                className="border rounded-lg bg-card px-3 sm:px-4"
              >
                <AccordionTrigger className="hover:no-underline py-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Layers className="h-4 w-4 text-primary shrink-0" />
                    Material Dependencies
                    <Badge variant="outline" className="ml-1 text-[10px]">
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
                              <SelectTrigger className="h-8 rounded px-2 text-xs">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                {DEPENDENCY_TYPES.map((t) => (
                                  <SelectItem
                                    className="text-xs"
                                    key={t}
                                    value={t}
                                  >
                                    {t}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Input
                            name="notes"
                            placeholder="Notes"
                            className="h-9 flex-1 text-xs rounded px-2"
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
            {(can("update", "outfit") || role === "MASTER") && (
              <AccordionItem
                value="design"
                className="border rounded-lg bg-card px-3 sm:px-4"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    Design & Fitting Instructions
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                  <DesignNotesSection
                    outfit={outfit}
                    updateMutation={updateMutation}
                    readOnly={role === "MASTER"}
                    isLocked={isLocked}
                    voiceNotes={voiceNotes}
                    onVoiceNotesChange={(updated) => setVoiceNotes(updated)}
                  />
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Timeline & Production History */}
            <AccordionItem
              value="timeline"
              className="border rounded-lg bg-card px-3 sm:px-4"
            >
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <History className="h-4 w-4 text-primary shrink-0" />
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

            {/* Completion Photos — visible once production is complete */}
            {(completionRefs.length > 0 || canUploadCompletion) && (
              <AccordionItem
                value="completion"
                className="border rounded-lg bg-card px-3 sm:px-4"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Camera className="h-4 w-4 text-primary shrink-0" />
                    Completion Photos
                    <Badge variant="outline" className="ml-2 text-xs">
                      {completionRefs.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                  <CompletionPhotosSection
                    references={completionRefs}
                    canUpload={canUploadCompletion}
                    isUploading={uploadingType === "COMPLETION"}
                    onUpload={(file) =>
                      uploadRefMutation.mutate({
                        file,
                        type: "FABRIC",
                        isWorkPhoto: true,
                      })
                    }
                    onDelete={(refId) => deleteRefMutation.mutate(refId)}
                  />
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>
        {/* RIGHT COLUMN: Accordion Workflow Sections */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4 order-1 lg:order-2">
          {/* Key Outfit Details */}
          <div className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
            <h2 className="text-sm font-semibold flex items-center gap-2 border-b pb-2">
              <Scissors className="h-4 w-4" /> Outfit Summary
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Trial Date
                </span>
                <div className="text-right">
                  <span className="font-medium">{formatDate(outfit.trialDate)}</span>
                  {outfit.trialedAt && (
                    <p className="text-[10px] text-green-600 mt-0.5">
                      Trialed: {formatDate(outfit.trialedAt)}
                    </p>
                  )}
                </div>
              </div>
              <Separator />

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Delivery Date
                </span>
                <div className="text-right">
                  <span className="font-medium">{formatDate(outfit.deliveryDate)}</span>
                  {outfit.deliveredAt && (
                    <p className="text-[10px] text-green-600 mt-0.5">
                      Delivered: {formatDate(outfit.deliveredAt)}
                    </p>
                  )}
                </div>
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

          {/* Price Summary — item price + add-ons */}
          {(outfit.price || (outfit.addOns && outfit.addOns.length > 0)) && (
            <div className="rounded-lg border bg-card p-4 shadow-sm space-y-2 text-xs">
              <h2 className="text-sm font-semibold flex items-center gap-2 border-b pb-2">
                <IndianRupee className="h-4 w-4" /> Price Summary
              </h2>

              {/* Item price row */}
              <div className="flex justify-between items-center py-0.5">
                <span className="text-muted-foreground">{outfit.name}</span>
                <span className="font-medium">
                  {outfit.price
                    ? `₹${Number(outfit.price).toLocaleString()}`
                    : <span className="text-amber-600">Price Pending</span>}
                </span>
              </div>

              {/* Add-on rows */}
              {(outfit.addOns as any[] || []).map((a: any) => (
                <div key={a.id} className="flex justify-between items-start py-0.5 pl-3 border-l-2 border-blue-200 dark:border-blue-800">
                  <div className="text-muted-foreground">
                    <span className="font-medium text-foreground">{a.name}</span>
                    {a.notes && <span className="ml-1 text-muted-foreground">— {a.notes}</span>}
                    <span className="ml-1 text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1 rounded">add-on</span>
                  </div>
                  <span className="font-medium whitespace-nowrap ml-2">₹{Number(a.price).toLocaleString()}</span>
                </div>
              ))}

              {/* Total — only show when both price and add-ons exist */}
              {outfit.price && outfit.addOns && outfit.addOns.length > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center font-semibold pt-0.5">
                    <span>Total</span>
                    <span>
                      ₹{(
                        Number(outfit.price) +
                        (outfit.addOns as any[]).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Measurements */}
          <div className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
            <h2 className="text-sm font-semibold flex items-center gap-2 border-b pb-2">
              <Ruler className="h-4 w-4" /> Measurements
              {outfit.customerMeasurements && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 ml-auto"
                  onClick={() => setShowMeasurementZoom(true)}
                  title="View with calculator"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              )}
            </h2>

            {/* Save garment measurements button — shown when dirty */}
            {garmentMeasurementsDirty && role !== "RECEPTION" && (
              <div className="flex justify-end -mt-2">
                <Button
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={() => {
                    updateMutation.mutate({ garmentMeasurements });
                    setGarmentMeasurementsDirty(false);
                  }}
                >
                  Save
                </Button>
              </div>
            )}

            <OutfitMeasurements
              customerMeasurements={outfit.customerMeasurements}
              measurementIsSnapshot={outfit.measurementIsSnapshot}
              measurementSnapshotId={outfit.measurementSnapshotId}
              customer={outfit.customer}
              outfitType={outfit.type}
              garmentMeasurements={garmentMeasurements}
              onGarmentMeasurementsChange={setGarmentMeasurements}
              onGarmentMeasurementsDirty={() => setGarmentMeasurementsDirty(true)}
              role={role}
            />
          </div>

          {/* Customer Material — accordion */}
          <Accordion
            type="single"
            collapsible
            defaultValue="material"
            className="w-full"
          >
            <AccordionItem
              value="material"
              className="rounded-lg border bg-card px-4"
            >
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                  Customer Material
                  {fabricRefs.length > 0 && (
                    <Badge variant="outline" className="ml-1 text-xs">
                      {fabricRefs.length}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <CustomerMaterialSection
                  references={fabricRefs}
                  canUpload={canManageCustomerMaterial}
                  isUploading={uploadingType === "FABRIC"}
                  onUpload={(file) =>
                    uploadRefMutation.mutate({ file, type: "FABRIC" })
                  }
                  onDelete={(refId) => deleteRefMutation.mutate(refId)}
                />
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

      {/* Measurement Zoom Modal with Calculator */}
      <MeasurementZoomModal
        open={showMeasurementZoom}
        onClose={() => setShowMeasurementZoom(false)}
        customer={{
          id: outfit.customer?.id,
          name: outfit.customer?.name || "Customer",
        }}
        customerMeasurements={outfit.customerMeasurements}
        measurementIsSnapshot={outfit.measurementIsSnapshot}
        measurementSnapshotId={outfit.measurementSnapshotId}
        garmentMeasurements={garmentMeasurements}
        onGarmentMeasurementsChange={setGarmentMeasurements}
        onGarmentMeasurementsDirty={() => setGarmentMeasurementsDirty(true)}
        outfitType={outfit.type}
        role={role}
      />
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
        <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
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
    <Select
      value={currentMasterId || "none"}
      onValueChange={(value) => onAssign(value === "none" ? "" : value)}
    >
      <SelectTrigger className="h-8 rounded px-2 text-xs">
        <SelectValue placeholder="Select Master" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none" className="text-xs">
          Select Master
        </SelectItem>
        {(staff || []).map((m: any) => (
          <SelectItem key={m.id} value={m.id} className="text-xs">
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
        {/* <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          Customer Material
        </h3> */}

        {canUpload && (
          <div className="flex items-center gap-2 ml-auto">
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

// ─── COMPLETION PHOTOS SECTION ───────────────────────────────────────────────

function CompletionPhotosSection({
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
        <div className="flex items-center gap-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground">
            Completion Photos
          </h3>
          <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5 font-medium">
            Finished Work
          </span>
        </div>

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

      <p className="text-[11px] text-muted-foreground">
        Photos of the finished outfit — after stitching is complete.
      </p>

      {references.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground border border-dashed border-emerald-200 rounded-lg bg-emerald-50/40">
          No completion photos yet
          {canUpload && " — upload finished outfit photos above"}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {references.map((ref: any, index: number) => {
            const isLoading = loadingRefId === ref.id;

            return (
              <div
                key={ref.id}
                className="relative rounded-lg border-2 border-emerald-200 overflow-hidden"
              >
                <img
                  src={ref.url}
                  alt="Completed outfit"
                  className="aspect-square w-full object-cover cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => {
                    setViewerIndex(index);
                    setViewerOpen(true);
                  }}
                />

                {/* Finished badge */}
                <div className="absolute top-1.5 left-1.5 bg-emerald-600/90 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">
                  ✓ Done
                </div>

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
                    aria-label="Delete completion photo"
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
            <AlertDialogTitle>Delete Completion Photo</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this completion photo? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteRefId) handleDelete(deleteRefId);
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

// ─── DESIGN NOTES SECTION ─────────────────────────────────────────────────
function DesignNotesSection({
  outfit,
  updateMutation,
  readOnly = false,
  isLocked = false,
  voiceNotes,
  onVoiceNotesChange,
}: {
  outfit: any;
  updateMutation: any;
  readOnly?: boolean;
  isLocked?: boolean;
  voiceNotes?: { id: string; url: string; label: string; createdAt: string }[];
  onVoiceNotesChange?: (
    notes: { id: string; url: string; label: string; createdAt: string }[],
  ) => void;
}) {
  const [designerNotes, setDesignerNotes] = useState(
    outfit.designerNotes || "",
  );
  const [specialInstructions, setSpecialInstructions] = useState(
    outfit.specialInstructions || "",
  );
  const [trialNotes, setTrialNotes] = useState(outfit.trialNotes || "");
  const [alterationNotes, setAlterationNotes] = useState(
    outfit.alterationNotes || "",
  );
  const [localVoiceNotes, setLocalVoiceNotes] = useState(voiceNotes || []);
  const [saving, setSaving] = useState(false);

  // Sync when SSE re-fetches outfit data from server
  useEffect(() => {
    if (readOnly) {
      // Master — always sync to latest server data
      setDesignerNotes(outfit.designerNotes || "");
      setSpecialInstructions(outfit.specialInstructions || "");
      setTrialNotes(outfit.trialNotes || "");
      setAlterationNotes(outfit.alterationNotes || "");
      setLocalVoiceNotes(voiceNotes || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    outfit.designerNotes,
    outfit.specialInstructions,
    outfit.trialNotes,
    outfit.alterationNotes,
    readOnly,
  ]);

  // After a successful save, sync voice notes back in edit mode too
  useEffect(() => {
    if (!readOnly && voiceNotes) {
      setLocalVoiceNotes(voiceNotes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(voiceNotes)]);

  const isDirty =
    designerNotes !== (outfit.designerNotes || "") ||
    specialInstructions !== (outfit.specialInstructions || "") ||
    trialNotes !== (outfit.trialNotes || "") ||
    alterationNotes !== (outfit.alterationNotes || "") ||
    JSON.stringify(localVoiceNotes) !== JSON.stringify(voiceNotes || []);

  function handleSave() {
    if (saving) return;
    setSaving(true);
    updateMutation.mutate(
      {
        designerNotes,
        specialInstructions,
        trialNotes,
        alterationNotes,
        voiceNotes: localVoiceNotes,
      },
      {
        onSuccess: () => setSaving(false),
        onError: () => setSaving(false),
      },
    );
    onVoiceNotesChange?.(localVoiceNotes);
  }

  function handleCancel() {
    setDesignerNotes(outfit.designerNotes || "");
    setSpecialInstructions(outfit.specialInstructions || "");
    setTrialNotes(outfit.trialNotes || "");
    setAlterationNotes(outfit.alterationNotes || "");
    setLocalVoiceNotes(voiceNotes || []);
  }

  return (
    <div className="space-y-4">
      {/* Designer Instructions */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">
          Designer Instructions
        </Label>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Design notes, neck pattern, embellishments
            </span>
            {!readOnly && (
              <VoiceToTextButton
                onTranscript={(text) => {
                  setDesignerNotes((prev: string) =>
                    prev ? prev + " " + text : text,
                  );
                }}
              />
            )}
          </div>
          <div className="px-2">
            <Textarea
              value={designerNotes}
              placeholder={
                readOnly
                  ? "No designer instructions recorded."
                  : "Design notes, neck pattern preferences, embellishments..."
              }
              rows={3}
              readOnly={readOnly}
              className={
                readOnly ? "bg-muted/40 cursor-default resize-none" : ""
              }
              onChange={(e) => {
                if (!readOnly) setDesignerNotes(e.target.value);
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Special tailoring instructions
            </span>
            {!readOnly && (
              <VoiceToTextButton
                onTranscript={(text) => {
                  setSpecialInstructions((prev: string) =>
                    prev ? prev + " " + text : text,
                  );
                }}
              />
            )}
          </div>
          <div className="px-2">
            <Textarea
              value={specialInstructions}
              placeholder={
                readOnly
                  ? "No special instructions recorded."
                  : "Special tailoring instructions..."
              }
              rows={2}
              readOnly={readOnly}
              className={
                readOnly ? "bg-muted/40 cursor-default resize-none" : ""
              }
              onChange={(e) => {
                if (!readOnly) setSpecialInstructions(e.target.value);
              }}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Trial & Alterations */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">
          Trial & Alterations
        </Label>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Fit feedback during trial
            </span>
            {!readOnly && (
              <VoiceToTextButton
                onTranscript={(text) => {
                  setTrialNotes((prev: string) =>
                    prev ? prev + " " + text : text,
                  );
                }}
              />
            )}
          </div>
          <div className="px-2">
            <Textarea
              value={trialNotes}
              placeholder={
                readOnly
                  ? "No trial notes recorded."
                  : "Fit feedback during trial..."
              }
              rows={2}
              readOnly={readOnly}
              className={
                readOnly ? "bg-muted/40 cursor-default resize-none" : ""
              }
              onChange={(e) => {
                if (!readOnly) setTrialNotes(e.target.value);
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Alteration fixes
            </span>
            {!readOnly && (
              <VoiceToTextButton
                onTranscript={(text) => {
                  setAlterationNotes((prev: string) =>
                    prev ? prev + " " + text : text,
                  );
                }}
              />
            )}
          </div>
          <div className="px-2">
            <Textarea
              value={alterationNotes}
              placeholder={
                readOnly
                  ? "No alteration notes recorded."
                  : "Alteration fixes (e.g., shorten sleeves, tighten waist)..."
              }
              rows={2}
              readOnly={readOnly}
              className={
                readOnly ? "bg-muted/40 cursor-default resize-none" : ""
              }
              onChange={(e) => {
                if (!readOnly) setAlterationNotes(e.target.value);
              }}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Voice Notes */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground">
          Voice Notes
        </Label>
        <p className="text-[11px] text-muted-foreground">
          Record verbal instructions — plays back for the tailor in the
          workshop.
        </p>
        <VoiceNoteRecorder
          notes={localVoiceNotes}
          label="Design & Fitting"
          canRecord={!readOnly && !isLocked}
          onAdd={(note) => {
            setLocalVoiceNotes((prev: typeof localVoiceNotes) => [
              ...prev,
              note,
            ]);
          }}
          onDelete={(id) => {
            setLocalVoiceNotes((prev: typeof localVoiceNotes) =>
              prev.filter((n) => n.id !== id),
            );
          }}
        />
      </div>

      {/* Save / Cancel — only for editable mode */}
      {!readOnly && (
        <div className="flex items-center gap-2 pt-1 border-t">
          <Button
            size="sm"
            className="flex-1 h-9"
            disabled={!isDirty || saving}
            onClick={handleSave}
          >
            {saving ? "Saving..." : "Save Instructions"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9"
            disabled={!isDirty || saving}
            onClick={handleCancel}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── ADD-ONS EDITOR ───────────────────────────────────────────────────────────

interface AddOnRow {
  id: string;
  name: string;
  price: string;
  notes: string;
}

function AddOnsEditor({
  addOns,
  canEdit,
  onSave,
  isSaving,
}: {
  addOns: any[];
  canEdit: boolean;
  onSave: (addOns: { id: string; name: string; price: number; notes?: string }[]) => void;
  isSaving: boolean;
}) {
  const [rows, setRows] = useState<AddOnRow[]>(
    addOns.map((a) => ({
      id: a.id || crypto.randomUUID(),
      name: a.name || "",
      price: String(a.price ?? ""),
      notes: a.notes || "",
    })),
  );
  const [dirty, setDirty] = useState(false);

  // Re-sync when server data changes (e.g. after save)
  useEffect(() => {
    setRows(
      addOns.map((a) => ({
        id: a.id || crypto.randomUUID(),
        name: a.name || "",
        price: String(a.price ?? ""),
        notes: a.notes || "",
      })),
    );
    setDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(addOns)]);

  function update(idx: number, field: keyof AddOnRow, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    setDirty(true);
  }

  function addRow() {
    setRows((prev) => [...prev, { id: crypto.randomUUID(), name: "", price: "", notes: "" }]);
    setDirty(true);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }

  function handleSave() {
    onSave(
      rows
        .filter((r) => r.name.trim() && r.price)
        .map((r) => ({ id: r.id, name: r.name.trim(), price: Number(r.price), notes: r.notes.trim() || undefined })),
    );
    setDirty(false);
  }

  const total = rows.reduce((s, r) => s + (Number(r.price) || 0), 0);

  // Read-only view when no edit permission
  if (!canEdit) {
    if (rows.length === 0) return null;
    return (
      <div className="space-y-2 rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-4 shadow-sm">
        <h2 className="text-sm font-semibold flex items-center gap-1.5 border-b border-blue-200 dark:border-blue-800 pb-2 text-blue-700 dark:text-blue-300">
          <Plus className="h-4 w-4" /> Add-ons (Sourced Items)
        </h2>
        <ul className="space-y-1.5 text-xs">
          {rows.map((r) => (
            <li key={r.id} className="flex justify-between items-start gap-2">
              <div>
                <span className="font-medium">{r.name}</span>
                {r.notes && <span className="text-muted-foreground"> — {r.notes}</span>}
              </div>
              <span className="font-semibold whitespace-nowrap">₹{Number(r.price).toLocaleString()}</span>
            </li>
          ))}
        </ul>
        {rows.length > 0 && (
          <div className="border-t border-blue-200 dark:border-blue-800 pt-1.5 flex justify-between text-xs font-semibold text-blue-700 dark:text-blue-300">
            <span>Total Add-ons</span>
            <span>₹{total.toLocaleString()}</span>
          </div>
        )}
      </div>
    );
  }

  // Editable view
  return (
    <div className="space-y-3 rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-blue-200 dark:border-blue-800 pb-2">
        <h2 className="text-sm font-semibold flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
          <Plus className="h-4 w-4" /> Add-ons (Sourced Items)
        </h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={addRow}
        >
          <Plus className="h-3 w-3 mr-1" /> Add Item
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          No add-ons yet. Click <strong>Add Item</strong> to add sourced items like dupattas.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={row.id} className="flex gap-2 items-start p-2 bg-white dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Input
                  placeholder="Item name (e.g. Dupatta)"
                  value={row.name}
                  onChange={(e) => update(idx, "name", e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                  <Input
                    placeholder="Price"
                    type="number"
                    min="0"
                    value={row.price}
                    onChange={(e) => update(idx, "price", e.target.value)}
                    className="h-8 text-xs pl-6"
                  />
                </div>
                <Input
                  placeholder="Notes (optional)"
                  value={row.notes}
                  onChange={(e) => update(idx, "notes", e.target.value)}
                  className="h-8 text-xs col-span-2"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => removeRow(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Totals + Save */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-blue-200 dark:border-blue-800">
        {total > 0 ? (
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
            Total: ₹{total.toLocaleString()}
          </span>
        ) : (
          <span />
        )}
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={!dirty || isSaving}
          onClick={handleSave}
        >
          {isSaving ? "Saving…" : "Save Add-ons"}
        </Button>
      </div>
    </div>
  );
}
