"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  ArrowLeft,
  Briefcase,
  Phone,
  Clock,
  Pencil,
  Trash2,
  CalendarDays,
  IndianRupee,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";

// ─── helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split("T")[0];
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function daysInMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

const ATTENDANCE_COLORS: Record<string, string> = {
  PRESENT:  "bg-green-500",
  ABSENT:   "bg-red-500",
  HALF_DAY: "bg-yellow-400",
  HOLIDAY:  "bg-blue-400",
};

const ATTENDANCE_LABEL: Record<string, string> = {
  PRESENT: "Present", ABSENT: "Absent", HALF_DAY: "Half Day", HOLIDAY: "Holiday",
};

// ─── page ─────────────────────────────────────────────────────────────────────

export default function EmployeeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"attendance" | "salary" | "advances">("attendance");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: emp, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      router.push("/dashboard/employees");
    },
  });

  if (isLoading || !emp) {
    return <div className="h-8 w-48 animate-pulse rounded bg-muted" />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/employees">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{emp.name}</h1>
              <Badge className={emp.payCycle === "WEEKLY" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>
                {emp.payCycle}
              </Badge>
              {!emp.active && <Badge variant="outline">Inactive</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{emp.jobRole}</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/dashboard/employees/${id}/edit`}>
            <Button variant="outline" size="sm"><Pencil className="h-4 w-4" /> Edit</Button>
          </Link>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Info strip */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">₹{Number(emp.salaryAmount).toLocaleString()}</span>
              <span className="text-muted-foreground">/ {emp.payCycle === "WEEKLY" ? "week" : "month"}</span>
            </div>
            {emp.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />{emp.phone}
              </div>
            )}
            {emp.shiftStart && emp.shiftEnd && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />{emp.shiftStart} – {emp.shiftEnd}
              </div>
            )}
            {emp.notes && (
              <p className="text-muted-foreground text-xs w-full">{emp.notes}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["attendance", "salary", "advances"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "advances" ? "Advances" : t === "salary" ? "Salary" : "Attendance"}
          </button>
        ))}
      </div>

      {tab === "attendance" && <AttendanceTab employeeId={id} payCycle={emp.payCycle} salaryAmount={Number(emp.salaryAmount)} />}
      {tab === "salary"     && <SalaryTab employeeId={id} payCycle={emp.payCycle} salaryAmount={Number(emp.salaryAmount)} />}
      {tab === "advances"   && <AdvancesTab employeeId={id} />}

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {emp.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this employee and all their records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
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

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceTab({
  employeeId,
  payCycle,
  salaryAmount,
}: {
  employeeId: string;
  payCycle: string;
  salaryAmount: number;
}) {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("PRESENT");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [notes, setNotes] = useState("");

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance", employeeId, month],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/attendance?month=${month}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          status,
          checkIn: checkIn || undefined,
          checkOut: checkOut || undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", employeeId, month] });
      setSelectedDate(null);
      setNotes("");
    },
  });

  const recordMap: Record<string, any> = {};
  records.forEach((r: any) => { recordMap[r.date] = r; });

  const days = daysInMonth(month);
  const [y, m] = month.split("-").map(Number);

  // Stats
  const present  = records.filter((r: any) => r.status === "PRESENT").length;
  const halfDay  = records.filter((r: any) => r.status === "HALF_DAY").length;
  const absent   = records.filter((r: any) => r.status === "ABSENT").length;
  const holiday  = records.filter((r: any) => r.status === "HOLIDAY").length;
  const effectiveDays = present + halfDay * 0.5;

  // Estimated salary for the month
  const perDay = payCycle === "MONTHLY" ? salaryAmount / days : salaryAmount / 7;
  const estimated = Math.round(effectiveDays * perDay);

  function openDay(date: string) {
    setSelectedDate(date);
    const existing = recordMap[date];
    setStatus(existing?.status ?? "PRESENT");
    setCheckIn(existing?.checkIn ?? "");
    setCheckOut(existing?.checkOut ?? "");
    setNotes(existing?.notes ?? "");
  }

  // Navigate months
  function prevMonth() {
    const d = new Date(y, m - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  function nextMonth() {
    const d = new Date(y, m, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div className="space-y-4">
      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={prevMonth}>‹</Button>
        <span className="font-semibold">
          {new Date(y, m - 1).toLocaleString("en-IN", { month: "long", year: "numeric" })}
        </span>
        <Button variant="outline" size="sm" onClick={nextMonth}>›</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Present", value: present, color: "text-green-600" },
          { label: "Half Day", value: halfDay, color: "text-yellow-600" },
          { label: "Absent", value: absent, color: "text-red-600" },
          { label: "Holiday", value: holiday, color: "text-blue-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Effective days: <span className="font-semibold text-foreground">{effectiveDays}</span></p>
          <p className="text-xs text-muted-foreground">Estimated pay: <span className="font-semibold text-foreground">₹{estimated.toLocaleString()}</span></p>
        </CardContent>
      </Card>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-1">
        {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {/* leading empty cells */}
        {Array.from({ length: new Date(y, m - 1, 1).getDay() }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          const rec = recordMap[date];
          const isToday = date === today();
          return (
            <button
              key={date}
              onClick={() => openDay(date)}
              className={`aspect-square rounded-md flex flex-col items-center justify-center text-xs font-medium transition-colors border
                ${rec ? ATTENDANCE_COLORS[rec.status] + " text-white border-transparent" : "border-border hover:border-primary/40 hover:bg-muted"}
                ${isToday && !rec ? "border-primary" : ""}
              `}
            >
              <span>{i + 1}</span>
              {rec && <span className="text-[8px] leading-none opacity-80">{rec.status === "HALF_DAY" ? "½" : rec.status === "HOLIDAY" ? "H" : ""}</span>}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(ATTENDANCE_LABEL).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className={`h-3 w-3 rounded-sm ${ATTENDANCE_COLORS[k]}`} />
            {v}
          </span>
        ))}
      </div>

      {/* Mark attendance dialog */}
      {selectedDate && (
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Mark Attendance — {formatDate(selectedDate)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["PRESENT", "HALF_DAY", "ABSENT", "HOLIDAY"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`rounded-md border py-2 text-xs font-medium transition-colors ${
                    status === s
                      ? ATTENDANCE_COLORS[s] + " text-white border-transparent"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {ATTENDANCE_LABEL[s]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Check In</Label>
                <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Check Out</Label>
                <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-8 text-xs" placeholder="Optional note" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(null)}>Cancel</Button>
              <Button size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Salary Tab ───────────────────────────────────────────────────────────────

function SalaryTab({
  employeeId,
  payCycle,
  salaryAmount,
}: {
  employeeId: string;
  payCycle: string;
  salaryAmount: number;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd]     = useState("");
  const [gross, setGross]             = useState(String(salaryAmount));
  const [deductions, setDeductions]   = useState("0");
  const [method, setMethod]           = useState("CASH");
  const [notes, setNotes]             = useState("");

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["salary", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/salary`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const net = Math.max(0, parseFloat(gross || "0") - parseFloat(deductions || "0"));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/salary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart,
          periodEnd,
          grossAmount: parseFloat(gross),
          deductions: parseFloat(deductions || "0"),
          netAmount: net,
          method,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary", employeeId] });
      setShowForm(false);
      setNotes("");
    },
  });

  const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.netAmount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Total paid: <span className="font-semibold text-foreground">₹{totalPaid.toLocaleString()}</span>
        </p>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Record Payment"}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Record Salary Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Period Start *</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Period End *</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Gross Amount (₹)</Label>
                <Input type="number" min={0} value={gross} onChange={(e) => setGross(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Deductions (₹)</Label>
                <Input type="number" min={0} value={deductions} onChange={(e) => setDeductions(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <div className="rounded-md bg-muted p-2 text-sm">
              Net payable: <span className="font-bold">₹{net.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Payment Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-8 text-xs" placeholder="Optional" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={saveMutation.isPending || !periodStart || !periodEnd}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "Saving…" : "Record Payment"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Card key={i} className="animate-pulse"><CardContent className="h-14 pt-4" /></Card>)}
        </div>
      ) : payments.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No salary payments recorded yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {payments.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {Number(p.deductions) > 0 && (
                        <span className="text-xs text-muted-foreground line-through">₹{Number(p.grossAmount).toLocaleString()}</span>
                      )}
                      <span className="font-semibold">₹{Number(p.netAmount).toLocaleString()}</span>
                      <Badge variant="outline" className="text-xs">{p.method}</Badge>
                    </div>
                    {p.notes && <p className="text-xs text-muted-foreground mt-0.5">{p.notes}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {new Date(p.paidAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Advances Tab ─────────────────────────────────────────────────────────────

function AdvancesTab({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount]     = useState("");
  const [reason, setReason]     = useState("");
  const [notes, setNotes]       = useState("");

  const { data: advances = [], isLoading } = useQuery({
    queryKey: ["advances", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/advances`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const issueMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/advances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          reason: reason || undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advances", employeeId] });
      setShowForm(false);
      setAmount("");
      setReason("");
      setNotes("");
    },
  });

  const recoverMutation = useMutation({
    mutationFn: async ({
      advanceId,
      recoveredAmount,
      status,
    }: {
      advanceId: string;
      recoveredAmount: number;
      status: string;
    }) => {
      const res = await fetch(`/api/employees/${employeeId}/advances`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advanceId, recoveredAmount, status }),
      });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advances", employeeId] });
    },
  });

  const outstanding = advances
    .filter((a: any) => a.status !== "RECOVERED")
    .reduce((sum: number, a: any) => sum + Number(a.amount) - Number(a.recoveredAmount), 0);

  const STATUS_COLORS: Record<string, string> = {
    OUTSTANDING: "bg-red-100 text-red-700",
    PARTIALLY_RECOVERED: "bg-yellow-100 text-yellow-700",
    RECOVERED: "bg-green-100 text-green-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Outstanding: <span className="font-semibold text-destructive">₹{outstanding.toLocaleString()}</span>
        </p>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Issue Advance"}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Issue Advance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Amount (₹) *</Label>
                <Input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="e.g. 2000"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reason</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 text-xs" placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-8 text-xs" placeholder="Optional" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={issueMutation.isPending || !amount}
                onClick={() => issueMutation.mutate()}
              >
                {issueMutation.isPending ? "Saving…" : "Issue Advance"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Card key={i} className="animate-pulse"><CardContent className="h-14 pt-4" /></Card>)}
        </div>
      ) : advances.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No advances recorded yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {advances.map((a: any) => (
            <AdvanceCard
              key={a.id}
              advance={a}
              statusColors={STATUS_COLORS}
              onRecover={({ recoveredAmount, status }) =>
                recoverMutation.mutate({ advanceId: a.id, recoveredAmount, status })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdvanceCard({
  advance,
  statusColors,
  onRecover,
}: {
  advance: any;
  statusColors: Record<string, string>;
  onRecover: (data: { recoveredAmount: number; status: string }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [recovered, setRecovered] = useState(String(advance.recoveredAmount));

  function computeStatus(rec: number) {
    if (rec >= Number(advance.amount)) return "RECOVERED";
    if (rec > 0) return "PARTIALLY_RECOVERED";
    return "OUTSTANDING";
  }

  function save() {
    const r = Math.min(parseFloat(recovered || "0"), Number(advance.amount));
    onRecover({ recoveredAmount: r, status: computeStatus(r) });
    setEditing(false);
  }

  const balance = Number(advance.amount) - Number(advance.recoveredAmount);

  return (
    <Card>
      <CardContent className="pt-3 pb-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">₹{Number(advance.amount).toLocaleString()}</span>
              <Badge className={`text-xs ${statusColors[advance.status]}`}>{advance.status.replace("_", " ")}</Badge>
            </div>
            {advance.reason && <p className="text-xs text-muted-foreground">{advance.reason}</p>}
            <p className="text-xs text-muted-foreground">
              Issued: {new Date(advance.issuedAt).toLocaleDateString("en-IN")}
              {Number(advance.recoveredAmount) > 0 && (
                <> · Recovered: ₹{Number(advance.recoveredAmount).toLocaleString()} · Balance: ₹{balance.toLocaleString()}</>
              )}
            </p>
          </div>
          {advance.status !== "RECOVERED" && (
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => setEditing(!editing)}>
              <TrendingDown className="h-3 w-3" /> Recover
            </Button>
          )}
        </div>

        {editing && (
          <div className="flex items-center gap-2 pt-1 border-t">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Total Recovered (₹)</Label>
              <Input
                type="number"
                min={0}
                max={Number(advance.amount)}
                value={recovered}
                onChange={(e) => setRecovered(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex gap-1 self-end">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={save}>Save</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
