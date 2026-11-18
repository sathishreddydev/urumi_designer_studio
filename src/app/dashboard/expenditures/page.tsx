"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, TrendingDown, ChevronLeft, ChevronRight, ShieldAlert, ReceiptText } from "lucide-react";

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
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
  date: localDate(),
  category: "",
  customCategory: "",
  description: "",
  amount: "",
  method: "CASH",
  vendor: "",
  notes: "",
});

type Expenditure = {
  id: string;
  date: string;
  category: typeof CATEGORIES[number]["value"];
  customCategory: string | null;
  description: string;
  amount: string;
  method: typeof METHODS[number]["value"];
  vendor: string | null;
  notes: string | null;
};

type ExpenditureResponse = {
  expenditures: Expenditure[];
  total: number;
  totalAmount: string;
  breakdown: { category: Expenditure["category"]; total: string | null }[];
};

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ExpendituresPage() {
  const router = useRouter();

  // Check authorization - ADMIN only
  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ["auth"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
  });

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && authData?.role && authData.role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [authData, authLoading, router]);

  // Show loading state
  if (authLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // Show access denied for non-admin users
  if (authData?.role !== "ADMIN") {
    return (
      <div className="flex h-96 items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldAlert className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Access Denied</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Only administrators can access expenditure management.
              </p>
            </div>
            <Button onClick={() => router.push("/dashboard")} className="mt-4">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is admin - render main content
  return <ExpendituresContent />;
}

// ─── main content ────────────────────────────────────────────────────────────

function ExpendituresContent() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [month, setMonth]         = useState(searchParams.get("month") || currentMonth());
  const [filterCat, setFilterCat] = useState(searchParams.get("cat") || "ALL");
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [form, setForm]           = useState<ExpenditureForm>(emptyForm());

  const syncToUrl = useCallback((overrides: Record<string, string> = {}) => {
    const next = {
      month: overrides.month !== undefined ? overrides.month : month,
      cat:   overrides.cat   !== undefined ? overrides.cat   : filterCat,
    };
    const params = new URLSearchParams();
    if (next.month && next.month !== currentMonth()) params.set("month", next.month);
    if (next.cat && next.cat !== "ALL") params.set("cat", next.cat);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [month, filterCat, pathname, router]);

  // ── data ────────────────────────────────────────────────────────────────────
  const queryKey = ["expenditures", month, filterCat];

  const { data, isLoading, error, refetch } = useQuery<ExpenditureResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ month, limit: "200" });
      if (filterCat !== "ALL") params.set("category", filterCat);
      const res = await fetch(`/api/expenditures?${params}`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch: ${errorText}`);
      }
      return res.json();
    },
  });

  const expenditures = data?.expenditures ?? [];
  const totalAmount = Number(data?.totalAmount ?? 0);
  const breakdown = data?.breakdown ?? [];

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
        if (!res.ok) throw new Error(`Could not update expenditure (error ${res.status}). Please try again.`);
        return res.json();
      } else {
        const res = await fetch("/api/expenditures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Could not save expenditure (error ${res.status}). Please check the details and try again.`);
        return res.json();
      }
    },
    onSuccess: (saved: Expenditure) => {
      queryClient.invalidateQueries({ queryKey: ["expenditures"] });
      const savedMonth = saved.date.slice(0, 7);
      if (savedMonth !== month) {
        setMonth(savedMonth);
        syncToUrl({ month: savedMonth });
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/expenditures/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Could not delete expenditure (error ${res.status}). Please try again.`);
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
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setMonth(newMonth);
    syncToUrl({ month: newMonth });
  }

  function nextMonth() {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setMonth(newMonth);
    syncToUrl({ month: newMonth });
  }

  function openEdit(exp: Expenditure) {
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
  }

  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm());
    saveMutation.reset();
  }

  const [y, m] = month.split("-").map(Number);
  const monthLabel = new Date(y, m - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const selectedCategory = CATEGORIES.find((category) => category.value === filterCat);
  const isCurrentMonth = month === currentMonth();

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

      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open && !saveMutation.isPending) cancelForm();
          else setShowForm(true);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit expenditure" : "Add expenditure"}</DialogTitle>
            <DialogDescription>
              Record the amount, category and payment details for this store expense.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="expenditure-date">Date <span className="text-destructive">*</span></Label>
                <Input
                  id="expenditure-date"
                  type="date"
                  required
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expenditure-category">Category <span className="text-destructive">*</span></Label>
                <Select
                  value={form.category}
                  onValueChange={(category) => setForm({
                    ...form,
                    category,
                    customCategory: category === "MISCELLANEOUS" ? form.customCategory : "",
                  })}
                  required
                >
                  <SelectTrigger id="expenditure-category"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.category === "MISCELLANEOUS" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="expenditure-custom-category">Expense type <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="expenditure-custom-category"
                    value={form.customCategory}
                    maxLength={100}
                    onChange={(event) => setForm({ ...form, customCategory: event.target.value })}
                    placeholder="e.g. Staff refreshments"
                  />
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="expenditure-description">Description <span className="text-destructive">*</span></Label>
                <Input
                  id="expenditure-description"
                  required
                  maxLength={250}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="e.g. Monthly shop rent or silk fabric purchase"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expenditure-amount">Amount (₹) <span className="text-destructive">*</span></Label>
                <Input
                  id="expenditure-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  required
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expenditure-method">Payment method</Label>
                <Select
                  value={form.method}
                  onValueChange={(method) => setForm({ ...form, method })}
                >
                  <SelectTrigger id="expenditure-method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expenditure-vendor">Vendor / paid to <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="expenditure-vendor"
                  maxLength={150}
                  value={form.vendor}
                  onChange={(event) => setForm({ ...form, vendor: event.target.value })}
                  placeholder="Landlord or supplier"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expenditure-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea
                  id="expenditure-notes"
                  className="min-h-10"
                  maxLength={500}
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="Additional details"
                />
              </div>
            </div>
            {saveMutation.error && (
              <p className="text-sm text-destructive" role="alert">{saveMutation.error.message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={cancelForm} disabled={saveMutation.isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending || !form.category || !form.description.trim() || !form.amount || Number(form.amount) <= 0}
              >
                {saveMutation.isPending ? "Saving…" : editId ? "Save changes" : "Save expenditure"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" aria-label="Previous month" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{monthLabel}</span>
          {!isCurrentMonth && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                const thisMonth = currentMonth();
                setMonth(thisMonth);
                syncToUrl({ month: thisMonth });
              }}
            >
              This month
            </Button>
          )}
        </div>
        <Button variant="outline" size="icon" aria-label="Next month" disabled={isCurrentMonth} onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Total + breakdown */}
      {isLoading ? (
        <Card className="animate-pulse">
          <CardContent className="h-24" />
        </Card>
      ) : (
        <div className="space-y-3">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {selectedCategory ? `${selectedCategory.label} total` : "Total this month"}
                  </p>
                  <p className="text-2xl font-bold">₹{totalAmount.toLocaleString("en-IN")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data?.total ?? 0} {data?.total === 1 ? "expense" : "expenses"} in {monthLabel}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-destructive/50" />
              </div>
            </CardContent>
          </Card>

          {filterCat === "ALL" && breakdown.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {breakdown
                .slice()
                .sort((a, b) => Number(b.total) - Number(a.total))
                .map((item) => {
                  const category = CATEGORIES.find((option) => option.value === item.category);
                  const label = category?.label ?? item.category;
                  return (
                    <button
                      type="button"
                      key={item.category}
                      className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Filter by ${label}, total ₹${Number(item.total).toLocaleString("en-IN")}`}
                      onClick={() => {
                        setFilterCat(item.category);
                        syncToUrl({ cat: item.category });
                      }}
                    >
                      <Card className="h-full transition-colors hover:border-primary/40">
                        <CardContent className="p-3">
                          <Badge className={`mb-1 text-xs ${CATEGORY_COLORS[item.category]}`}>{label}</Badge>
                          <p className="font-semibold text-sm">₹{Number(item.total).toLocaleString("en-IN")}</p>
                        </CardContent>
                      </Card>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter expenditures by category">
        <button
          type="button"
          aria-pressed={filterCat === "ALL"}
          onClick={() => { setFilterCat("ALL"); syncToUrl({ cat: "ALL" }); }}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filterCat === "ALL" ? "bg-primary text-primary-foreground border-transparent" : "border-border hover:border-primary/40"}`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            type="button"
            key={c.value}
            aria-pressed={filterCat === c.value}
            onClick={() => { const v = filterCat === c.value ? "ALL" : c.value; setFilterCat(v); syncToUrl({ cat: v }); }}
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
      {error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive font-medium mb-2">Error loading expenditures</p>
            <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
            <Button className="mt-4" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-16 pt-4" /></Card>
          ))}
        </div>
      ) : expenditures.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="mb-3 rounded-full bg-muted p-3">
              <ReceiptText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">
              {filterCat === "ALL" ? "No expenses recorded yet" : `No ${selectedCategory?.label.toLowerCase()} expenses`}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {filterCat === "ALL"
                ? `There are no expenditures for ${monthLabel}. Add an expense to start tracking your store costs.`
                : `There are no ${selectedCategory?.label.toLowerCase()} expenses for ${monthLabel}. Try another category or clear the filter.`}
            </p>
            {filterCat === "ALL" ? (
              <Button className="mt-4" onClick={() => { cancelForm(); setShowForm(true); }}>
                <Plus className="h-4 w-4" /> Add first expense
              </Button>
            ) : (
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => { setFilterCat("ALL"); syncToUrl({ cat: "ALL" }); }}
              >
                Clear category filter
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {expenditures.map((exp) => {
            const catLabel = exp.customCategory || CATEGORIES.find((c) => c.value === exp.category)?.label || exp.category;
            return (
              <Card key={exp.id}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <Badge className={`text-xs shrink-0 ${CATEGORY_COLORS[exp.category]}`}>
                          {catLabel}
                        </Badge>
                        <p className="font-medium text-sm break-words">{exp.description}</p>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{formatDate(exp.date)}</span>
                        <span>{METHODS.find((method) => method.value === exp.method)?.label ?? exp.method}</span>
                        {exp.vendor && <span>Paid to {exp.vendor}</span>}
                      </div>
                      {exp.notes && <p className="mt-1 break-words text-xs text-muted-foreground">{exp.notes}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-semibold text-sm">₹{Number(exp.amount).toLocaleString("en-IN")}</span>
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          aria-label={`Edit ${exp.description}`}
                          onClick={() => openEdit(exp)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${exp.description}`}
                          onClick={() => {
                            deleteMutation.reset();
                            setDeleteId(exp.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
              {expenditures.find((expenditure) => expenditure.id === deleteId)?.description
                ? `"${expenditures.find((expenditure) => expenditure.id === deleteId)?.description}" will be permanently deleted. This action cannot be undone.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMutation.error && (
            <p className="text-sm text-destructive" role="alert">{deleteMutation.error.message}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteId) deleteMutation.mutate(deleteId);
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
