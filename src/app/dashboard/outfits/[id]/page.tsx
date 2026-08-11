"use client";

import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageViewer } from "@/components/image-viewer";
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
  CheckCircle,
  Image as ImageIcon,
  AlertTriangle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

const DEPENDENCY_TYPES = ["FABRIC", "LINING", "DYEING", "ACCESSORIES", "STONES", "CANVAS", "CUPS"];

export default function OutfitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can, role } = usePermissions();

  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  const [newField, setNewField] = useState("");

  // Fetch outfit detail
  const { data: outfit, isLoading } = useQuery({
    queryKey: ["outfit", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/outfits/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

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
    mutationFn: async ({ newStatus, notes }: { newStatus: string; notes?: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ["outfit-transitions", params.id] });

      // If customer should be notified (READY_FOR_DELIVERY), open WhatsApp
      if (data.notifyCustomer?.whatsappUrl) {
        if (confirm(`Outfit is ready! Notify ${data.notifyCustomer.customerName} via WhatsApp?`)) {
          window.open(data.notifyCustomer.whatsappUrl, "_blank");
        }
      }
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
    },
  });

  // Add measurement
  const addMeasurementMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/outfits/${params.id}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outfit", params.id] });
      setMeasurementValues({});
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
      queryClient.invalidateQueries({ queryKey: ["outfit-transitions", params.id] });
    },
  });

  // Select references
  const selectRefsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch(`/api/outfits/${params.id}/references`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select", ids }),
      });
      if (!res.ok) throw new Error("Failed to select");
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
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outfit", params.id] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!outfit) return <p className="text-muted-foreground">Outfit not found</p>;

  const availableTransitions = transitions?.availableTransitions || [];
  const patternRefs = (outfit.references || []).filter((r: any) => r.type === "PATTERN");
  const maggamRefs = (outfit.references || []).filter((r: any) => r.type === "MAGGAM");
  const latestMeasurement = outfit.measurements?.[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/outfits">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold lg:text-2xl truncate">{outfit.name}</h1>
            <Badge className={getStatusColor(outfit.status)}>{formatStatus(outfit.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {outfit.customer?.name && <span className="font-medium text-foreground">{outfit.customer.name}</span>}
            {outfit.customer?.name && " · "}
            {outfit.type}{outfit.maggamRequired && " · Maggam Required"}
            {outfit.customer?.occasion && ` · ${outfit.customer.occasion}`}
          </p>
        </div>
      </div>

      {/* Workflow Transitions */}
      {availableTransitions.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 pt-4 pb-4">
            <span className="text-sm font-medium text-muted-foreground">Next:</span>
            {availableTransitions.map((t: any) => (
              <LoadingButton
                key={t.status}
                size="sm"
                loading={transitionMutation.isPending}
                onClick={() => transitionMutation.mutate({ newStatus: t.status })}
              >
                <ArrowRight className="h-3 w-3" /> {t.label}
              </LoadingButton>
            ))}
            {transitionMutation.error && (
              <p className="w-full text-xs text-destructive mt-1">
                {transitionMutation.error.message}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Grid */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Trial Date</p>
            <p className="text-sm font-medium">{formatDate(outfit.trialDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Delivery Date</p>
            <p className="text-sm font-medium">{formatDate(outfit.deliveryDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Designer</p>
            <p className="text-sm font-medium">{outfit.designer?.name || "Not assigned"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Master</p>
            {(can("update", "outfit") && role !== "MASTER") ? (
              <AssignMasterSelect
                outfitId={outfit.id}
                currentMasterId={outfit.masterId}
                onAssign={(masterId) => updateMutation.mutate({ masterId })}
              />
            ) : (
              <p className="text-sm font-medium">{outfit.masterId || "Not assigned"}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="measurements">
        <TabsList className="w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="measurements" className="text-xs sm:text-sm">Measurements</TabsTrigger>
          <TabsTrigger value="references" className="text-xs sm:text-sm">References</TabsTrigger>
          {can("read", "dependency") && (
            <TabsTrigger value="dependencies" className="text-xs sm:text-sm">Dependencies</TabsTrigger>
          )}
          {can("update", "outfit") && role !== "MASTER" && (
            <TabsTrigger value="design" className="text-xs sm:text-sm">Design</TabsTrigger>
          )}
          <TabsTrigger value="timeline" className="text-xs sm:text-sm">Timeline</TabsTrigger>
        </TabsList>

        {/* Measurements */}
        <TabsContent value="measurements" className="space-y-4 mt-4">
          {can("create", "measurement") && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Add Measurements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMeasurementValues({
                        Bust: "", Waist: "", Hip: "", Shoulder: "",
                        "Arm Length": "", "Neck Front": "", "Front Length": "", "Back Length": "",
                      });
                    }}
                  >
                    Blouse Template
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMeasurementValues({ Waist: "", Hip: "", Length: "", Flare: "" });
                    }}
                  >
                    Lehenga Template
                  </Button>
                </div>

                {Object.keys(measurementValues).length > 0 && (
                  <div className="space-y-2">
                    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                      {Object.entries(measurementValues).map(([key, value]) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-xs">{key}</Label>
                          <Input
                            value={value}
                            onChange={(e) =>
                              setMeasurementValues((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            placeholder="inches"
                            className="h-8"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newField}
                        onChange={(e) => setNewField(e.target.value)}
                        placeholder="Add field name"
                        className="h-8"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newField.trim()) {
                            setMeasurementValues((prev) => ({ ...prev, [newField.trim()]: "" }));
                            setNewField("");
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (newField.trim()) {
                            setMeasurementValues((prev) => ({ ...prev, [newField.trim()]: "" }));
                            setNewField("");
                          }
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <LoadingButton
                      size="sm"
                      loading={addMeasurementMutation.isPending}
                      loadingText="Saving..."
                      onClick={() => addMeasurementMutation.mutate({ values: measurementValues })}
                      disabled={Object.keys(measurementValues).length === 0}
                    >
                      Save Measurements
                    </LoadingButton>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {latestMeasurement ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex justify-between">
                  <span>Version {latestMeasurement.version}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {formatDate(latestMeasurement.createdAt)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {Object.entries(latestMeasurement.values as Record<string, string>).map(
                    ([key, value]) => (
                      <div key={key}>
                        <p className="text-xs text-muted-foreground">{key}</p>
                        <p className="text-sm font-medium">{value || "—"}</p>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No measurements recorded
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* References */}
        <TabsContent value="references" className="space-y-6 mt-4">
          <ReferenceSection
            title="Pattern References"
            type="PATTERN"
            references={patternRefs.filter((r: any) => !r.isCustomerUpload)}
            canUpload={can("upload", "reference")}
            canSelect={can("select", "reference")}
            canLock={can("lock", "reference")}
            isUploading={uploadRefMutation.isPending}
            onUpload={(file) => uploadRefMutation.mutate({ file, type: "PATTERN" })}
            onSelect={(ids) => selectRefsMutation.mutate(ids)}
            onLock={() => lockRefsMutation.mutate({ type: "PATTERN" })}
          />
          {outfit.maggamRequired && (
            <ReferenceSection
              title="Maggam References"
              type="MAGGAM"
              references={maggamRefs.filter((r: any) => !r.isCustomerUpload)}
              canUpload={can("upload", "reference")}
              canSelect={can("select", "reference")}
              canLock={can("lock", "reference")}
              isUploading={uploadRefMutation.isPending}
              onUpload={(file) => uploadRefMutation.mutate({ file, type: "MAGGAM" })}
              onSelect={(ids) => selectRefsMutation.mutate(ids)}
              onLock={() => lockRefsMutation.mutate({ type: "MAGGAM" })}
            />
          )}

          {/* Customer Inspiration Images */}
          {(() => {
            const customerUploads = (outfit.references || []).filter((r: any) => r.isCustomerUpload);
            if (customerUploads.length === 0) return null;
            return (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  📷 Customer Inspiration ({customerUploads.length})
                </h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {customerUploads.map((ref: any) => (
                    <div key={ref.id} className="relative rounded-lg border-2 border-dashed border-blue-200 overflow-hidden">
                      <img src={ref.url} alt="" className="aspect-square w-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-blue-600/80 px-1.5 py-0.5">
                        <span className="text-[10px] text-white">Customer</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </TabsContent>

        {/* Dependencies */}
        {can("read", "dependency") && (
          <TabsContent value="dependencies" className="space-y-4 mt-4">
            {can("create", "dependency") && (
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
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input name="notes" placeholder="Notes" className="h-9 flex-1" />
                    <LoadingButton size="sm" type="submit" loading={addDependencyMutation.isPending} loadingText="Raising...">
                      Raise
                    </LoadingButton>
                  </form>
                </CardContent>
              </Card>
            )}

            {(outfit.dependencies || []).length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-500" />
                  No dependencies
                </CardContent>
              </Card>
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
                          <p className="text-sm font-medium">{dep.type.replace(/_/g, " ")}</p>
                          {dep.notes && <p className="text-xs text-muted-foreground">{dep.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {dep.status !== "AVAILABLE" && can("update", "dependency") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              fetch(`/api/outfits/${params.id}/dependencies`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ dependencyId: dep.id, status: "AVAILABLE" }),
                              }).then(() => {
                                queryClient.invalidateQueries({ queryKey: ["outfit", params.id] });
                                queryClient.invalidateQueries({ queryKey: ["outfit-transitions", params.id] });
                              });
                            }}
                          >
                            Resolve
                          </Button>
                        )}
                        <Badge variant={dep.status === "AVAILABLE" ? "default" : "secondary"}>
                          {dep.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {/* Design Notes — hidden from Master */}
        {can("update", "outfit") && role !== "MASTER" && (
          <TabsContent value="design" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Designer Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  defaultValue={outfit.designerNotes || ""}
                  placeholder="Design notes, preferences, instructions..."
                  rows={3}
                  onBlur={(e) => {
                    if (e.target.value !== (outfit.designerNotes || "")) {
                      updateMutation.mutate({ designerNotes: e.target.value });
                    }
                  }}
                />
                <Textarea
                  defaultValue={outfit.specialInstructions || ""}
                  placeholder="Special production instructions..."
                  rows={2}
                  onBlur={(e) => {
                    if (e.target.value !== (outfit.specialInstructions || "")) {
                      updateMutation.mutate({ specialInstructions: e.target.value });
                    }
                  }}
                />
              </CardContent>
            </Card>

            {/* Trial & Alteration Notes */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Trial & Alteration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Trial Notes</Label>
                  <Textarea
                    defaultValue={outfit.trialNotes || ""}
                    placeholder="How was the trial? Fit feedback, customer comments..."
                    rows={2}
                    onBlur={(e) => {
                      if (e.target.value !== (outfit.trialNotes || "")) {
                        updateMutation.mutate({ trialNotes: e.target.value });
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Alteration Notes</Label>
                  <Textarea
                    defaultValue={outfit.alterationNotes || ""}
                    placeholder="What needs to be fixed? Sleeve length, waist adjustment..."
                    rows={2}
                    onBlur={(e) => {
                      if (e.target.value !== (outfit.alterationNotes || "")) {
                        updateMutation.mutate({ alterationNotes: e.target.value });
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Timeline */}
        <TabsContent value="timeline" className="space-y-3 mt-4">
          {(outfit.productionLogs || []).length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                No activity yet
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {(outfit.productionLogs || []).map((log: any) => (
                <div key={log.id} className="flex gap-3 items-start">
                  <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <Badge className={getStatusColor(log.status)} variant="secondary">
                      {formatStatus(log.status)}
                    </Badge>
                    {log.notes && <p className="text-xs text-muted-foreground mt-0.5">{log.notes}</p>}
                    <p className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── REFERENCE SECTION COMPONENT ────────────────────────────────────────────

function ReferenceSection({
  title,
  type,
  references,
  canUpload,
  canSelect,
  canLock,
  isUploading,
  onUpload,
  onSelect,
  onLock,
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
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const hasLocked = references.some((r) => r.status === "LOCKED");
  const hasSelected = references.some((r) => r.status === "SELECTED");

  function openViewer(index: number) {
    setViewerIndex(index);
    setViewerOpen(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ImageIcon className="h-4 w-4" /> {title}
          {hasLocked && <Lock className="h-3 w-3 text-green-600" />}
        </h3>
        <div className="flex gap-2">
          {canSelect && selectedIds.length > 0 && !hasLocked && (
            <LoadingButton size="sm" variant="outline" loading={isSelecting} onClick={() => { 
              setIsSelecting(true);
              onSelect(selectedIds); 
              setSelectedIds([]); 
              setTimeout(() => setIsSelecting(false), 500);
            }}>
              Select ({selectedIds.length})
            </LoadingButton>
          )}
          {canLock && hasSelected && !hasLocked && (
            <LoadingButton size="sm" loading={isLocking} onClick={() => {
              setIsLocking(true);
              onLock();
              setTimeout(() => setIsLocking(false), 500);
            }}>
              <Lock className="h-3 w-3" /> Lock
            </LoadingButton>
          )}
          {canUpload && !hasLocked && (
            <label>
              {isUploading ? (
                <LoadingButton size="sm" variant="outline" loading={true} loadingText="Uploading..." />
              ) : (
                <>
                  <Button size="sm" variant="outline" asChild>
                    <span><Plus className="h-3 w-3" /> Upload</span>
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
                </>
              )}
            </label>
          )}
        </div>
      </div>

      {references.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No references uploaded
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {references.map((ref: any, index: number) => (
            <div
              key={ref.id}
              className={`relative rounded-lg border-2 overflow-hidden transition-all ${
                ref.status === "LOCKED"
                  ? "border-green-500"
                  : ref.status === "SELECTED"
                  ? "border-primary"
                  : selectedIds.includes(ref.id)
                  ? "border-blue-400"
                  : "border-transparent hover:border-muted-foreground/30"
              }`}
            >
              <img
                src={ref.url}
                alt=""
                className="aspect-square w-full object-cover cursor-pointer"
                onClick={() => openViewer(index)}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5 flex items-center justify-between">
                <span className={`text-[10px] font-medium ${
                  ref.status === "LOCKED" ? "text-green-300" :
                  ref.status === "SELECTED" ? "text-blue-300" : "text-gray-300"
                }`}>
                  {ref.status}
                </span>
                <div className="flex items-center gap-1">
                  {canUpload && ref.status === "DRAFT" && !hasLocked && (
                    <button
                      className="text-red-400 hover:text-red-300 text-[10px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this image?")) {
                          fetch(`/api/references/${ref.id}`, { method: "DELETE" })
                            .then(() => window.location.reload());
                        }
                      }}
                    >
                      ✕
                    </button>
                  )}
                  {canSelect && ref.status === "DRAFT" && !hasLocked && (
                    <input
                      type="checkbox"
                      className="h-3 w-3"
                      checked={selectedIds.includes(ref.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        setSelectedIds((prev) =>
                          prev.includes(ref.id) ? prev.filter((id) => id !== ref.id) : [...prev, ref.id]
                        );
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Viewer Lightbox */}
      <ImageViewer
        images={references}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}


// ─── ASSIGN MASTER SELECT ───────────────────────────────────────────────────

function AssignMasterSelect({
  outfitId,
  currentMasterId,
  onAssign,
}: {
  outfitId: string;
  currentMasterId: string | null;
  onAssign: (masterId: string) => void;
}) {
  const { data: staff } = useQuery({
    queryKey: ["staff-masters"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) return [];
      const users = await res.json();
      return users.filter((u: any) => u.role === "MASTER" && u.active);
    },
  });

  return (
    <select
      className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
      value={currentMasterId || ""}
      onChange={(e) => onAssign(e.target.value)}
    >
      <option value="">Select Master</option>
      {(staff || []).map((m: any) => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  );
}
