"use client";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronUp,
  History,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Ruler,
  Search,
  Shirt,
  ShoppingBag,
  Trash2,
  X,
  Camera,
  Upload,
  ZoomIn,
  ClipboardPaste,
} from "lucide-react";
import { ImageViewer } from "@/components/image-viewer";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { MeasurementVoiceInput } from "@/components/measurement-voice-input";
import { CameraCaptureModal } from "@/components/camera-capture-modal";
import { parseVoiceTranscript } from "@/hooks/use-measurement-voice";
import { createWorker } from "tesseract.js";
import { MeasurementZoomModal } from "@/components/measurement-zoom-modal";
// Body measurements grouped into sections.
// Each section has a number, title, and ordered fields.
const BODY_MEASUREMENT_SECTIONS = [
  {
    num: "01",
    title: "UPPER BODY",
    fields: [
      "Shoulder",
      "Upper Bust",
      "Bust",
      "Lower Bust",
      "Waist",
      "Lower Waist",
      "Hip",
    ],
  },
  {
    num: "02",
    title: "APEX & SLEEVES",
    fields: [
      "Apex Point",
      "Apex Down",
      "Apex Gap",
      "Sleeve Length",
      "Sleeve Loose",
      "Armhole",
      "Neck Front",
      "Neck Back",
    ],
  },
  {
    num: "03",
    title: "BOTTOM (PANT)",
    fields: [
      "Pant Length",
      "Pant Waist",
      "Hip / Seat",
      "Crotch (Rise)",
      "Thigh",
      "Knee",
      "Ankle",
      "Bottom Loose",
    ],
  },
] as const;

// Flat map of all body fields for default values & snapshot lookup
const ALL_BODY_FIELDS: string[] = BODY_MEASUREMENT_SECTIONS.flatMap(
  (s) => s.fields as unknown as string[]
);

// Keep for "Copy Previous" backfill only
const BODY_MEASUREMENT_FIELDS: Record<string, string> = Object.fromEntries(
  ALL_BODY_FIELDS.map((f) => [f, ""])
);


export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: customerId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  const [newField, setNewField] = useState("");
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [showPrevVersions, setShowPrevVersions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [measurementFileReading, setMeasurementFileReading] = useState(false);
  const [measurementCameraOpen, setMeasurementCameraOpen] = useState(false);
  const [showMeasurementZoom, setShowMeasurementZoom] = useState(false);
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [pasteText, setPasteText] = useState("");

  // Image viewer state (for fabric reference thumbnails on outfit rows)
  const [viewerImages, setViewerImages] = useState<{ id: string; url: string }[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Voice callback — passed to MeasurementVoiceInput component
  const voiceOnResult = useCallback((matched: Record<string, string>, custom: Record<string, string>, raw: string) => {
    const totalCount = Object.keys(matched).length + Object.keys(custom).length;
    if (totalCount === 0) {
      setTimeout(() => toast({
        variant: "destructive",
        title: "Nothing recognized",
        description: `Heard: "${raw}". Try "Bust 36 Waist 28 Hip 40".`,
      }), 0);
      return;
    }

    setMeasurementValues((prev) => {
      const duplicates: string[] = [];
      const allParsed = { ...matched, ...custom };

      for (const [k, v] of Object.entries(allParsed)) {
        if (prev[k] && prev[k] !== "" && prev[k] !== v) {
          duplicates.push(`${k}: ${prev[k]}" → ${v}"`);
        }
      }

      if (duplicates.length > 0) {
        setTimeout(() => toast({
          title: "Some values overwritten",
          description: duplicates.slice(0, 3).join(" · ") + (duplicates.length > 3 ? ` +${duplicates.length - 3} more` : ""),
        }), 0);
      }

      const lines: string[] = [
        ...Object.entries(matched).map(([k, v]) => `${k}: ${v}"`),
        ...Object.entries(custom).map(([k, v]) => `${k} (custom): ${v}"`),
      ];
      setTimeout(() => toast({
        title: `${totalCount} field${totalCount > 1 ? "s" : ""} filled`,
        description: lines.slice(0, 5).join(" · ") + (lines.length > 5 ? ` +${lines.length - 5} more` : ""),
      }), 0);

      return { ...prev, ...matched, ...custom };
    });
  }, []);

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customerId}`);
      if (!res.ok) throw new Error("Failed to fetch customer");
      return res.json();
    },
  });

  useEffect(() => {
    if (customer && customer.measurements?.length === 0 && !showMeasurementForm) {
      setMeasurementValues({ ...BODY_MEASUREMENT_FIELDS });
    }
  // showMeasurementForm intentionally excluded — only run when customer loads
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);
  const addMeasurementMutation = useMutation({
    mutationFn: async (data: {
      values: Record<string, string>;
      template?: string;
      notes?: string;
    }) => {
      const res = await fetch(`/api/customers/${customerId}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save measurements");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      setMeasurementValues({});
      setShowMeasurementForm(false);
      toast({
        title: "Saved",
        description: "Measurements recorded successfully.",
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

  async function readMeasurementFile(file: File) {
    setMeasurementFileReading(true);
    try {
      const text = file.type.startsWith("text/") || /\.(txt|csv)$/i.test(file.name)
        ? await file.text()
        : (await (async () => {
            const worker = await createWorker("eng");
            try {
              const result = await worker.recognize(file);
              return result.data.text;
            } finally {
              await worker.terminate();
            }
          })());
      const { matched, custom } = parseVoiceTranscript(text);
      const values = { ...matched, ...custom };
      if (Object.keys(values).length === 0) {
        throw new Error("No measurement values were found. Use labels like Bust 36, Waist 28, or Hip 40.");
      }
      setMeasurementValues((previous) => ({ ...previous, ...values }));
      toast({ title: "Measurements read", description: `${Object.keys(values).length} field${Object.keys(values).length === 1 ? "" : "s"} updated from ${file.name}.` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not read measurements",
        description: error instanceof Error ? error.message : "The file could not be read",
      });
    } finally {
      setMeasurementFileReading(false);
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Deleted",
        description: "Customer deleted successfully.",
      });
      router.push("/dashboard/customers");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message,
      });
    },
  });

  const filteredOrders = useMemo(() => {
    if (!customer?.orders) return [];
    let orders = customer.orders;

    if (orderStatusFilter !== "all") {
      orders = orders.filter((o: any) => o.status === orderStatusFilter);
    }

    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      orders = orders.filter(
        (o: any) =>
          o.orderNumber?.toLowerCase().includes(q) ||
          (o.outfits || []).some(
            (outfit: any) =>
              outfit.name?.toLowerCase().includes(q) ||
              outfit.type?.toLowerCase().includes(q),
          ),
      );
    }

    return orders;
  }, [customer, orderSearch, orderStatusFilter]);

  const orderStatuses = useMemo(() => {
    if (!customer?.orders) return [];
    return [
      ...new Set<string>(customer.orders.map((o: any) => o.status)),
    ].sort();
  }, [customer]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-32 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
            <div className="h-40 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="lg:col-span-5 space-y-4">
            <div className="h-60 animate-pulse rounded-lg bg-muted" />
            <div className="h-40 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return <p className="text-muted-foreground">Customer not found</p>;
  }

  const totalOrders = customer.orders?.length || 0;

  const totalPaid =
    customer.orders?.reduce(
      (sum: number, o: any) =>
        sum +
        (o.payments || []).reduce(
          (s: number, p: any) => s + Number(p.amount),
          0,
        ),
      0,
    ) || 0;
  const totalEstimated =
    customer.orders?.reduce(
      (sum: number, o: any) => sum + (Number(o.estimatedAmount) || 0),
      0,
    ) || 0;
  const balance = totalEstimated - totalPaid;

  const handleAddField = () => {
    if (!newField.trim()) return;
    setMeasurementValues((prev) => ({
      ...prev,
      [newField.trim()]: "",
    }));
    setNewField("");
  };

  const handleRemoveField = (fieldKey: string) => {
    setMeasurementValues((prev) => {
      const copy = { ...prev };
      delete copy[fieldKey];
      return copy;
    });
  };

const cleanMobile = customer.mobile ? customer.mobile.replace(/\D/g, "") : "";
  const cleanWhatsapp = customer.whatsapp
    ? customer.whatsapp.replace(/\D/g, "")
    : cleanMobile;

  return (
    <div className="space-y-4 pb-6">
          <Button variant="ghost" size="sm" className="gap-1 -ml-2">
            <ArrowLeft className="h-4 w-4" /> Customers
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: ORDERS & TRACKING                            */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 space-y-4 order-2 lg:order-1">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg font-semibold flex items-center gap-2 truncate pr-2">
                <ShoppingBag className="h-5 w-5 shrink-0" /> <span className="truncate">Orders ({totalOrders})</span>
              </CardTitle>
              <div className="flex items-center gap-1.5 shrink-0">
                {customer.portalToken && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs px-2 h-8"
                    onClick={() => {
                      const url = `${window.location.origin}/portal/${customer.portalToken}`;
                      const message = `Hi ${customer.name}! Track your outfit progress here: ${url}`;
                      window.open(
                        `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(
                          message,
                        )}`,
                        "_blank",
                      );
                    }}
                  >
                    <MessageCircle className="h-3.5 w-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">Share Portal</span>
                  </Button>
                )}
                <Link href={`/dashboard/orders/new?customerId=${customer.id}`}>
                  <Button size="sm" className="text-xs px-2 h-8">
                    <Plus className="h-3.5 w-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">New Order</span>
                  </Button>
                </Link>
              </div>
            </CardHeader>
            {totalOrders > 0 && (
              <CardContent className="pt-0 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search orders or outfits..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  {orderStatuses.length > 1 && (
                    <Select
                      value={orderStatusFilter}
                      onValueChange={setOrderStatusFilter}
                    >
                      <SelectTrigger className="h-9 w-auto px-3 text-sm">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                      {orderStatuses.map((status: string) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardContent>
            )}
          </Card>

          {totalOrders === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Shirt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium">No orders found</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Create an order to track stitching, outfits, and payments.
                </p>
                <Link href={`/dashboard/orders/new?customerId=${customer.id}`}>
                  <Button size="sm">Create First Order</Button>
                </Link>
              </CardContent>
            </Card>
          ) : filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No orders match your search filters.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order: any) => {
                const orderPaid = (order.payments || []).reduce(
                  (s: number, p: any) => s + Number(p.amount),
                  0,
                );
                const orderBalance =
                  (Number(order.estimatedAmount) || 0) - orderPaid;

                return (
                  <Link
                    key={order.id}
                    href={`/dashboard/orders/${order.id}?from=customer&customerId=${customerId}`}
                    className="block focus:outline-none"
                  >
                    <Card className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm">
                      <CardContent className="pt-4 pb-4 space-y-3">
                        {/* Order header: number + badge + date */}
                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="font-semibold text-sm truncate">
                              {order.orderNumber}
                            </span>
                            <Badge
                              className={`${getStatusColor(order.status)} text-[10px] shrink-0`}
                              variant="secondary"
                            >
                              {order.status}
                            </Badge>
                          </div>
                          {order.deliveryDate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(order.deliveryDate)}
                            </span>
                          )}
                        </div>

                        {order.outfits?.length > 0 ? (
                          <div className="space-y-1.5">
                            {order.outfits.map((outfit: any) => (
                              <div
                                key={outfit.id}
                                className="flex items-start justify-between rounded-md bg-muted/40 px-3 py-2 text-xs gap-2"
                              >
                                <div className="flex items-start gap-2 min-w-0 flex-1">
                                  <Shirt className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                    <span className="font-medium block truncate">{outfit.name}</span>
                                    <span className="text-muted-foreground">{outfit.type}</span>
                                    {/* Fabric image thumbnails */}
                                    {(() => {
                                      const fabricRefs = (outfit.references || []).filter((r: any) => r.type === "FABRIC");
                                      if (fabricRefs.length === 0) return null;
                                      return (
                                        <div className="flex items-center gap-1 mt-1">
                                          {fabricRefs.slice(0, 3).map((ref: any, idx: number) => (
                                            <button
                                              key={ref.id}
                                              type="button"
                                              className="h-5 w-5 rounded-sm overflow-hidden border border-border shrink-0 hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setViewerImages(fabricRefs.map((r: any) => ({ id: r.id, url: r.url })));
                                                setViewerIndex(idx);
                                                setViewerOpen(true);
                                              }}
                                            >
                                              <img src={ref.url} alt="Fabric" className="h-full w-full object-cover" />
                                            </button>
                                          ))}
                                          {fabricRefs.length > 3 && (
                                            <span className="text-[9px] text-muted-foreground">+{fabricRefs.length - 3}</span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                                <Badge
                                  className={`text-[10px] shrink-0 ${getStatusColor(outfit.status)}`}
                                >
                                  {formatStatus(outfit.status)}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No outfits attached
                          </p>
                        )}

                        <div className="pt-2 border-t space-y-1.5 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="text-muted-foreground whitespace-nowrap">
                                Paid:{" "}
                                <strong className="text-green-600 font-semibold">
                                  ₹{orderPaid.toLocaleString()}
                                </strong>
                              </span>
                              {order.estimatedAmount && orderBalance > 0 && (
                                <span className="text-destructive font-medium whitespace-nowrap">
                                  Bal: ₹{orderBalance.toLocaleString()}
                                </span>
                              )}
                            </div>
                            <span className="text-muted-foreground whitespace-nowrap">
                              {formatDate(order.orderDate)}
                            </span>
                          </div>
                          {(order.payments || []).length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {(order.payments || []).map((p: any, idx: number) => (
                                <span key={idx} className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">
                                  {p.method} · ₹{Number(p.amount).toLocaleString()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: CUSTOMER INFO & MEASUREMENTS                */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4 order-1 lg:order-2">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
              <div className="min-w-0 flex-1 pr-2">
                <CardTitle className="text-base font-bold flex flex-wrap items-center gap-2 sm:text-xl">
                  <span className="truncate">{customer.name}</span>
                  {customer.occasion && (
                    <Badge variant="outline" className="text-xs font-normal shrink-0">
                      {customer.occasion}
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  ID: {customer.id.slice(0, 8)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link href={`/dashboard/customers/${customer.id}/edit`}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
                {can("delete", "customer") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-muted-foreground min-w-0">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span className="truncate">{customer.mobile}</span>
                  </span>
                  {cleanMobile && (
                    <a href={`tel:${cleanMobile}`} className="shrink-0">
                      <Button variant="outline" size="xs" className="h-7 text-xs">
                        Call
                      </Button>
                    </a>
                  )}
                </div>

                {customer.whatsapp && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-muted-foreground min-w-0">
                      <MessageCircle className="h-4 w-4 shrink-0" />
                      <span className="truncate">{customer.whatsapp}</span>
                    </span>
                    <a
                      href={`https://wa.me/${cleanWhatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      <Button variant="outline" size="xs" className="h-7 text-xs whitespace-nowrap">
                        WhatsApp
                      </Button>
                    </a>
                  </div>
                )}

                {customer.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}

                {customer.address && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{customer.address}</span>
                  </div>
                )}
              </div>

              {customer.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium mb-1">Notes</p>
                    <p className="text-xs text-muted-foreground italic">
                      {customer.notes}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Ruler className="h-4 w-4" /> Body Measurements
                {customer.measurements?.length > 0 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 ml-1"
                    onClick={() => setShowMeasurementZoom(true)}
                    title="View with calculator"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                )}
              </CardTitle>
              {can("create", "measurement") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!showMeasurementForm) {
                      const latest = customer.measurements?.[0]?.values || {};
                      const prefilled: Record<string, string> = {};
                      ALL_BODY_FIELDS.forEach((k) => {
                        prefilled[k] = latest[k] || "";
                      });
                      Object.entries(latest).forEach(([k, v]) => {
                        if (!(k in prefilled)) prefilled[k] = v as string;
                      });
                      setMeasurementValues(prefilled);
                    }
                    setShowMeasurementForm(!showMeasurementForm);
                  }}
                >
                  {showMeasurementForm ? (
                    <><X className="h-3.5 w-3.5 mr-1" /> Cancel</>
                  ) : customer.measurements?.length > 0 ? (
                    <><Pencil className="h-3.5 w-3.5 mr-1" /> Update</>
                  ) : (
                    <><Plus className="h-3.5 w-3.5 mr-1" /> Add</>
                  )}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                Body dimensions only. Garment-specific lengths &amp; neck depths are entered on each outfit. <strong>All values in inches.</strong>
              </p>

              {(showMeasurementForm) ? (
                <div className="space-y-5 border p-3 rounded-md bg-background">

                  {/* ── VOICE INPUT ── */}
                  <MeasurementVoiceInput onResult={voiceOnResult} />

                  <div className="rounded-md border border-dashed p-3 space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-medium">Measurement chart or photo</p>
                        <p className="text-[11px] text-muted-foreground">Read values from an image or text file into this form.</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <label>
                          <Button type="button" size="sm" variant="outline" asChild disabled={measurementFileReading} className="shrink-0">
                            <span><Upload className="mr-1 h-3.5 w-3.5" /> Read File</span>
                          </Button>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,.txt,.csv"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) readMeasurementFile(file);
                              event.target.value = "";
                            }}
                          />
                        </label>
                        <Button type="button" size="sm" variant="outline" onClick={() => setMeasurementCameraOpen(true)} disabled={measurementFileReading} className="shrink-0">
                          <Camera className="mr-1 h-3.5 w-3.5" /> Read Photo
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => { setPasteText(""); setShowPasteDialog(true); }} disabled={measurementFileReading} className="shrink-0">
                          <ClipboardPaste className="mr-1 h-3.5 w-3.5" /> Paste Text
                        </Button>
                      </div>
                    </div>
                    {measurementFileReading && <p className="text-xs text-muted-foreground">Reading measurements...</p>}
                    <CameraCaptureModal
                      open={measurementCameraOpen}
                      onClose={() => setMeasurementCameraOpen(false)}
                      onCapture={readMeasurementFile}
                    />

                    {/* ── Paste Text Dialog ── */}
                    <Dialog open={showPasteDialog} onOpenChange={setShowPasteDialog}>
                      <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-base">
                            <ClipboardPaste className="h-4 w-4 text-primary" />
                            Paste Measurements
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2">
                          <p className="text-[11px] text-muted-foreground">
                            Paste a table, CSV, or plain text. Each row should be{" "}
                            <span className="font-medium text-foreground">Field, Value</span> — or paste
                            multiple columns with headers. Unknown field names become custom fields.
                          </p>
                          <Textarea
                            autoFocus
                            rows={10}
                            placeholder={`Bust, 36\nWaist, 28\nHip, 40\n\nor multi-column:\nBust, Waist, Hip\n36, 28, 40`}
                            value={pasteText}
                            onChange={(e) => setPasteText(e.target.value)}
                            className="font-mono text-xs resize-none"
                          />
                        </div>
                        <DialogFooter className="gap-2">
                          <Button variant="outline" size="sm" onClick={() => setShowPasteDialog(false)}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={!pasteText.trim()}
                            onClick={() => {
                              const { matched, custom } = parseVoiceTranscript(pasteText);
                              const values = { ...matched, ...custom };
                              const count = Object.keys(values).length;
                              if (count === 0) {
                                toast({
                                  variant: "destructive",
                                  title: "No measurements found",
                                  description: 'Use labels like "Bust 36" or "Bust, 36".',
                                });
                                return;
                              }
                              setMeasurementValues((prev) => ({ ...prev, ...values }));
                              setShowPasteDialog(false);
                              setPasteText("");
                              toast({
                                title: "Measurements applied",
                                description: `${count} field${count === 1 ? "" : "s"} filled from pasted text.`,
                              });
                            }}
                          >
                            <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
                            Parse & Fill
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {BODY_MEASUREMENT_SECTIONS.map((section) => (
                    <div key={section.num} className="space-y-2">
                      {/* Section header */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-primary/70 tabular-nums">{section.num}</span>
                        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">{section.title}</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(section.fields as unknown as string[]).map((field) => (
                          <div key={field} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{field}</Label>
                            <div className="relative">
                              <Input
                                value={measurementValues[field] ?? ""}
                                onChange={(e) =>
                                  setMeasurementValues((prev) => ({ ...prev, [field]: e.target.value }))
                                }
                                placeholder='0.0"'
                                inputMode="decimal"
                                className="h-10 text-sm pr-7"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">"</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* ── CUSTOM FIELDS (extra fields not in standard sections) ── */}
                  {Object.entries(measurementValues)
                    .filter(([key]) => !ALL_BODY_FIELDS.includes(key))
                    .map(([key, value]) => (
                      <div key={key} className="flex items-end gap-2">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">{key}</Label>
                            <button
                              type="button"
                              onClick={() => handleRemoveField(key)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="relative">
                            <Input
                              value={value}
                              onChange={(e) =>
                                setMeasurementValues((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              placeholder='0.0"'
                              inputMode="decimal"
                              className="h-10 text-sm pr-7"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">"</span>
                          </div>
                        </div>
                      </div>
                    ))}

                  {/* Add custom field */}
                  <div className="flex gap-2 pt-1">
                    <Input
                      value={newField}
                      onChange={(e) => setNewField(e.target.value)}
                      placeholder="Custom field (e.g. Bicep)"
                      className="h-10 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); handleAddField(); }
                      }}
                    />
                    <Button size="sm" variant="outline" type="button" className="h-10 px-3 shrink-0" onClick={handleAddField}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      className="flex-1 h-10 text-sm"
                      disabled={addMeasurementMutation.isPending || measurementFileReading}
                      onClick={() => addMeasurementMutation.mutate({ values: measurementValues })}
                    >
                      {addMeasurementMutation.isPending ? "Saving..." : "Save Measurements"}
                    </Button>
                    {customer.measurements?.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-10"
                        onClick={() => { setShowMeasurementForm(false); setMeasurementValues({}); }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ) : customer.measurements?.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-1">
                    <span>Version {customer.measurements[0].version}</span>
                    <span>{formatDate(customer.measurements[0].createdAt)}</span>
                  </div>

                  {/* Read-only sectioned display */}
                  {BODY_MEASUREMENT_SECTIONS.map((section) => {
                    const saved = customer.measurements[0].values as Record<string, string>;
                    const hasAny = (section.fields as unknown as string[]).some((f) => saved[f]);
                    if (!hasAny) return null;
                    return (
                      <div key={section.num} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-primary/70 tabular-nums">{section.num}</span>
                          <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">{section.title}</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                          {(section.fields as unknown as string[]).map((field) => (
                            saved[field] ? (
                              <div key={field} className="flex items-center justify-between text-xs border-b border-muted/40 py-0.5">
                                <span className="text-muted-foreground truncate mr-1">{field}</span>
                                <span className="font-semibold shrink-0">{saved[field]}"</span>
                              </div>
                            ) : null
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Any extra custom fields */}
                  {(() => {
                    const saved = customer.measurements[0].values as Record<string, string>;
                    const extras = Object.entries(saved).filter(([k]) => !ALL_BODY_FIELDS.includes(k) && saved[k]);
                    if (!extras.length) return null;
                    return (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">CUSTOM</p>
                        <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                          {extras.map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between text-xs border-b border-muted/40 py-0.5">
                              <span className="text-muted-foreground">{k}</span>
                              <span className="font-semibold">{v}"</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {customer.measurements.length > 1 && (
                    <div className="pt-1 border-t">
                      <button
                        type="button"
                        onClick={() => setShowPrevVersions((v) => !v)}
                        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full"
                      >
                        <History className="h-3 w-3" />
                        {showPrevVersions ? "Hide" : "Show"} {customer.measurements.length - 1} previous version{customer.measurements.length - 1 > 1 ? "s" : ""}
                        {showPrevVersions
                          ? <ChevronUp className="h-3 w-3 ml-auto" />
                          : <ChevronDown className="h-3 w-3 ml-auto" />}
                      </button>

                      {showPrevVersions && (
                        <div className="mt-3 space-y-4">
                          {customer.measurements.slice(1).map((m: any) => (
                            <div key={m.id} className="space-y-3 border rounded-md p-3 bg-muted/20">
                              {/* Version header */}
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">Version {m.version}</span>
                                <span>{formatDate(m.createdAt)}</span>
                              </div>

                              {/* Sectioned read-only */}
                              {BODY_MEASUREMENT_SECTIONS.map((section) => {
                                const vals = m.values as Record<string, string>;
                                const entries = (section.fields as unknown as string[]).filter((f) => vals[f]);
                                if (!entries.length) return null;
                                return (
                                  <div key={section.num} className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-bold text-primary/60 tabular-nums">{section.num}</span>
                                      <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground">{section.title}</span>
                                      <div className="flex-1 h-px bg-border" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-x-3 gap-y-0.5">
                                      {entries.map((field) => (
                                        <div key={field} className="flex items-center justify-between text-xs border-b border-muted/40 py-0.5">
                                          <span className="text-muted-foreground text-[11px]">{field}</span>
                                          <span className="font-semibold text-[11px]">{vals[field]}"</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Custom fields for this version */}
                              {(() => {
                                const vals = m.values as Record<string, string>;
                                const extras = Object.entries(vals).filter(([k, v]) => !ALL_BODY_FIELDS.includes(k) && v);
                                if (!extras.length) return null;
                                return (
                                  <div className="grid grid-cols-3 gap-x-3 gap-y-0.5">
                                    {extras.map(([k, v]) => (
                                      <div key={k} className="flex items-center justify-between text-xs border-b border-muted/40 py-0.5">
                                        <span className="text-muted-foreground text-[11px]">{k}</span>
                                        <span className="font-semibold text-[11px]">{v}"</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center border border-dashed rounded-lg">
                  <Ruler className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">No measurements yet</p>
                  {can("create", "measurement") && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Click <strong>Add</strong> above to enter body measurements.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {customer.name}? This action
              cannot be undone.
              {totalOrders > 0 &&
                " Note: Delete their associated orders before removing this record."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImageViewer
        images={viewerImages}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />

      {/* Measurement Zoom Modal with Calculator */}
      {customer.measurements?.length > 0 && (
        <MeasurementZoomModal
          open={showMeasurementZoom}
          onClose={() => setShowMeasurementZoom(false)}
          customer={{ name: customer.name, id: customer.id }}
          customerMeasurements={customer.measurements[0]}
          garmentMeasurements={{}}
          onGarmentMeasurementsChange={() => {}}
        />
      )}
    </div>
  );
}
