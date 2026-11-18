"use client";

import { useEffect, useState } from "react";
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
  Pencil,
  Trash2,
  CalendarDays,
  IndianRupee,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { currentEmploymentDate, isEmployedOnDate, type EmploymentPeriod } from "@/lib/employee-employment";
import { calculateEmployeePeriodEarnings, calculateWorkedHours, DEFAULT_WORK_SCHEDULE, getRegularShiftHours, WorkScheduleSettings } from "@/lib/employee-hours";

// ─── helpers ──────────────────────────────────────────────────────────────────

function today() {
  return currentEmploymentDate();
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
            {emp.notes && (
              <p className="text-muted-foreground text-xs w-full">{emp.notes}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <EmploymentHistory employeeId={id} periods={emp.employmentPeriods ?? []} />

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

      {tab === "attendance" && <AttendanceTab employeeId={id} payCycle={emp.payCycle} salaryAmount={Number(emp.salaryAmount)} employmentPeriods={emp.employmentPeriods ?? []} />}
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

function EmploymentHistory({ employeeId, periods }: { employeeId: string; periods: EmploymentPeriod[] }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<EmploymentPeriod[]>(periods);

  useEffect(() => setDraft(periods), [periods]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/employees/${employeeId}/employment-periods`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periods: draft }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to save employment history");
      return result;
    },
    onSuccess: (updatedPeriods) => {
      queryClient.setQueryData(["employee", employeeId], (current: any) =>
        current ? { ...current, employmentPeriods: updatedPeriods, active: updatedPeriods.some(
          (period: EmploymentPeriod) => isEmployedOnDate([period], today())
        ) } : current
      );
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-range"] });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Employment periods</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Attendance is allowed only on dates inside these periods. Leave the end date empty for a current period.
        </p>
        {draft.map((period, index) => (
          <div key={`${index}-${period.startDate}`} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={period.startDate}
                onChange={(event) => setDraft((items) => items.map((item, i) => i === index ? { ...item, startDate: event.target.value } : item))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Through</Label>
              <Input
                type="date"
                value={period.endDate ?? ""}
                onChange={(event) => setDraft((items) => items.map((item, i) => i === index ? { ...item, endDate: event.target.value || null } : item))}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setDraft((items) => items.filter((_, i) => i !== index))}>
              Remove
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setDraft((items) => [...items, { startDate: today(), endDate: null }])}>
            Add period
          </Button>
          <Button size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving…" : "Save periods"}
          </Button>
          {saveMutation.isError && <p className="self-center text-xs text-destructive">{saveMutation.error.message}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceTab({
  employeeId,
  payCycle,
  salaryAmount,
  employmentPeriods,
}: {
  employeeId: string;
  payCycle: string;
  salaryAmount: number;
  employmentPeriods: EmploymentPeriod[];
}) {
  const [month, setMonth] = useState(currentMonth());

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance", employeeId, month],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/attendance?month=${month}`);
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: schedule = DEFAULT_WORK_SCHEDULE } = useQuery<WorkScheduleSettings>({
    queryKey: ["employee-payroll-settings"],
    queryFn: async () => {
      const response = await fetch("/api/employees/payroll-settings");
      if (!response.ok) throw new Error("Failed to load work schedule");
      return response.json();
    },
  });
  const { data: publicHolidays = [], isError: publicHolidaysError } = useQuery<{ date: string; name: string }[]>({
    queryKey: ["employee-public-holidays"],
    queryFn: async () => {
      const response = await fetch("/api/employees/public-holidays");
      if (!response.ok) throw new Error("Failed to load public holidays");
      return response.json();
    },
  });

  const recordMap: Record<string, any> = {};
  records.forEach((r: any) => { recordMap[r.date] = r; });
  const validRecords = records.filter((record: any) => isEmployedOnDate(employmentPeriods, record.date));

  const days = daysInMonth(month);
  const [y, m] = month.split("-").map(Number);
  const workingDays = Array.from({ length: days }, (_, index) => new Date(y, m - 1, index + 1))
    .filter((date) => date.getDay() !== 0).length;
  const publicHolidayDates = publicHolidays
    .filter((holiday) =>
      holiday.date.startsWith(month) &&
      isEmployedOnDate(employmentPeriods, holiday.date)
    )
    .map((holiday) => holiday.date);
  const publicHolidayDateSet = new Set(publicHolidayDates);
  const payableRecords = validRecords.filter((record: any) => !publicHolidayDateSet.has(record.date));
  const publicHolidayMap = new Map(publicHolidays.map((holiday) => [holiday.date, holiday]));
  const earnings = calculateEmployeePeriodEarnings(
    payableRecords,
    salaryAmount,
    payCycle === "WEEKLY" ? "WEEKLY" : "MONTHLY",
    workingDays,
    schedule,
    publicHolidayDates
  );
  const absent   = payableRecords.filter((r: any) => r.status === "ABSENT").length;
  const holiday  = payableRecords.filter((r: any) => r.status === "HOLIDAY").length;
  const legacyRecords = payableRecords.filter((record: any) => !record.entryMode).length;

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

      <p className="text-xs text-muted-foreground">
        Attendance is entered in the team table. <Link href="/dashboard/employees" className="font-medium text-primary underline">Open team attendance</Link>
      </p>
      {publicHolidaysError && (
        <p className="text-xs text-destructive" role="alert">
          Could not load public holidays. This gross estimate may not include paid holidays.
        </p>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Regular hours", value: earnings.regularHours, color: "text-green-600" },
          { label: "OT hours", value: earnings.overtimeHours, color: "text-amber-600" },
          { label: "Absent", value: absent, color: "text-red-600" },
          { label: "Holiday", value: holiday, color: "text-blue-600" },
          { label: "Paid public holidays", value: earnings.paidHolidayDays, color: "text-blue-600" },
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
          <p className="text-xs text-muted-foreground">Base hourly rate: <span className="font-semibold text-foreground">₹{earnings.hourlyRate.toLocaleString("en-IN")}</span></p>
          <p className="text-xs text-muted-foreground">Estimated gross: <span className="font-semibold text-foreground">₹{earnings.grossEarned.toLocaleString("en-IN")}</span></p>
          {legacyRecords > 0 && <p className="text-xs text-muted-foreground">Includes {legacyRecords} legacy day-based records.</p>}
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
          const employed = isEmployedOnDate(employmentPeriods, date);
          const publicHoliday = publicHolidayMap.get(date);
          const workedHours = rec?.entryMode ? calculateWorkedHours(rec, schedule.breakMinutes) : null;
          const regularShiftHours = getRegularShiftHours(schedule);
          return (
            <div
              key={date}
              title={!employed
                ? "Outside employment dates"
                : publicHoliday
                ? `${publicHoliday.name}${new Date(`${date}T00:00:00.000Z`).getUTCDay() === 0 ? " — Sunday (unpaid)" : " — paid public holiday"}`
                : rec?.entryMode
                ? `${workedHours} worked hours`
                : rec
                ? ATTENDANCE_LABEL[rec.status]
                : "No entry"}
              className={`aspect-square rounded-md flex flex-col items-center justify-center text-xs font-medium border
                ${!employed ? "border-border bg-muted/40 text-muted-foreground/50" : publicHoliday ? "border-blue-300 bg-blue-100 text-blue-800" : rec?.entryMode ? (workedHours! > regularShiftHours ? "border-amber-300 bg-amber-100 text-amber-800" : "border-green-300 bg-green-100 text-green-800") : rec ? ATTENDANCE_COLORS[rec.status] + " text-white border-transparent" : "border-border text-muted-foreground"}
                ${isToday && !rec ? "border-primary" : ""}
              `}
            >
              <span>{i + 1}</span>
              {publicHoliday
                ? <span className="text-[8px] leading-none">{new Date(`${date}T00:00:00.000Z`).getUTCDay() === 0 ? "Sun · unpaid" : "Public holiday"}</span>
                : rec?.entryMode && workedHours !== null
                ? <span className="text-[8px] leading-none">{workedHours}h</span>
                : rec && <span className="text-[8px] leading-none opacity-80">{rec.status === "HALF_DAY" ? "½ · old" : rec.status === "HOLIDAY" ? "H" : rec.status === "ABSENT" ? "A" : "old"}</span>}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">Green shows regular hours; amber indicates a day with overtime. Legacy attendance remains unchanged.</p>
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
  const [gross, setGross]             = useState("");
  const [deductions, setDeductions]   = useState("0");
  const [method, setMethod]           = useState("UPI");
  const [notes, setNotes]             = useState("");

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["salary", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/salary`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const grossAmount = Number(gross);
  const deductionAmount = Number(deductions || "0");
  const net = grossAmount - deductionAmount;
  const isPaymentValid =
    Number.isFinite(grossAmount) &&
    grossAmount > 0 &&
    Number.isFinite(deductionAmount) &&
    deductionAmount >= 0 &&
    deductionAmount <= grossAmount &&
    !!periodStart &&
    !!periodEnd &&
    periodEnd >= periodStart;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/salary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart,
          periodEnd,
          grossAmount,
          deductions: deductionAmount,
          netAmount: net,
          method,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(typeof result.error === "string" ? result.error : "Failed to save salary payment");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary", employeeId] });
      setShowForm(false);
      setGross("");
      setPeriodStart("");
      setPeriodEnd("");
      setDeductions("0");
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
                <Input type="number" min={0} value={gross} onChange={(e) => setGross(e.target.value)} className="h-8 text-xs" placeholder={`e.g. ${salaryAmount.toLocaleString()}`} />
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
                disabled={saveMutation.isPending || !isPaymentValid}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "Saving…" : "Record Payment"}
              </Button>
            </div>
            {saveMutation.isError && <p className="text-xs text-destructive" role="alert">{saveMutation.error.message}</p>}
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
      if (!res.ok) {
        const result = await res.json();
        throw new Error(typeof result.error === "string" ? result.error : "Failed to save advance");
      }
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
    mutationFn: async ({ advanceId, recoveredAmount }: {
      advanceId: string;
      recoveredAmount: number;
    }) => {
      const res = await fetch(`/api/employees/${employeeId}/advances`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advanceId, recoveredAmount }),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(typeof result.error === "string" ? result.error : "Failed to update advance");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advances", employeeId] });
    },
  });

  const outstanding = advances
    .filter((a: any) => a.status !== "RECOVERED")
    .reduce((sum: number, a: any) => sum + Math.max(Number(a.amount) - Number(a.recoveredAmount), 0), 0);

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
      {issueMutation.isError && <p className="text-xs text-destructive" role="alert">{issueMutation.error.message}</p>}
      {recoverMutation.isError && <p className="text-xs text-destructive" role="alert">{recoverMutation.error.message}</p>}

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
              onRecover={({ recoveredAmount }) =>
                recoverMutation.mutate({ advanceId: a.id, recoveredAmount })
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
  onRecover: (data: { recoveredAmount: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [recovered, setRecovered] = useState(String(advance.recoveredAmount));

  function save() {
    const r = Math.min(parseFloat(recovered || "0"), Number(advance.amount));
    onRecover({ recoveredAmount: r });
    setEditing(false);
    setOpen(false);
  }

  const balance = Math.max(Number(advance.amount) - Number(advance.recoveredAmount), 0);

  return (
    <Card>
      {/* Accordion header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold">₹{Number(advance.amount).toLocaleString()}</span>
          <Badge className={`text-xs ${statusColors[advance.status]}`}>
            {advance.status.replace(/_/g, " ")}
          </Badge>
          {advance.reason && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              · {advance.reason}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {new Date(advance.issuedAt).toLocaleDateString("en-IN")}
          <span className={`ml-2 transition-transform duration-200 inline-block ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </span>
      </button>

      {/* Accordion body */}
      {open && (
        <CardContent className="pt-0 pb-3 space-y-3 border-t">
          <div className="pt-3 space-y-1 text-sm">
            {advance.reason && (
              <p className="text-xs text-muted-foreground">Reason: {advance.reason}</p>
            )}
            {advance.notes && (
              <p className="text-xs text-muted-foreground">Notes: {advance.notes}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Issued: {new Date(advance.issuedAt).toLocaleDateString("en-IN")}
            </p>
            {Number(advance.recoveredAmount) > 0 && (
              <p className="text-xs text-muted-foreground">
                Recovered: ₹{Number(advance.recoveredAmount).toLocaleString()}
                {" · "}Balance: ₹{balance.toLocaleString()}
              </p>
            )}
          </div>

          {advance.status !== "RECOVERED" && !editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <TrendingDown className="h-3 w-3 mr-1" /> Record Recovery
            </Button>
          )}

          {editing && (
            <div className="flex items-end gap-2 border-t pt-3">
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
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" onClick={save}>Save</Button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
