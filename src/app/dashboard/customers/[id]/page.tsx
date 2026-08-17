"use client";

import { useState, useMemo, use, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  Calendar,
  Shirt,
  MessageCircle,
  Pencil,
  Plus,
  Ruler,
  Trash2,
  Search,
  IndianRupee,
  Lock,
  X,
} from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

const PRODUCTION_STARTED_STATUSES = [
  "PRODUCTION_READY",
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

const MEASUREMENT_TEMPLATES: Record<string, Record<string, string>> = {
  Blouse: {
    Bust: "",
    "Upper Chest": "",
    Waist: "",
    Shoulder: "",
    "Arm Length": "",
    Armhole: "",
    "Sleeve Round": "",
    "Neck Front": "",
    "Neck Back": "",
    "Front Length": "",
    "Back Length": "",
  },
  Lehenga: {
    Waist: "",
    Hip: "",
    "Lehenga Length": "",
    "Flare / Gher": "",
  },
  "Kurti / Suit": {
    Bust: "",
    Waist: "",
    Hip: "",
    Shoulder: "",
    "Kurti Length": "",
    "Arm Length": "",
    Armhole: "",
    "Neck Front": "",
    "Neck Back": "",
    "Side Slit Start": "",
  },
  Anarkali: {
    Bust: "",
    "Upper Chest": "",
    Waist: "",
    Shoulder: "",
    "Anarkali Length": "",
    "Yoke Length": "",
    "Arm Length": "",
    "Neck Front": "",
    "Neck Back": "",
    "Flare / Gher": "",
  },
  Gown: {
    Bust: "",
    Waist: "",
    Hip: "",
    Shoulder: "",
    "Full Length": "",
    "Yoke Length": "",
    "Arm Length": "",
    "Neck Front": "",
    "Neck Back": "",
  }
};

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: customerId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const [measurementValues, setMeasurementValues] = useState<
    Record<string, string>
  >({});
  const [newField, setNewField] = useState("");
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customerId}`);
      if (!res.ok) throw new Error("Failed to fetch customer");
      return res.json();
    },
  });

  useEffect(() => {
    if (customer && customer.measurements?.length === 0) {
      setMeasurementValues({ ...MEASUREMENT_TEMPLATES.Blouse });
    }
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

  const isMeasurementsLocked = useMemo(() => {
    if (!customer?.orders) return false;
    return customer.orders.some((order: any) =>
      (order.outfits || []).some((outfit: any) =>
        PRODUCTION_STARTED_STATUSES.includes(outfit.status),
      ),
    );
  }, [customer]);

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
  const totalOutfits =
    customer.orders?.reduce(
      (sum: number, o: any) => sum + (o.outfits?.length || 0),
      0,
    ) || 0;
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

  const applyTemplate = (templateKey: string) => {
    const templateFields = MEASUREMENT_TEMPLATES[templateKey];
    if (!templateFields) return;

    const latest = customer.measurements?.[0]?.values || {};
    const updated: Record<string, string> = {};

    Object.keys(templateFields).forEach((key) => {
      updated[key] = latest[key] || "";
    });

    setMeasurementValues(updated);
  };

  const cleanMobile = customer.mobile ? customer.mobile.replace(/\D/g, "") : "";
  const cleanWhatsapp = customer.whatsapp
    ? customer.whatsapp.replace(/\D/g, "")
    : cleanMobile;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/customers">
          <Button variant="ghost" size="sm" className="gap-1 -ml-2">
            <ArrowLeft className="h-4 w-4" /> Customers
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: ORDERS & TRACKING                            */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" /> Orders ({totalOrders})
              </CardTitle>
              <div className="flex items-center gap-2">
                {customer.portalToken && (
                  <Button
                    size="sm"
                    variant="outline"
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
                    <MessageCircle className="h-3.5 w-3.5 mr-1" />
                    Share Portal
                  </Button>
                )}
                <Link href={`/dashboard/orders/new?customerId=${customer.id}`}>
                  <Button size="sm">
                    <Plus className="h-3.5 w-3.5 mr-1" /> New Order
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
                    <select
                      value={orderStatusFilter}
                      onChange={(e) => setOrderStatusFilter(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="all">All Statuses</option>
                      {orderStatuses.map((status: string) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
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
                    href={`/dashboard/orders/${order.id}`}
                    className="block focus:outline-none"
                  >
                    <Card className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm">
                      <CardContent className="pt-4 pb-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-base">
                              {order.orderNumber}
                            </span>
                            <Badge
                              className={getStatusColor(order.status)}
                              variant="secondary"
                            >
                              {order.status}
                            </Badge>
                          </div>
                          {order.deliveryDate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
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
                                className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <Shirt className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="font-medium">
                                    {outfit.name}
                                  </span>
                                  <span className="text-muted-foreground">
                                    · {outfit.type}
                                  </span>
                                </div>
                                <Badge
                                  className={`text-[10px] ${getStatusColor(
                                    outfit.status,
                                  )}`}
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
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <span className="text-muted-foreground">
                                Paid:{" "}
                                <strong className="text-green-600 font-semibold">
                                  ₹{orderPaid.toLocaleString()}
                                </strong>
                              </span>
                              {order.estimatedAmount && orderBalance > 0 && (
                                <span className="text-destructive font-medium">
                                  Bal: ₹{orderBalance.toLocaleString()}
                                </span>
                              )}
                            </div>
                            <span className="text-muted-foreground">
                              {formatDate(order.orderDate)}
                            </span>
                          </div>
                          {(order.payments || []).length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {(order.payments || []).map((p: any, idx: number) => (
                                <span key={idx} className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded">
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
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  {customer.name}
                  {customer.occasion && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {customer.occasion}
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Customer ID: {customer.id.slice(0, 8)}
                </p>
              </div>
              <div className="flex items-center gap-1">
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
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" /> {customer.mobile}
                  </span>
                  {cleanMobile && (
                    <a href={`tel:${cleanMobile}`}>
                      <Button
                        variant="outline"
                        size="xs"
                        className="h-7 text-xs"
                      >
                        Call
                      </Button>
                    </a>
                  )}
                </div>

                {customer.whatsapp && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <MessageCircle className="h-4 w-4" /> {customer.whatsapp}
                    </span>
                    <a
                      href={`https://wa.me/${cleanWhatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        size="xs"
                        className="h-7 text-xs"
                      >
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
                <Ruler className="h-4 w-4" /> Measurements
                {isMeasurementsLocked && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Lock className="h-3 w-3" /> Locked
                  </Badge>
                )}
              </CardTitle>
              {can("create", "measurement") &&
                !isMeasurementsLocked &&
                customer.measurements?.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!showMeasurementForm) {
                        const latest = customer.measurements?.[0]?.values;
                        setMeasurementValues(
                          latest || MEASUREMENT_TEMPLATES.Blouse,
                        );
                      }
                      setShowMeasurementForm(!showMeasurementForm);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    {showMeasurementForm ? "Cancel" : "Update"}
                  </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-3">
              {isMeasurementsLocked && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  Locked because production has started on an outfit.
                </p>
              )}

              {(showMeasurementForm || customer.measurements?.length === 0) &&
              !isMeasurementsLocked ? (
                <div className="space-y-3 border p-3 rounded-md bg-background">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">Templates</p>
                    <span className="text-[10px] text-muted-foreground">
                      {customer.measurements?.length === 0
                        ? "New Profile"
                        : "Edit Mode"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(MEASUREMENT_TEMPLATES).map((tmplKey) => (
                      <Button
                        key={tmplKey}
                        variant="secondary"
                        size="xs"
                        className="h-7 text-xs"
                        onClick={() => applyTemplate(tmplKey)}
                      >
                        {tmplKey}
                      </Button>
                    ))}
                    {customer.measurements?.length > 0 && (
                      <Button
                        variant="secondary"
                        size="xs"
                        className="h-7 text-xs"
                        onClick={() => {
                          setMeasurementValues({
                            ...customer.measurements[0].values,
                          });
                        }}
                      >
                        Copy Previous
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="xs"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => setMeasurementValues({})}
                    >
                      Clear
                    </Button>
                  </div>

                  {Object.keys(measurementValues).length > 0 ? (
                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(measurementValues).map(
                          ([key, value]) => (
                            <div key={key} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-[11px]">{key}</Label>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveField(key)}
                                  className="text-muted-foreground hover:text-destructive"
                                  title="Remove field"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                              <Input
                                value={value}
                                onChange={(e) =>
                                  setMeasurementValues((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                                placeholder="in inches"
                                className="h-7 text-xs"
                              />
                            </div>
                          ),
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Input
                          value={newField}
                          onChange={(e) => setNewField(e.target.value)}
                          placeholder="Custom field name"
                          className="h-7 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddField();
                            }
                          }}
                        />
                        <Button
                          size="xs"
                          variant="outline"
                          type="button"
                          className="h-7 px-2"
                          onClick={handleAddField}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="w-full text-xs h-8"
                          disabled={addMeasurementMutation.isPending}
                          onClick={() =>
                            addMeasurementMutation.mutate({
                              values: measurementValues,
                            })
                          }
                        >
                          {addMeasurementMutation.isPending
                            ? "Saving..."
                            : "Save Measurements"}
                        </Button>
                        {customer.measurements?.length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-8"
                            onClick={() => {
                              setShowMeasurementForm(false);
                              setMeasurementValues({});
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic pt-1">
                      Click a template button above or type a custom field name
                      to build measurements.
                    </p>
                  )}
                </div>
              ) : customer.measurements?.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-1">
                    <span>Version {customer.measurements[0].version}</span>
                    <span>
                      {formatDate(customer.measurements[0].createdAt)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {Object.entries(
                      (customer.measurements[0].values || {}) as Record<
                        string,
                        string
                      >,
                    ).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="font-semibold">{value || "—"}</span>
                      </div>
                    ))}
                  </div>

                  {customer.measurements.length > 1 && (
                    <p className="text-[11px] text-muted-foreground pt-1 italic">
                      + {customer.measurements.length - 1} previous measurement
                      version(s)
                    </p>
                  )}
                </div>
              ) : null}
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
    </div>
  );
}
