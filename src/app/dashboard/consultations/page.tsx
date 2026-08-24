"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { OutfitTypeSelect } from "@/components/outfit-type-select";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Search, Plus, Trash2, ShoppingBag, Shirt, User,
  ChevronRight, ClipboardList, X, IndianRupee, ArrowLeft,
  CalendarIcon, Package, CalendarCheck,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type OutfitIdea = {
  id: string;
  type: string;
  notes: string;
  estimatedPrice: number | null;
  fabricSwatches: string[];
};

type Consultation = {
  id: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  createdByName: string;
  status: "draft" | "converted" | "cancelled";
  notes: string | null;
  estimatedAmount: string | null;
  convertedOrderId: string | null;
  outfitIdeas: OutfitIdea[];
  consultationDate: string | null;
  expectedDeliveryDate: string | null;
  expectedTrialDate: string | null;
  createdAt: string;
  updatedAt: string;
};

// ─── New Consultation Form (inline panel) ─────────────────────────────────────
function NewConsultationForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [consultationDate, setConsultationDate] = useState<Date | undefined>(new Date());
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date | undefined>(undefined);
  const [expectedTrialDate, setExpectedTrialDate] = useState<Date | undefined>(undefined);
  const [ideas, setIdeas] = useState<OutfitIdea[]>([
    { id: crypto.randomUUID(), type: "", notes: "", estimatedPrice: null, fabricSwatches: [] },
  ]);

  const { data: customerResults } = useQuery({
    queryKey: ["customer-search", customerSearch],
    queryFn: async () => {
      if (!customerSearch.trim()) return { customers: [] };
      const res = await fetch(`/api/customers?search=${encodeURIComponent(customerSearch)}&limit=8`);
      if (!res.ok) return { customers: [] };
      return res.json();
    },
    enabled: customerSearch.length > 1,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const validIdeas = ideas.filter((i) => i.type);
      const total = validIdeas.reduce((s, i) => s + (i.estimatedPrice || 0), 0);
      const res = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          notes: notes || null,
          outfitIdeas: validIdeas,
          estimatedAmount: total > 0 ? total : null,
          consultationDate: consultationDate?.toISOString() ?? null,
          expectedDeliveryDate: expectedDeliveryDate?.toISOString() ?? null,
          expectedTrialDate: expectedTrialDate?.toISOString() ?? null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create consultation");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Consultation saved" });
      onSaved();
    },
    onError: () => toast({ variant: "destructive", title: "Failed to save consultation" }),
  });

  function addIdea() {
    setIdeas((p) => [...p, { id: crypto.randomUUID(), type: "", notes: "", estimatedPrice: null, fabricSwatches: [] }]);
  }
  function updateIdea(id: string, field: keyof OutfitIdea, value: any) {
    setIdeas((p) => p.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }
  function removeIdea(id: string) {
    setIdeas((p) => p.filter((i) => i.id !== id));
  }

  const totalEstimate = ideas.reduce((s, i) => s + (i.estimatedPrice || 0), 0);

  return (
    <div className="space-y-5">
      {/* Back arrow + title */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">New Consultation</h2>
      </div>

      {/* Customer */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Customer *</Label>
        {selectedCustomer ? (
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
            <div>
              <p className="text-sm font-medium">{selectedCustomer.name}</p>
              <p className="text-xs text-muted-foreground">{selectedCustomer.mobile}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => { setSelectedCustomer(null); setCustomerId(""); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or mobile..."
              className="pl-9"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
            {customerResults?.customers?.length > 0 && (
              <div className="absolute top-full z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                {customerResults.customers.map((c: any) => (
                  <button key={c.id} type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => { setSelectedCustomer(c); setCustomerId(c.id); setCustomerSearch(""); }}
                  >
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.mobile}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Notes</Label>
        <Textarea
          placeholder="Occasion, style preferences, special requests..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="text-sm resize-none"
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Consultation date */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Consultation Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={`w-full justify-start text-left font-normal text-xs h-9 ${!consultationDate && "text-muted-foreground"}`}>
                <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0" />
                {consultationDate ? format(consultationDate, "dd MMM yyyy") : "Today"}
                {consultationDate && (
                  <span role="button" className="ml-auto opacity-50 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setConsultationDate(undefined); }}>
                    <X className="h-3 w-3" />
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker mode="single" selected={consultationDate} onSelect={setConsultationDate} initialFocus />
            </PopoverContent>
          </Popover>
        </div>

        {/* Expected trial date */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Expected Trial</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={`w-full justify-start text-left font-normal text-xs h-9 ${!expectedTrialDate && "text-muted-foreground"}`}>
                <CalendarCheck className="mr-2 h-3.5 w-3.5 shrink-0" />
                {expectedTrialDate ? format(expectedTrialDate, "dd MMM yyyy") : "Pick a date"}
                {expectedTrialDate && (
                  <span role="button" className="ml-auto opacity-50 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setExpectedTrialDate(undefined); }}>
                    <X className="h-3 w-3" />
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={expectedTrialDate}
                onSelect={setExpectedTrialDate}
                disabled={{ before: new Date() }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Expected delivery date */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Expected Delivery</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={`w-full justify-start text-left font-normal text-xs h-9 ${!expectedDeliveryDate && "text-muted-foreground"}`}>
                <Package className="mr-2 h-3.5 w-3.5 shrink-0" />
                {expectedDeliveryDate ? format(expectedDeliveryDate, "dd MMM yyyy") : "Pick a date"}
                {expectedDeliveryDate && (
                  <span role="button" className="ml-auto opacity-50 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setExpectedDeliveryDate(undefined); }}>
                    <X className="h-3 w-3" />
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={expectedDeliveryDate}
                onSelect={setExpectedDeliveryDate}
                disabled={{ before: new Date() }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Separator />

      {/* Outfit ideas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Outfit Ideas</Label>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addIdea}>
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>

        {ideas.map((idea, idx) => (
          <div key={idea.id} className="rounded-lg border p-3 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Outfit {idx + 1}</span>
              {ideas.length > 1 && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeIdea(idea.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Type *</Label>
                <OutfitTypeSelect value={idea.type} onValueChange={(v) => updateIdea(idea.id, "type", v)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Est. Price (₹)</Label>
                <Input type="number" placeholder="0" className="h-9 text-sm"
                  value={idea.estimatedPrice ?? ""}
                  onChange={(e) => updateIdea(idea.id, "estimatedPrice", e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Notes / Fabric preference</Label>
              <Input placeholder="e.g. Raw silk, heavy zari, mirror work..." className="h-8 text-xs"
                value={idea.notes}
                onChange={(e) => updateIdea(idea.id, "notes", e.target.value)}
              />
            </div>
          </div>
        ))}

        {totalEstimate > 0 && (
          <div className="flex justify-end items-center gap-1.5 text-sm font-semibold">
            <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
            Total Estimate: ₹{totalEstimate.toLocaleString()}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <LoadingButton className="flex-1" loading={mutation.isPending} disabled={!customerId}
          onClick={() => mutation.mutate()}>
          Save Consultation
        </LoadingButton>
      </div>
    </div>
  );
}

// ─── Consultation Card ────────────────────────────────────────────────────────
function ConsultationCard({ consultation }: { consultation: Consultation }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [confirmConvert, setConfirmConvert] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const convertMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/consultations/${consultation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["consultations"] });
      toast({ title: `Order ${data.orderNumber} created` });
      router.push(`/dashboard/orders/${data.orderId}`);
    },
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/consultations/${consultation.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultations"] });
      toast({ title: "Consultation cancelled" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to cancel" }),
  });

  const totalEstimate = consultation.outfitIdeas?.reduce((s, i) => s + (i.estimatedPrice || 0), 0) ?? 0;

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="pt-4 pb-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="font-semibold text-sm truncate">{consultation.customerName}</p>
              </div>
              <p className="text-xs text-muted-foreground ml-5">{consultation.customerMobile}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge
                variant={consultation.status === "converted" ? "default" : consultation.status === "cancelled" ? "destructive" : "secondary"}
                className="text-[10px]"
              >
                {consultation.status}
              </Badge>
              <span className="text-[10px] text-muted-foreground">{formatDate(consultation.createdAt)}</span>
            </div>
          </div>

          {consultation.notes && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded px-2.5 py-1.5 line-clamp-2">
              {consultation.notes}
            </p>
          )}

          {/* Dates row */}
          {(consultation.consultationDate || consultation.expectedTrialDate || consultation.expectedDeliveryDate) && (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {consultation.consultationDate && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarIcon className="h-3 w-3" />
                  {formatDate(consultation.consultationDate)}
                </span>
              )}
              {consultation.expectedTrialDate && (
                <span className="flex items-center gap-1 text-[11px] text-blue-600">
                  <CalendarCheck className="h-3 w-3" />
                  Trial: {formatDate(consultation.expectedTrialDate)}
                </span>
              )}
              {consultation.expectedDeliveryDate && (
                <span className="flex items-center gap-1 text-[11px] text-amber-600">
                  <Package className="h-3 w-3" />
                  Delivery: {formatDate(consultation.expectedDeliveryDate)}
                </span>
              )}
            </div>
          )}

          {consultation.outfitIdeas?.length > 0 && (
            <div className="space-y-1">
              {consultation.outfitIdeas.map((idea, i) => (
                <div key={i} className="flex items-center justify-between text-xs rounded bg-muted/30 px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Shirt className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{idea.type || "Unnamed"}</span>
                    {idea.notes && <span className="text-muted-foreground truncate hidden sm:inline">· {idea.notes}</span>}
                  </div>
                  {idea.estimatedPrice && (
                    <span className="font-medium shrink-0 ml-2">₹{idea.estimatedPrice.toLocaleString()}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="text-xs text-muted-foreground">
              {consultation.outfitIdeas?.length || 0} outfit{consultation.outfitIdeas?.length !== 1 ? "s" : ""}
              {totalEstimate > 0 && <span className="ml-2 font-semibold text-foreground">· ₹{totalEstimate.toLocaleString()} est.</span>}
            </div>

            {consultation.status === "draft" && (
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => setConfirmCancel(true)}>
                  Cancel
                </Button>
                <LoadingButton size="sm" className="h-7 text-xs gap-1"
                  loading={convertMutation.isPending} onClick={() => setConfirmConvert(true)}>
                  <ShoppingBag className="h-3 w-3" /> Convert to Order
                </LoadingButton>
              </div>
            )}

            {consultation.status === "converted" && consultation.convertedOrderId && (
              <Link href={`/dashboard/orders/${consultation.convertedOrderId}`}>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <ChevronRight className="h-3 w-3" /> View Order
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmConvert} onOpenChange={setConfirmConvert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Creates a new order for <strong>{consultation.customerName}</strong> with{" "}
              {consultation.outfitIdeas?.length || 0} outfit(s) in DRAFT status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmConvert(false); convertMutation.mutate(); }}>
              Yes, create order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel consultation?</AlertDialogTitle>
            <AlertDialogDescription>Marks it as cancelled. It won't be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => { setConfirmCancel(false); cancelMutation.mutate(); }}>
              Cancel consultation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ConsultationsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("draft");

  const { data, isLoading } = useQuery({
    queryKey: ["consultations", statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/consultations?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Consultation[]>;
    },
  });

  const consultationList = data || [];

  // ── When form is open, show only the form ────────────────────────────
  if (showForm) {
    return (
      <div className="max-w-xl">
        <NewConsultationForm
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["consultations"] });
            setShowForm(false);
          }}
        />
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Consultations</h1>
          <p className="text-xs text-muted-foreground">Pre-order discussions with customers</p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> New Consultation
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by customer or notes..." className="pl-9"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : consultationList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {statusFilter === "draft" ? "No pending consultations" : "No consultations found"}
            </p>
            {statusFilter === "draft" && (
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setShowForm(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> New Consultation
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {consultationList.map((c) => <ConsultationCard key={c.id} consultation={c} />)}
        </div>
      )}
    </div>
  );
}
