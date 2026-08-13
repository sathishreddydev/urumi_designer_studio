"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

// Statuses that mean production has started — measurements locked
const PRODUCTION_STARTED_STATUSES = [
  "PRODUCTION_READY", "PATTERN_DRAFTING", "MAGGAM_WORK", "MAGGAM_REVIEW",
  "FABRIC_CUTTING", "STITCHING", "PRODUCTION_COMPLETED", "TRIAL",
  "ALTERATION", "QC", "READY_FOR_DELIVERY", "DELIVERED",
];

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  const [newField, setNewField] = useState("");
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const addMeasurementMutation = useMutation({
    mutationFn: async (data: { values: Record<string, string>; template?: string; notes?: string }) => {
      const res = await fetch(`/api/customers/${params.id}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save measurements");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", params.id] });
      setMeasurementValues({});
      setShowMeasurementForm(false);
      toast({ title: "Saved", description: "Measurements recorded successfully." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed", description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/customers/${params.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Customer deleted successfully." });
      router.push("/dashboard/customers");
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Delete failed", description: error.message });
    },
  });

  // Check if any outfit has entered production — if so, measurements are locked
  const isMeasurementsLocked = useMemo(() => {
    if (!customer?.orders) return false;
    return customer.orders.some((order: any) =>
      (order.outfits || []).some((outfit: any) =>
        PRODUCTION_STARTED_STATUSES.includes(outfit.status)
      )
    );
  }, [customer]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    if (!customer?.orders) return [];
    let orders = customer.orders;

    if (orderStatusFilter !== "all") {
      orders = orders.filter((o: any) => o.status === orderStatusFilter);
    }

    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      orders = orders.filter((o: any) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        (o.outfits || []).some((outfit: any) =>
          outfit.name?.toLowerCase().includes(q) || outfit.type?.toLowerCase().includes(q)
        )
      );
    }

    return orders;
  }, [customer, orderSearch, orderStatusFilter]);

  // Unique order statuses for filter
  const orderStatuses = useMemo(() => {
    if (!customer?.orders) return [];
    return [...new Set<string>(customer.orders.map((o: any) => o.status))].sort();
  }, [customer]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!customer) return <p className="text-muted-foreground">Customer not found</p>;

  const totalOrders = customer.orders?.length || 0;
  const totalOutfits = customer.orders?.reduce(
    (sum: number, o: any) => sum + (o.outfits?.length || 0), 0
  ) || 0;
  const totalPaid = customer.orders?.reduce(
    (sum: number, o: any) =>
      sum + (o.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0),
    0
  ) || 0;
  const totalEstimated = customer.orders?.reduce(
    (sum: number, o: any) => sum + (Number(o.estimatedAmount) || 0), 0
  ) || 0;
  const balance = totalEstimated - totalPaid;

  return (
    <div className="space-y-4">
      {/* Back */}
      <Link href="/dashboard/customers">
        <Button variant="ghost" size="sm" className="gap-1 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Customers
        </Button>
      </Link>

      {/* Customer Header Card */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: Name + Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold lg:text-2xl">{customer.name}</h1>
                <Link href={`/dashboard/customers/${customer.id}/edit`}>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                {can("delete", "customer") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                {customer.occasion && (
                  <Badge variant="outline">{customer.occasion}</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {customer.mobile}
                </span>
                {customer.whatsapp && (
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" /> {customer.whatsapp}
                  </span>
                )}
                {customer.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {customer.email}
                  </span>
                )}
                {customer.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {customer.address}
                  </span>
                )}
              </div>
              {customer.notes && (
                <p className="text-xs text-muted-foreground italic">{customer.notes}</p>
              )}
            </div>

            {/* Right: Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-lg font-bold">{totalOrders}</p>
                <p className="text-xs text-muted-foreground">Orders</p>
              </div>
              <div>
                <p className="text-lg font-bold">{totalOutfits}</p>
                <p className="text-xs text-muted-foreground">Outfits</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">₹{totalPaid.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Paid</p>
              </div>
              <div>
                <p className={`text-lg font-bold ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
                  ₹{Math.abs(balance).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">{balance > 0 ? "Balance" : "Settled"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Measurements Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Ruler className="h-5 w-5" /> Measurements
            {isMeasurementsLocked && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Lock className="h-3 w-3" /> Locked
              </Badge>
            )}
          </h2>
          {can("create", "measurement") && !isMeasurementsLocked && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowMeasurementForm(!showMeasurementForm)}
            >
              <Plus className="h-3.5 w-3.5" />
              {customer.measurements?.length > 0 ? "Update" : "Add"}
            </Button>
          )}
        </div>

        {isMeasurementsLocked && (
          <p className="text-xs text-muted-foreground">
            Measurements are locked because production has started on one or more outfits.
          </p>
        )}

        {/* Add/Update Measurement Form */}
        {showMeasurementForm && !isMeasurementsLocked && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {customer.measurements?.length > 0 ? "Update Measurements" : "Add Measurements"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                This will create a new version. Previous measurements are preserved in history.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const latest = customer.measurements?.[0]?.values || {};
                    setMeasurementValues({
                      Bust: latest.Bust || "",
                      Waist: latest.Waist || "",
                      Hip: latest.Hip || "",
                      Shoulder: latest.Shoulder || "",
                      "Arm Length": latest["Arm Length"] || "",
                      "Neck Front": latest["Neck Front"] || "",
                      "Front Length": latest["Front Length"] || "",
                      "Back Length": latest["Back Length"] || "",
                    });
                  }}
                >
                  Blouse Template
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const latest = customer.measurements?.[0]?.values || {};
                    setMeasurementValues({
                      Waist: latest.Waist || "",
                      Hip: latest.Hip || "",
                      Length: latest.Length || "",
                      Flare: latest.Flare || "",
                    });
                  }}
                >
                  Lehenga Template
                </Button>
                {customer.measurements?.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMeasurementValues({ ...customer.measurements[0].values });
                    }}
                  >
                    Copy Previous
                  </Button>
                )}
              </div>

              {Object.keys(measurementValues).length > 0 && (
                <div className="space-y-2">
                  <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
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
                      placeholder="Add custom field"
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
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={addMeasurementMutation.isPending}
                      onClick={() => addMeasurementMutation.mutate({ values: measurementValues })}
                    >
                      {addMeasurementMutation.isPending ? "Saving..." : "Save Measurements"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowMeasurementForm(false);
                        setMeasurementValues({});
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Display Latest Measurements */}
        {customer.measurements?.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex justify-between">
                <span>Version {customer.measurements[0].version}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {formatDate(customer.measurements[0].createdAt)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {Object.entries(customer.measurements[0].values as Record<string, string>).map(
                  ([key, value]) => (
                    <div key={key}>
                      <p className="text-xs text-muted-foreground">{key}</p>
                      <p className="text-sm font-medium">{value || "—"}</p>
                    </div>
                  )
                )}
              </div>
              {customer.measurements.length > 1 && (
                <p className="text-xs text-muted-foreground mt-3 border-t pt-2">
                  {customer.measurements.length - 1} previous version(s) recorded
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              <Ruler className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              No measurements recorded yet
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* Orders Header with Search/Filter */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Orders</h2>
          <div className="flex gap-2">
            {customer.portalToken && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const url = `${window.location.origin}/portal/${customer.portalToken}`;
                  const message = `Hi ${customer.name}! Track your outfit progress here: ${url}`;
                  window.open(`https://wa.me/${customer.mobile?.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`, "_blank");
                }}
              >
                Share via WhatsApp
              </Button>
            )}
            <Link href={`/dashboard/orders/new?customerId=${customer.id}`}>
              <Button size="sm">
                <ShoppingBag className="h-3.5 w-3.5" /> New Order
              </Button>
            </Link>
          </div>
        </div>

        {/* Search & Filter — only show if there are orders */}
        {totalOrders > 0 && (
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
                <option value="all">All Status</option>
                {orderStatuses.map((status: string) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Orders List */}
      {totalOrders === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Shirt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No orders yet</p>
            <Link href={`/dashboard/orders/new?customerId=${customer.id}`}>
              <Button size="sm" className="mt-3">Create First Order</Button>
            </Link>
          </CardContent>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No orders matching your search
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order: any) => {
            const orderPaid = (order.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
            const orderBalance = (Number(order.estimatedAmount) || 0) - orderPaid;

            return (
              <Link key={order.id} href={`/dashboard/orders/${order.id}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardContent className="pt-4 pb-4">
                    {/* Order header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{order.orderNumber}</p>
                        <Badge className={getStatusColor(order.status)} variant="secondary">
                          {order.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        {order.deliveryDate && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(order.deliveryDate)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Outfits in this order */}
                    {order.outfits?.length > 0 ? (
                      <div className="space-y-1.5">
                        {order.outfits.map((outfit: any) => (
                          <div
                            key={outfit.id}
                            className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <Shirt className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm font-medium">{outfit.name}</span>
                              <span className="text-xs text-muted-foreground">· {outfit.type}</span>
                            </div>
                            <Badge className={`text-[10px] ${getStatusColor(outfit.status)}`}>
                              {formatStatus(outfit.status)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No outfits added</p>
                    )}

                    {/* Payment summary */}
                    <div className="mt-2 pt-2 border-t flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <IndianRupee className="h-3 w-3" />
                          Paid: <span className="font-medium text-green-600">₹{orderPaid.toLocaleString()}</span>
                        </span>
                        {order.estimatedAmount && orderBalance > 0 && (
                          <span className="text-red-600 font-medium">
                            Bal: ₹{orderBalance.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(order.orderDate)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {customer.name}? This action cannot be undone.
              {totalOrders > 0 && " This customer has existing orders — delete them first."}
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
