"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  CalendarIcon,
  IndianRupee,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function getWeekDates(anchor: Date): Date[] {
  const day = anchor.getDay();
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getMonthDates(anchor: Date): Date[] {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const count = new Date(y, m + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => new Date(y, m, i + 1));
}

function rangeLabel(dates: Date[], mode: "week" | "month"): string {
  if (mode === "month") {
    return dates[0].toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`;
}

function monthStart(payCycle: string): string {
  const now = new Date();
  if (payCycle === "WEEKLY") {
    return toYMD(getWeekDates(now)[0]);
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthEnd(payCycle: string): string {
  const now = new Date();
  if (payCycle === "WEEKLY") {
    return toYMD(getWeekDates(now)[6]);
  }
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return toYMD(last);
}

const STATUS_STYLES: Record<string, string> = {
  PRESENT:  "bg-green-500 text-white",
  ABSENT:   "bg-red-500 text-white",
  HALF_DAY: "bg-yellow-400 text-white",
  HOLIDAY:  "bg-blue-400 text-white",
};

const STATUS_SHORT: Record<string, string> = {
  PRESENT: "P", HALF_DAY: "½", ABSENT: "A", HOLIDAY: "H",
};

const STATUSES = ["PRESENT", "HALF_DAY", "ABSENT", "HOLIDAY"] as const;
const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Present", HALF_DAY: "Half", ABSENT: "Absent", HOLIDAY: "Holiday",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const [tab, setTab] = useState<"staff" | "attendance" | "salary">("staff");

  return (
    <div className="space-y-4">
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
      if (!res.ok) throw new Error("Failed");
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
              <Card className={`hover:border-primary/40 transition-colors cursor-pointer ${!emp.active ? "opacity-60" : ""}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{emp.name}</p>
                        <Badge className={emp.payCycle === "WEEKLY" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>
                          {emp.payCycle}
                        </Badge>
                        {!emp.active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{emp.jobRole}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="font-semibold text-sm">₹{Number(emp.salaryAmount).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">per {emp.payCycle === "WEEKLY" ? "week" : "month"}</p>
                    </div>
                  </div>
                  <div className="mt-2 ml-[52px] flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {emp.phone && (
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {emp.phone}</span>
                    )}
                    {emp.shiftStart && emp.shiftEnd && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {emp.shiftStart} – {emp.shiftEnd}</span>
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

// ─── Status Picker (inline segmented) ────────────────────────────────────────

function StatusPicker({
  current,
  onSelect,
  onClose,
}: {
  current: string;
  onSelect: (s: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function keyHandler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 mt-1 flex gap-1 rounded-lg border bg-popover p-1.5 shadow-lg"
      style={{ top: "100%", left: "50%", transform: "translateX(-50%)" }}
    >
      {STATUSES.map((s) => (
        <button
          key={s}
          onClick={() => { onSelect(s); onClose(); }}
          className={`
            flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[10px] font-semibold
            transition-colors border-2
            ${current === s
              ? STATUS_STYLES[s] + " border-transparent"
              : "border-border hover:border-primary/40 hover:bg-muted text-foreground"
            }
          `}
        >
          <span className="text-sm font-bold">{STATUS_SHORT[s]}</span>
          <span className="text-[9px] leading-none opacity-80">{STATUS_LABELS[s]}</span>
        </button>
      ))}
      {current && (
        <button
          onClick={() => { onSelect(""); onClose(); }}
          className="flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[10px] font-semibold border-2 border-border hover:border-red-300 hover:bg-red-50 text-muted-foreground"
        >
          <span className="text-sm font-bold">✕</span>
          <span className="text-[9px] leading-none">Clear</span>
        </button>
      )}
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceTab() {
  const queryClient = useQueryClient();
  const todayYMD = toYMD(new Date());

  // Mode: week or month
  const [mode, setMode] = useState<"week" | "month">("week");
  // Single anchor date drives both week and month
  const [anchor, setAnchor] = useState(new Date());
  const [calOpen, setCalOpen] = useState(false);

  const displayDates = useMemo(
    () => mode === "week" ? getWeekDates(anchor) : getMonthDates(anchor),
    [mode, anchor]
  );

  // Active cell picker: `${empId}|${date}` or null
  const [activePicker, setActivePicker] = useState<string | null>(null);

  // Employees
  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: ["employees", ""],
    queryFn: async () => {
      const res = await fetch("/api/employees?limit=100");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const employees: any[] = (empData?.employees ?? []).filter((e: any) => e.active);

  // Attendance fetch — months covered by displayDates
  const months = useMemo(
    () => [...new Set<string>(displayDates.map((d) => toYMD(d).slice(0, 7)))],
    [displayDates]
  );

  const { data: attendanceData = [], isLoading: attLoading } = useQuery({
    queryKey: ["attendance-range", months.join(","), employees.map((e: any) => e.id).join(",")],
    enabled: employees.length > 0,
    queryFn: async () => {
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

  const recMap = useMemo(() => {
    const m: Record<string, any> = {};
    for (const r of attendanceData) m[`${r.employeeId}|${r.date}`] = r;
    return m;
  }, [attendanceData]);

  const [optimistic, setOptimistic] = useState<Record<string, string>>({});

  const saveMutation = useMutation({
    mutationFn: async (records: { employeeId: string; date: string; status: string }[]) => {
      // Filter out "clear" (empty status) — no API call needed for clear
      const toSave = records.filter((r) => r.status !== "");
      if (toSave.length === 0) return;
      const res = await fetch("/api/employees/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: toSave }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      setOptimistic({});
      queryClient.invalidateQueries({ queryKey: ["attendance-range"] });
    },
  });

  function getStatus(empId: string, date: string): string {
    const key = `${empId}|${date}`;
    if (optimistic[key] !== undefined) return optimistic[key];
    return recMap[key]?.status ?? "";
  }

  function handleSelect(empId: string, date: string, status: string) {
    const key = `${empId}|${date}`;
    setOptimistic((prev) => ({ ...prev, [key]: status }));
    saveMutation.mutate([{ employeeId: empId, date, status }]);
  }

  // Week stats
  const stats = useMemo(() => {
    let present = 0, absent = 0, halfDay = 0, unmarked = 0;
    for (const emp of employees) {
      for (const d of displayDates) {
        const s = getStatus(emp.id, toYMD(d));
        if (s === "PRESENT") present++;
        else if (s === "ABSENT") absent++;
        else if (s === "HALF_DAY") halfDay++;
        else unmarked++;
      }
    }
    return { present, absent, halfDay, unmarked };
  }, [recMap, optimistic, employees, displayDates]);

  const isLoading = empLoading || attLoading;

  // Column header width — narrower in month mode
  const colW = mode === "month" ? "min-w-[2.5rem]" : "min-w-[3.5rem]";

  return (
    <div className="space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Calendar popover */}
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-sm font-medium">
              <CalendarIcon className="h-4 w-4" />
              {rangeLabel(displayDates, mode)}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <div className="p-3 border-b space-y-2">
              {/* Quick shortcuts */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => {
                    setMode("week");
                    setAnchor(new Date());
                    setCalOpen(false);
                  }}
                >
                  This Week
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => {
                    setMode("month");
                    setAnchor(new Date());
                    setCalOpen(false);
                  }}
                >
                  This Month
                </Button>
              </div>
              {/* Mode toggle */}
              <div className="flex gap-1 rounded-md border p-0.5 bg-muted">
                {(["week", "month"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 rounded py-1 text-xs font-medium transition-colors capitalize ${
                      mode === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {/* Calendar — week mode: click any day to jump to that week */}
            {mode === "week" ? (
              <Calendar
                mode="single"
                selected={anchor}
                onSelect={(d) => {
                  if (d) { setAnchor(d); setCalOpen(false); }
                }}
                fromYear={2020}
                toYear={new Date().getFullYear() + 1}
                modifiers={{
                  weekSelected: (day: Date) => {
                    const week = getWeekDates(anchor);
                    return day >= week[0] && day <= week[6];
                  },
                }}
                modifiersClassNames={{
                  weekSelected: "bg-primary/10 text-primary rounded-none",
                }}
              />
            ) : (
              <Calendar
                mode="single"
                selected={new Date(anchor.getFullYear(), anchor.getMonth(), 1)}
                onSelect={(d) => {
                  if (d) { setAnchor(d); setCalOpen(false); }
                }}
                fromYear={2020}
                toYear={new Date().getFullYear() + 1}
              />
            )}
          </PopoverContent>
        </Popover>

        {/* Inline mode pills */}
        <div className="flex gap-1 rounded-md border p-0.5 bg-muted">
          {(["week", "month"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors capitalize ${
                mode === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary pills ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 font-medium">{stats.present} Present</span>
        <span className="rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5 font-medium">{stats.halfDay} Half Day</span>
        <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 font-medium">{stats.absent} Absent</span>
        <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 font-medium">{stats.unmarked} Unmarked</span>
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm animate-pulse">Loading…</CardContent></Card>
      ) : employees.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">No active employees found.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-32 min-w-[8rem] sticky left-0 bg-muted/40 z-10">
                    Employee
                  </th>
                  {displayDates.map((d) => {
                    const ymd = toYMD(d);
                    const isToday = ymd === todayYMD;
                    const dayName = d.toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 2);
                    return (
                      <th
                        key={ymd}
                        className={`px-1 py-2 text-center font-medium ${colW} ${
                          isToday ? "text-primary bg-primary/5" : "text-muted-foreground"
                        }`}
                      >
                        {mode === "week" ? (
                          <>
                            <div className="text-[10px]">{dayName}</div>
                            <div className={`text-xs ${isToday ? "font-bold" : "font-normal"}`}>{d.getDate()}</div>
                          </>
                        ) : (
                          <div className={`text-xs ${isToday ? "font-bold" : "font-normal"}`}>{d.getDate()}</div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp: any, idx: number) => (
                  <tr key={emp.id} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="px-3 py-2 sticky left-0 bg-inherit z-10 border-r">
                      <Link href={`/dashboard/employees/${emp.id}`} className="font-medium hover:text-primary transition-colors truncate block max-w-[7rem]">
                        {emp.name}
                      </Link>
                      {mode === "week" && (
                        <p className="text-[10px] text-muted-foreground truncate max-w-[7rem]">{emp.jobRole}</p>
                      )}
                    </td>
                    {displayDates.map((d) => {
                      const ymd = toYMD(d);
                      const status = getStatus(emp.id, ymd);
                      const pickerKey = `${emp.id}|${ymd}`;
                      const isOpen = activePicker === pickerKey;
                      const isToday = ymd === todayYMD;
                      return (
                        <td key={ymd} className={`px-1 py-1.5 text-center relative ${isToday ? "bg-primary/5" : ""}`}>
                          <button
                            onClick={() => setActivePicker(isOpen ? null : pickerKey)}
                            title="Click to set attendance"
                            className={`
                              h-8 w-8 rounded-md border text-xs font-bold mx-auto block
                              transition-all duration-100
                              ${status
                                ? STATUS_STYLES[status] + " border-transparent"
                                : isToday
                                  ? "border-primary/50 text-primary/50 hover:bg-primary/5"
                                  : "border-border text-muted-foreground/40 hover:border-primary/40 hover:bg-muted"
                              }
                            `}
                          >
                            {status ? STATUS_SHORT[status] : "·"}
                          </button>
                          {isOpen && (
                            <StatusPicker
                              current={status}
                              onSelect={(s) => handleSelect(emp.id, ymd, s)}
                              onClose={() => setActivePicker(null)}
                            />
                          )}
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

      {/* ── Legend ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground items-center">
        <span className="font-medium text-foreground">Click cell to mark:</span>
        {STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className={`h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold ${STATUS_STYLES[s]}`}>
              {STATUS_SHORT[s]}
            </span>
            {STATUS_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Salary Tab ───────────────────────────────────────────────────────────────

function SalaryTab() {
  const queryClient = useQueryClient();
  const [openPayForm, setOpenPayForm] = useState<string | null>(null);
  const [gross, setGross]             = useState("");
  const [deductions, setDeductions]   = useState("0");
  const [method, setMethod]           = useState("CASH");
  const [notes, setNotes]             = useState("");
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
            <Card key={i} className="animate-pulse"><CardContent className="h-16 pt-4" /></Card>
          ))}
        </div>
      ) : summary.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No active employees found.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {summary.map(({ employee: emp, lastPayment, overdue }: any) => {
            const isOpen = openPayForm === emp.id;
            return (
              <Card key={emp.id} className={overdue && !isOpen ? "border-red-200" : ""}>
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <IndianRupee className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/dashboard/employees/${emp.id}`} className="font-medium hover:text-primary transition-colors">
                          {emp.name}
                        </Link>
                        <Badge className={emp.payCycle === "WEEKLY" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>
                          {emp.payCycle}
                        </Badge>
                        {overdue ? (
                          <Badge className="bg-red-100 text-red-700">Overdue</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Paid
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
                          Last paid {new Date(lastPayment.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </p>
                      ) : (
                        <p className="text-xs text-red-500 mb-1">Never paid</p>
                      )}
                      <Button
                        size="sm"
                        variant={overdue ? "default" : "outline"}
                        onClick={() => isOpen ? closeForm() : openForm(emp)}
                      >
                        {isOpen ? "Cancel" : overdue ? "Pay Now" : "Pay Again"}
                      </Button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t pt-3 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Record Payment</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Period Start</Label>
                          <Input type="date" value={periodStart} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodStart(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Period End</Label>
                          <Input type="date" value={periodEnd} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodEnd(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Gross Amount (₹)</Label>
                          <Input type="number" min={0} value={gross} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGross(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Deductions (₹)</Label>
                          <Input type="number" min={0} value={deductions} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeductions(e.target.value)} className="h-8 text-xs" />
                        </div>
                      </div>
                      <div className="rounded-md bg-muted px-3 py-2 text-sm">
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
                          <Input value={notes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)} className="h-8 text-xs" placeholder="Optional" />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          disabled={saveMutation.isPending || !periodStart || !periodEnd || !gross}
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
