"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
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
  Plus,
  Search,
  Briefcase,
  Phone,
  Clock,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────────────────────

function toYMD(d: Date) {
  return d.toISOString().split("T")[0];
}

function getWeekDates(anchor: Date): Date[] {
  // Monday-based week
  const day = anchor.getDay(); // 0=Sun
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function weekLabel(dates: Date[]) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${fmt(dates[0])} – ${fmt(dates[6])}`;
}

function monthStart(payCycle: string) {
  const now = new Date();
  if (payCycle === "WEEKLY") {
    const week = getWeekDates(now);
    return toYMD(week[0]);
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthEnd(payCycle: string) {
  const now = new Date();
  if (payCycle === "WEEKLY") {
    const week = getWeekDates(now);
    return toYMD(week[6]);
  }
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return toYMD(last);
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_STYLES: Record<string, string> = {
  PRESENT:  "bg-green-500 text-white border-green-500",
  ABSENT:   "bg-red-500 text-white border-red-500",
  HALF_DAY: "bg-yellow-400 text-white border-yellow-400",
  HOLIDAY:  "bg-blue-400 text-white border-blue-400",
};

const STATUS_CYCLE: Record<string, string> = {
  "":         "PRESENT",
  PRESENT:    "HALF_DAY",
  HALF_DAY:   "ABSENT",
  ABSENT:     "HOLIDAY",
  HOLIDAY:    "",
};

const STATUS_SHORT: Record<string, string> = {
  PRESENT: "P", HALF_DAY: "½", ABSENT: "A", HOLIDAY: "H",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const [tab, setTab] = useState<"staff" | "attendance" | "salary">("staff");

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-xs text-muted-foreground">Staff · Attendance · Payroll</p>
        </div>
        <Link href="/dashboard/employees/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Employee
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["staff", "attendance", "salary"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "staff" ? "Staff" : t === "attendance" ? "Attendance" : "Salary"}
          </button>
        ))}
      </div>

      {tab === "staff"      && <StaffTab />}
      {tab === "attendance" && <AttendanceTab />}
      {tab === "salary"     && <SalaryTab />}
    </div>
  );
}

// ─── Staff Tab ────────────────────────────────────────────────────────────────

function StaffTab() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["employees", search],
    queryFn: async () => {
      const res = await fetch(`/api/employees?search=${encodeURIComponent(search)}&limit=100`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const employees = data?.employees ?? [];

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, phone or role…"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
        />
      </div>

      {!isLoading && (
        <p className="text-xs text-muted-foreground">
          {employees.filter((e: any) => e.active).length} active ·{" "}
          {employees.filter((e: any) => !e.active).length} inactive
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-20 pt-6" />
            </Card>
          ))}
        </div>
      ) : employees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No employees found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {employees.map((emp: any) => (
            <Link key={emp.id} href={`/dashboard/employees/${emp.id}`}>
              <Card
                className={`hover:border-primary/40 transition-colors cursor-pointer ${
                  !emp.active ? "opacity-60" : ""
                }`}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{emp.name}</p>
                        <Badge
                          className={
                            emp.payCycle === "WEEKLY"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }
                        >
                          {emp.payCycle}
                        </Badge>
                        {!emp.active && (
                          <Badge variant="outline" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{emp.jobRole}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="font-semibold text-sm">
                        ₹{Number(emp.salaryAmount).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        per {emp.payCycle === "WEEKLY" ? "week" : "month"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 ml-[52px] flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {emp.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {emp.phone}
                      </span>
                    )}
                    {emp.shiftStart && emp.shiftEnd && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {emp.shiftStart} – {emp.shiftEnd}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceTab() {
  const queryClient = useQueryClient();
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const weekDates = useMemo(() => getWeekDates(weekAnchor), [weekAnchor]);
  const todayYMD = toYMD(new Date());

  // Fetch all active employees
  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: ["employees", ""],
    queryFn: async () => {
      const res = await fetch("/api/employees?limit=100");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const employees: any[] = (empData?.employees ?? []).filter((e: any) => e.active);

  // Fetch attendance for every day in this week for all employees
  // We use per-employee queries for the week range
  const weekStart = toYMD(weekDates[0]);
  const weekEnd   = toYMD(weekDates[6]);

  const { data: attendanceData = [], isLoading: attLoading } = useQuery({
    queryKey: ["attendance-week", weekStart, weekEnd, employees.map((e: any) => e.id).join(",")],
    enabled: employees.length > 0,
    queryFn: async () => {
      // Fetch per employee using month — we fetch both months if week spans two months
      const months = [...new Set<string>(weekDates.map((d: Date) => toYMD(d).slice(0, 7)))];
      const results = await Promise.all(
        employees.flatMap((emp: any) =>
          months.map((m: string) =>
            fetch(`/api/employees/${emp.id}/attendance?month=${m}`).then((r) =>
              r.ok ? r.json() : []
            )
          )
        )
      );
      return results.flat();
    },
  });

  // Build map: `${employeeId}|${date}` → record
  const recMap = useMemo(() => {
    const m: Record<string, any> = {};
    for (const r of attendanceData) {
      m[`${r.employeeId}|${r.date}`] = r;
    }
    return m;
  }, [attendanceData]);

  // Optimistic local overrides while saving
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});

  const saveMutation = useMutation({
    mutationFn: async (records: { employeeId: string; date: string; status: string }[]) => {
      const res = await fetch("/api/employees/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      setOptimistic({});
      queryClient.invalidateQueries({ queryKey: ["attendance-week"] });
    },
  });

  function getStatus(empId: string, date: string): string {
    const key = `${empId}|${date}`;
    if (optimistic[key] !== undefined) return optimistic[key];
    return recMap[key]?.status ?? "";
  }

  function cycleStatus(empId: string, date: string) {
    const current = getStatus(empId, date);
    const next = STATUS_CYCLE[current] ?? "PRESENT";
    const key = `${empId}|${date}`;
    setOptimistic((prev: Record<string, string>) => ({ ...prev, [key]: next }));

    // Debounced save — collect and save after 800ms idle
    const record = { employeeId: empId, date, status: next };
    // We save immediately for simplicity; each tap fires one request
    if (next === "") {
      // "clear" not supported by API — set to ABSENT as closest
      return;
    }
    saveMutation.mutate([record]);
  }

  function prevWeek() {
    const d = new Date(weekAnchor);
    d.setDate(d.getDate() - 7);
    setWeekAnchor(d);
  }
  function nextWeek() {
    const d = new Date(weekAnchor);
    d.setDate(d.getDate() + 7);
    setWeekAnchor(d);
  }

  const isLoading = empLoading || attLoading;

  // Stats for the week
  const weekStats = useMemo(() => {
    let present = 0, absent = 0, halfDay = 0, unmarked = 0;
    for (const emp of employees) {
      for (const d of weekDates) {
        const s = getStatus(emp.id, toYMD(d));
        if (s === "PRESENT") present++;
        else if (s === "ABSENT") absent++;
        else if (s === "HALF_DAY") halfDay++;
        else unmarked++;
      }
    }
    return { present, absent, halfDay, unmarked };
  }, [recMap, optimistic, employees, weekDates]);

  return (
    <div className="space-y-4">
      {/* Week navigator */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={prevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold text-sm">{weekLabel(weekDates)}</span>
        <Button variant="outline" size="sm" onClick={nextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week summary pills */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 font-medium">
          {weekStats.present} Present
        </span>
        <span className="rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5 font-medium">
          {weekStats.halfDay} Half Day
        </span>
        <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 font-medium">
          {weekStats.absent} Absent
        </span>
        <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 font-medium">
          {weekStats.unmarked} Unmarked
        </span>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm animate-pulse">
            Loading…
          </CardContent>
        </Card>
      ) : employees.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No active employees found.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground w-36 min-w-[9rem]">
                    Employee
                  </th>
                  {weekDates.map((d: Date, i: number) => {
                    const ymd = toYMD(d);
                    const isToday = ymd === todayYMD;
                    return (
                      <th
                        key={ymd}
                        className={`px-2 py-2 font-medium text-center min-w-[3.5rem] ${
                          isToday ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        <div>{DAY_LABELS[i]}</div>
                        <div className={`text-xs font-normal ${isToday ? "font-bold" : ""}`}>
                          {d.getDate()}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp: any, idx: number) => (
                  <tr
                    key={emp.id}
                    className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}
                  >
                    {/* Employee name cell */}
                    <td className="px-4 py-2">
                      <Link
                        href={`/dashboard/employees/${emp.id}`}
                        className="font-medium hover:text-primary transition-colors truncate block max-w-[8rem]"
                      >
                        {emp.name}
                      </Link>
                      <p className="text-xs text-muted-foreground truncate max-w-[8rem]">
                        {emp.jobRole}
                      </p>
                    </td>

                    {/* Day cells */}
                    {weekDates.map((d: Date) => {
                      const ymd = toYMD(d);
                      const status = getStatus(emp.id, ymd);
                      const isToday = ymd === todayYMD;
                      return (
                        <td key={ymd} className="px-2 py-2 text-center">
                          <button
                            onClick={() => cycleStatus(emp.id, ymd)}
                            title={
                              status
                                ? `${status} — tap to change`
                                : "Tap to mark attendance"
                            }
                            className={`
                              h-9 w-9 rounded-lg border-2 text-xs font-bold
                              transition-all duration-150 active:scale-90
                              ${status
                                ? STATUS_STYLES[status]
                                : isToday
                                ? "border-primary/60 text-primary/60 hover:bg-primary/5"
                                : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted"
                              }
                            `}
                          >
                            {status ? STATUS_SHORT[status] : "·"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Tap to cycle:</span>
        {[
          { label: "Present", short: "P", cls: "bg-green-500 text-white" },
          { label: "Half Day", short: "½", cls: "bg-yellow-400 text-white" },
          { label: "Absent", short: "A", cls: "bg-red-500 text-white" },
          { label: "Holiday", short: "H", cls: "bg-blue-400 text-white" },
        ].map((s) => (
          <span key={s.label} className="flex items-center gap-1">
            <span className={`h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold ${s.cls}`}>
              {s.short}
            </span>
            {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="h-5 w-5 rounded border-2 border-border flex items-center justify-center text-[10px]">·</span>
          Unmarked
        </span>
      </div>
    </div>
  );
}

// ─── Salary Tab ───────────────────────────────────────────────────────────────

function SalaryTab() {
  const queryClient = useQueryClient();
  const [openPayForm, setOpenPayForm] = useState<string | null>(null); // employeeId
  const [gross, setGross]         = useState("");
  const [deductions, setDeductions] = useState("0");
  const [method, setMethod]       = useState("CASH");
  const [notes, setNotes]         = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd]     = useState("");

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ["salary-summary"],
    queryFn: async () => {
      const res = await fetch("/api/employees/salary/summary");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ employeeId }: { employeeId: string }) => {
      const res = await fetch(`/api/employees/${employeeId}/salary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart,
          periodEnd,
          grossAmount: parseFloat(gross),
          deductions: parseFloat(deductions || "0"),
          netAmount: Math.max(0, parseFloat(gross) - parseFloat(deductions || "0")),
          method,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-summary"] });
      closeForm();
    },
  });

  function openForm(emp: any) {
    setOpenPayForm(emp.id);
    setGross(String(Number(emp.salaryAmount)));
    setDeductions("0");
    setMethod("CASH");
    setNotes("");
    setPeriodStart(monthStart(emp.payCycle));
    setPeriodEnd(monthEnd(emp.payCycle));
  }

  function closeForm() {
    setOpenPayForm(null);
    setGross("");
    setDeductions("0");
    setNotes("");
  }

  const net = Math.max(0, parseFloat(gross || "0") - parseFloat(deductions || "0"));

  const overdueCount = summary.filter((s: any) => s.overdue).length;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      {!isLoading && overdueCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">{overdueCount} employee{overdueCount > 1 ? "s" : ""}</span>{" "}
            overdue for payment
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-16 pt-4" />
            </Card>
          ))}
        </div>
      ) : summary.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No active employees found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {summary.map(({ employee: emp, lastPayment, overdue }: any) => {
            const isOpen = openPayForm === emp.id;
            return (
              <Card
                key={emp.id}
                className={overdue && !isOpen ? "border-red-200" : ""}
              >
                <CardContent className="pt-4 pb-4 space-y-3">
                  {/* Employee row */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <IndianRupee className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/dashboard/employees/${emp.id}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {emp.name}
                        </Link>
                        <Badge
                          className={
                            emp.payCycle === "WEEKLY"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }
                        >
                          {emp.payCycle}
                        </Badge>
                        {overdue ? (
                          <Badge className="bg-red-100 text-red-700">Overdue</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Paid
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {emp.jobRole} · ₹{Number(emp.salaryAmount).toLocaleString()}/{emp.payCycle === "WEEKLY" ? "wk" : "mo"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {lastPayment ? (
                        <p className="text-xs text-muted-foreground mb-1">
                          Last paid{" "}
                          {new Date(lastPayment.paidAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      ) : (
                        <p className="text-xs text-red-500 mb-1">Never paid</p>
                      )}
                      <Button
                        size="sm"
                        variant={overdue ? "default" : "outline"}
                        onClick={() => (isOpen ? closeForm() : openForm(emp))}
                        className={overdue ? "bg-primary" : ""}
                      >
                        {isOpen ? "Cancel" : overdue ? "Pay Now" : "Pay Again"}
                      </Button>
                    </div>
                  </div>

                  {/* Inline pay form */}
                  {isOpen && (
                    <div className="border-t pt-3 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Record Payment
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Period Start</Label>
                          <Input
                            type="date"
                            value={periodStart}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodStart(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Period End</Label>
                          <Input
                            type="date"
                            value={periodEnd}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodEnd(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Gross Amount (₹)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={gross}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGross(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Deductions (₹)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={deductions}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeductions(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      <div className="rounded-md bg-muted px-3 py-2 text-sm">
                        Net payable:{" "}
                        <span className="font-bold">₹{net.toLocaleString()}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Payment Method</Label>
                          <Select value={method} onValueChange={setMethod}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
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
                          <Input
                            value={notes}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
                            className="h-8 text-xs"
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          disabled={
                            saveMutation.isPending || !periodStart || !periodEnd || !gross
                          }
                          onClick={() => saveMutation.mutate({ employeeId: emp.id })}
                        >
                          {saveMutation.isPending ? "Saving…" : "Record Payment"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
