"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Pencil, Trash2, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react";

// ─── constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "RENT",          label: "Rent" },
  { value: "MATERIAL",      label: "Material" },
  { value: "ELECTRICITY",   label: "Electricity" },
  { value: "WATER",         label: "Water" },
  { value: "EQUIPMENT",     label: "Equipment" },
  { value: "MAINTENANCE",   label: "Maintenance" },
  { value: "TRANSPORT",     label: "Transport" },
  { value: "MARKETING",     label: "Marketing" },
  { value: "MISCELLANEOUS", label: "Miscellaneous" },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  RENT:          "bg-purple-100 text-purple-700",
  MATERIAL:      "bg-orange-100 text-orange-700",
  ELECTRICITY:   "bg-yellow-100 text-yellow-700",
  WATER:         "bg-blue-100 text-blue-700",
  EQUIPMENT:     "bg-cyan-100 text-cyan-700",
  MAINTENANCE:   "bg-red-100 text-red-700",
  TRANSPORT:     "bg-green-100 text-green-700",
  MARKETING:     "bg-pink-100 text-pink-700",
  MISCELLANEOUS: "bg-gray-100 text-gray-700",
};

const METHODS = [
  { value: "CASH",          label: "Cash" },
  { value: "UPI",           label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CARD",          label: "Card" },
];

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ─── form default ─────────────────────────────────────────────────────────────

interface ExpenditureForm {
  date: string;
  category: string;
  customCategory: string;
  description: string;
  amount: string;
  method: string;
  vendor: string;
  notes: string;
}

const emptyForm = (): ExpenditureForm => ({
  date: new Date().toISOString().split("T")[0],
  category: "",
  customCategory: "",
  description: "",
  amount: "",
  method: "CASH",
  vendor: "",
  notes: "",
});

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ExpendituresPage() {
  const queryClient = useQueryClient();
  const [month, setMonth]         = useState(currentMonth());
  const [filterCat, setFilterCat] = useState("ALL");
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [form, setForm]           = useState<ExpenditureForm>(emptyForm());

  // ── data ────────────────────────────────────────────────────────────────────
  const queryKey = ["expenditures", month, filterCat];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ month, limit: "200" });
      if (filterCat !== "ALL") params.set("category", filterCat);
      const res = await fetch(`/api/expenditures?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const expenditures: any[] = data?.expenditures ?? [];
  const totalAmount = Number(data?.totalAmount ?? 0);
  const breakdown: any[] = data?.breakdown ?? [];

  // ── mutations ────────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        date: form.date,
        category: form.category,
        customCategory: form.customCategory || undefined,
        description: form.description,
        amount: parseFloat(form.amount),
        method: form.method,
        vendor: form.vendor || undefined,
        notes: form.notes || undefined,
      };

      if (editId) {
        const res = await fetch(`/api/expenditures/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update");
        return res.json();
      } else {
        const res = await fetch("/api/expenditures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create");
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenditures"] });
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/expenditures/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenditures"] });
      setDeleteId(null);
    },
  });

  // ── month nav ─────────────────────────────────────────────────────────────

  function prevMonth() {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function nextMonth() {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function openEdit(exp: any) {
    setForm({
      date: exp.date,
      category: exp.category,
      customCategory: exp.customCategory ?? "",
      description: exp.description,
      amount: String(exp.amount),
      method: exp.method,
      vendor: exp.vendor ?? "",
      notes: exp.notes ?? "",
    });
    setEditId(exp.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm());
  }

  const [y, m] = month.split("-").map(Number);
  const monthLabel = new Date(y, m - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expenditures</h1>
          <p className="text-xs text-muted-foreground">Track store expenses — rent, materials &amp; more</p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => { cancelForm(); setShowForm(true); }}
        >
          <Plus className="h-4 w-4" /> Add Expenditure
        </Button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{editId ? "Edit Expenditure" : "New Expenditure"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Date */}
              <div className="space-y-1">
                <Label className="text-xs">Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>

              {/* Category */}
              <div className="space-y-1">
                <Label className="text-xs">Category *</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) => setForm({ ...form, category: val })}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Description *</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Monthly rent for shop, Silk fabric purchase…"
                  className="h-9 text-sm"
                />
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <Label className="text-xs">Amount (₹) *</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  className="h-9 text-sm"
                />
              </div>

              {/* Method */}
              <div className="space-y-1">
                <Label className="text-xs">Payment Method</Label>
                <Select
                  value={form.method}
                  onValueChange={(val) => setForm({ ...form, method: val })}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Vendor */}
              <div className="space-y-1">
                <Label className="text-xs">Vendor / Paid To <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  value={form.vendor}
                  onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                  placeholder="e.g. Landlord name, supplier…"
                  className="h-9 text-sm"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label className="text-xs">Notes <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any additional details…"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {saveMutation.error && (
              <p className="text-sm text-destructive">{saveMutation.error.message}</p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={cancelForm}>Cancel</Button>
              <Button
                size="sm"
                disabled={saveMutation.isPending || !form.category || !form.description || !form.amount}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "Saving…" : editId ? "Save Changes" : "Add Expenditure"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold text-sm">{monthLabel}</span>
        <Button variant="outline" size="sm" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Total + breakdown */}
      {!isLoading && (
        <div className="space-y-3">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total This Month</p>
                  <p className="text-2xl font-bold">₹{totalAmount.toLocaleString("en-IN")}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-destructive/50" />
              </div>
            </CardContent>
          </Card>

          {breakdown.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {breakdown
                .sort((a, b) => Number(b.total) - Number(a.total))
                .map((b: any) => {
                  const label = CATEGORIES.find((c) => c.value === b.category)?.label ?? b.category;
                  return (
                    <Card key={b.category} className="cursor-pointer hover:border-primary/40"
                      onClick={() => setFilterCat(filterCat === b.category ? "ALL" : b.category)}
                    >
                      <CardContent className="p-3">
                        <Badge className={`text-xs mb-1 ${CATEGORY_COLORS[b.category]}`}>{label}</Badge>
                        <p className="font-semibold text-sm">₹{Number(b.total).toLocaleString("en-IN")}</p>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterCat("ALL")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filterCat === "ALL" ? "bg-primary text-primary-foreground border-transparent" : "border-border hover:border-primary/40"}`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setFilterCat(filterCat === c.value ? "ALL" : c.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filterCat === c.value
                ? "bg-primary text-primary-foreground border-transparent"
                : "border-border hover:border-primary/40"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-16 pt-4" /></Card>
          ))}
        </div>
      ) : expenditures.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No expenditures recorded for {monthLabel}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {expenditures.map((exp: any) => {
            const catLabel = CATEGORIES.find((c) => c.value === exp.category)?.label ?? exp.category;
            return (
              <Card key={exp.id}>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <Badge className={`text-xs shrink-0 ${CATEGORY_COLORS[exp.category]}`}>
                          {catLabel}
                        </Badge>
                        <p className="font-medium text-sm truncate">{exp.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{formatDate(exp.date)}</span>
                        {exp.vendor && <span>· {exp.vendor}</span>}
                        <span>· {exp.method.replace("_", " ")}</span>
                        {exp.notes && <span>· {exp.notes}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold text-sm">₹{Number(exp.amount).toLocaleString("en-IN")}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(exp)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(exp.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expenditure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
