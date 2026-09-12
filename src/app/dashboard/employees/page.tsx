"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Plus,
  Search,
  Briefcase,
  Phone,
  Clock,
  CalendarIcon,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  ShieldAlert,
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

// ─── Status config ────────────────────────────────────────────────────────────

// Primary 3 shown always in cell; Holiday accessible via the cell label
const PRIMARY_STATUSES = [
  { key: "PRESENT",  label: "P",  title: "Present",  active: "bg-green-500 text-white border-green-500",  inactive: "border-green-300 text-green-600 hover:bg-green-50" },
  { key: "ABSENT",   label: "A",  title: "Absent",   active: "bg-red-500 text-white border-red-500",      inactive: "border-red-300 text-red-500 hover:bg-red-50" },
  { key: "HALF_DAY", label: "½",  title: "Half Day", active: "bg-yellow-400 text-white border-yellow-400",inactive: "border-yellow-300 text-yellow-600 hover:bg-yellow-50" },
  { key: "HOLIDAY",  label: "H",  title: "Holiday",  active: "bg-blue-400 text-white border-blue-400",    inactive: "border-blue-300 text-blue-500 hover:bg-blue-50" },
] as const;

type StatusKey = typeof PRIMARY_STATUSES[number]["key"] | "";

// Summary pill colors
const PILL_COLORS: Record<string, string> = {
  PRESENT:  "bg-green-100 text-green-700",
  ABSENT:   "bg-red-100 text-red-700",
  HALF_DAY: "bg-yellow-100 text-yellow-700",
  HOLIDAY:  "bg-blue-100 text-blue-700",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"staff" | "attendance" | "salary" | "advances">("staff");

  // Check authorization
  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ["auth"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
  });

  // Redirect store managers
  useEffect(() => {
    if (!authLoading && authData?.role === "STORE_MANAGER") {
      router.replace("/dashboard");
    }
  }, [authData, authLoading, router]);

  // Show access denied for store managers
  if (authLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (authData?.role === "STORE_MANAGER") {
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
                You don't have permission to access this page.
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-xs text-muted-foreground">Staff · Attendance · Payroll · Advances</p>
        </div>
        <Link href="/dashboard/employees/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Employee
          </Button>
        </Link>
      </div>

      <div className="flex gap-1 border-b">
        {(["staff", "attendance", "salary", "advances"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "staff" ? "Staff" : t === "attendance" ? "Attendance" : t === "salary" ? "Salary" : "Advances"}
          </button>
        ))}
      </div>

      {tab === "staff"      && <StaffTab />}
      {tab === "attendance" && <AttendanceTab />}
      {tab === "salary"     && <SalaryTab />}
      {tab === "advances"   && <AdvancesTab />}
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
            <Card key={i} className="animate-pulse"><CardContent className="h-20 pt-6" /></Card>
          ))}
        </div>
      ) : employees.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No employees found.</CardContent></Card>
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
                    {emp.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{emp.phone}</span>}
                    {emp.shiftStart && emp.shiftEnd && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{emp.shiftStart} – {emp.shiftEnd}</span>}
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

// ─── Inline status pill group — always visible in each cell ──────────────────

function StatusPills({
  status,
  onSelect,
  compact,
}: {
  status: StatusKey;
  onSelect: (s: StatusKey) => void;
  compact?: boolean; // month mode — show only active + minimal inactive dots
}) {
  if (compact) {
    // Month view: single compact chip showing current status, click to cycle
    // Full picker on long-press handled via right-click context
    const active = PRIMARY_STATUSES.find((s) => s.key === status);
    return (
      <div className="flex gap-0.5 justify-center">
        {PRIMARY_STATUSES.map((s) => (
          <button
            key={s.key}
            title={s.title}
            onClick={() => onSelect(status === s.key ? "" : s.key as StatusKey)}
            className={`
              h-5 w-5 rounded text-[9px] font-bold border transition-all duration-100
              ${status === s.key
                ? s.active
                : "border-border/50 text-muted-foreground/30 hover:border-current hover:" + s.inactive
              }
            `}
          >
            {s.label}
          </button>
        ))}
      </div>
    );
  }

  // Week view: always show all 4 pills side by side
  return (
    <div className="flex gap-1 justify-center">
      {PRIMARY_STATUSES.map((s) => (
        <button
          key={s.key}
          title={s.title}
          onClick={() => onSelect(status === s.key ? "" : s.key as StatusKey)}
          className={`
            h-7 px-1.5 rounded border text-[10px] font-bold transition-all duration-100 min-w-[1.5rem]
            ${status === s.key
              ? s.active + " shadow-sm scale-105"
              : s.inactive
            }
          `}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceTab() {
  const queryClient = useQueryClient();
  const todayYMD = toYMD(new Date());

  const [mode, setMode]     = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(new Date());
  const [calOpen, setCalOpen] = useState(false);

  const displayDates = useMemo(
    () => mode === "week" ? getWeekDates(anchor) : getMonthDates(anchor),
    [mode, anchor]
  );

  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: ["employees", ""],
    queryFn: async () => {
      const res = await fetch("/api/employees?limit=100");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const employees: any[] = (empData?.employees ?? []).filter((e: any) => e.active);

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
      const toSave = records.filter((r) => r.status !== "");
      if (toSave.length === 0) return;
      const res = await fetch("/api/employees/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: toSave }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      setOptimistic({});
      queryClient.invalidateQueries({ queryKey: ["attendance-range"] });
    },
  });

  function getStatus(empId: string, date: string): StatusKey {
    const key = `${empId}|${date}`;
    if (optimistic[key] !== undefined) return optimistic[key] as StatusKey;
    const existing = recMap[key]?.status;
    
    // Auto-mark Sundays as holiday if no status exists
    if (!existing) {
      const dateObj = new Date(date + "T00:00:00");
      if (dateObj.getDay() === 0) { // Sunday = 0
        return "HOLIDAY";
      }
    }
    
    return (existing ?? "") as StatusKey;
  }

  function handleSelect(empId: string, date: string, status: StatusKey) {
    const key = `${empId}|${date}`;
    setOptimistic((prev) => ({ ...prev, [key]: status }));
    if (status) saveMutation.mutate([{ employeeId: empId, date, status }]);
  }

  // Auto-save Sundays as holidays when they're displayed
  React.useEffect(() => {
    if (employees.length === 0 || isLoading) return;
    
    const sundaysToMark: { employeeId: string; date: string; status: string }[] = [];
    const sundays = displayDates.filter((d) => d.getDay() === 0);
    
    for (const emp of employees) {
      for (const sunday of sundays) {
        const ymd = toYMD(sunday);
        const key = `${emp.id}|${ymd}`;
        const existing = recMap[key];
        
        // Only auto-mark if no record exists yet
        if (!existing && !optimistic[key]) {
          sundaysToMark.push({ employeeId: emp.id, date: ymd, status: "HOLIDAY" });
        }
      }
    }
    
    if (sundaysToMark.length > 0) {
      // Mark optimistically first
      const newOptimistic: Record<string, string> = {};
      sundaysToMark.forEach(r => {
        newOptimistic[`${r.employeeId}|${r.date}`] = "HOLIDAY";
      });
      setOptimistic((prev) => ({ ...prev, ...newOptimistic }));
      
      // Then save to database
      saveMutation.mutate(sundaysToMark);
    }
  }, [displayDates, employees, recMap]);

  const isLoading = empLoading || attLoading;

  const stats = useMemo(() => {
    const counts: Record<string, number> = { PRESENT: 0, ABSENT: 0, HALF_DAY: 0, HOLIDAY: 0, "": 0 };
    for (const emp of employees) {
      for (const d of displayDates) {
        const s = getStatus(emp.id, toYMD(d));
        counts[s] = (counts[s] ?? 0) + 1;
      }
    }
    return counts;
  }, [recMap, optimistic, employees, displayDates]);

  return (
    <div className="space-y-4">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 font-medium">
              <CalendarIcon className="h-4 w-4" />
              {rangeLabel(displayDates, mode)}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <div className="p-3 border-b space-y-2">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 text-xs"
                  onClick={() => { setMode("week"); setAnchor(new Date()); setCalOpen(false); }}>
                  This Week
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs"
                  onClick={() => { setMode("month"); setAnchor(new Date()); setCalOpen(false); }}>
                  This Month
                </Button>
              </div>
              <div className="flex gap-1 rounded-md border p-0.5 bg-muted">
                {(["week", "month"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 rounded py-1 text-xs font-medium transition-colors capitalize ${
                      mode === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                    }`}
                  >{m}</button>
                ))}
              </div>
            </div>
            {mode === "week" ? (
              <Calendar
                mode="single"
                selected={anchor}
                onSelect={(d) => { if (d) { setAnchor(d); setCalOpen(false); } }}
                fromYear={2020}
                toYear={new Date().getFullYear() + 1}
                modifiers={{ weekSelected: (day: Date) => { const w = getWeekDates(anchor); return day >= w[0] && day <= w[6]; } }}
                modifiersClassNames={{ weekSelected: "bg-primary/10 text-primary rounded-none" }}
              />
            ) : (
              <Calendar
                mode="single"
                selected={new Date(anchor.getFullYear(), anchor.getMonth(), 1)}
                onSelect={(d) => { if (d) { setAnchor(d); setCalOpen(false); } }}
                fromYear={2020}
                toYear={new Date().getFullYear() + 1}
              />
            )}
          </PopoverContent>
        </Popover>

        <div className="flex gap-1 rounded-md border p-0.5 bg-muted">
          {(["week", "month"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors capitalize ${
                mode === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >{m}</button>
          ))}
        </div>
      </div>

      {/* ── Summary pills ── */}
      <div className="flex flex-wrap gap-2 text-xs">
        {PRIMARY_STATUSES.map((s) => (
          <span key={s.key} className={`rounded-full px-2 py-0.5 font-medium ${PILL_COLORS[s.key]}`}>
            {stats[s.key] ?? 0} {s.title}
          </span>
        ))}
        {(stats[""] ?? 0) > 0 && (
          <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 font-medium">
            {stats[""]} Unmarked
          </span>
        )}
      </div>

      {/* ── Grid ── */}
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
                  {/* Sticky name column */}
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground sticky left-0 bg-muted/40 z-10 border-r"
                    style={{ minWidth: mode === "week" ? "9rem" : "7rem" }}>
                    Employee
                  </th>
                  {displayDates.map((d) => {
                    const ymd = toYMD(d);
                    const isToday = ymd === todayYMD;
                    const isSunday = d.getDay() === 0;
                    return (
                      <th key={ymd}
                        className={`py-2 text-center font-medium ${
                          isToday ? "text-primary bg-primary/5" : 
                          isSunday ? "text-blue-600 bg-blue-50/50" : 
                          "text-muted-foreground"
                        }`}
                        style={{ minWidth: mode === "week" ? "7rem" : "2.2rem", padding: mode === "week" ? "0.5rem 0.25rem" : "0.5rem 0.1rem" }}
                      >
                        {mode === "week" ? (
                          <>
                            <div className="text-[10px]">{d.toLocaleDateString("en-IN", { weekday: "short" })}</div>
                            <div className={`text-xs ${isToday ? "font-bold" : "font-normal"}`}>{d.getDate()}</div>
                          </>
                        ) : (
                          <>
                            <div className="text-[10px]">{d.toLocaleDateString("en-IN", { weekday: "short" })}</div>
                            <div className={`text-[10px] ${isToday ? "font-bold" : "font-normal"}`}>{d.getDate()}</div>
                          </>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp: any, idx: number) => (
                  <tr key={emp.id} className={`border-b last:border-b-0 ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                    <td className="px-3 py-2 sticky left-0 bg-inherit z-10 border-r"
                      style={{ minWidth: mode === "week" ? "9rem" : "7rem" }}>
                      <Link href={`/dashboard/employees/${emp.id}`}
                        className="font-medium hover:text-primary transition-colors block truncate"
                        style={{ maxWidth: mode === "week" ? "8rem" : "6.5rem" }}>
                        {emp.name}
                      </Link>
                      {mode === "week" && (
                        <p className="text-[10px] text-muted-foreground truncate max-w-[8rem]">{emp.jobRole}</p>
                      )}
                    </td>
                    {displayDates.map((d) => {
                      const ymd = toYMD(d);
                      const status = getStatus(emp.id, ymd);
                      const isToday = ymd === todayYMD;
                      const isSunday = d.getDay() === 0;
                      return (
                        <td key={ymd}
                          className={`text-center ${
                            isToday ? "bg-primary/5" : 
                            isSunday ? "bg-blue-50/30" : 
                            ""
                          }`}
                          style={{ padding: mode === "week" ? "0.375rem 0.25rem" : "0.25rem 0.1rem" }}
                        >
                          <StatusPills
                            status={status}
                            onSelect={(s) => handleSelect(emp.id, ymd, s)}
                            compact={mode === "month"}
                          />
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

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground items-center">
        <span className="font-medium text-foreground">
          {mode === "week" ? "Tap P·A·½·H to mark:" : "Tap dots to mark:"}
        </span>
        {PRIMARY_STATUSES.map((s) => (
          <span key={s.key} className="flex items-center gap-1">
            <span className={`h-4 w-5 rounded text-[9px] font-bold flex items-center justify-center border ${s.active}`}>
              {s.label}
            </span>
            {s.title}
          </span>
        ))}
        <span className="text-muted-foreground italic">tap again to clear</span>
      </div>
    </div>
  );
}

// ─── Salary Tab ───────────────────────────────────────────────────────────────

// Get current week's Monday as YYYY-MM-DD
function currentWeekMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return toYMD(monday);
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function prevPeriod(period: string, isWeek: boolean): string {
  if (isWeek) {
    const d = new Date(period + "T00:00:00");
    d.setDate(d.getDate() - 7);
    return toYMD(d);
  }
  const [y, m] = period.split("-").map(Number);
  const prev = new Date(y, m - 2, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

function nextPeriod(period: string, isWeek: boolean): string {
  if (isWeek) {
    const d = new Date(period + "T00:00:00");
    d.setDate(d.getDate() + 7);
    return toYMD(d);
  }
  const [y, m] = period.split("-").map(Number);
  const next = new Date(y, m, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function periodLabel(period: string, isWeek: boolean): string {
  if (isWeek) {
    const start = new Date(period + "T00:00:00");
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return `${fmt(start)} – ${fmt(end)}`;
  }
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function SalaryTab() {
  const queryClient = useQueryClient();

  // Unified period mode — monthly uses YYYY-MM, weekly uses YYYY-MM-DD (monday)
  const [viewMode, setViewMode] = useState<"monthly" | "weekly">("weekly");
  const [monthPeriod, setMonthPeriod] = useState(currentYearMonth());
  const [weekPeriod, setWeekPeriod]   = useState(currentWeekMonday());

  const period  = viewMode === "monthly" ? monthPeriod : weekPeriod;
  const isWeek  = viewMode === "weekly";

  // Per-card payment method state
  const [methods, setMethods] = useState<Record<string, string>>({});
  const [notes, setNotes]     = useState<Record<string, string>>({});
  const [showBreakdown, setShowBreakdown] = useState<Record<string, boolean>>({});
  
  // Payment confirmation dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<any>(null);

  function getMethod(id: string) { return methods[id] ?? "CASH"; }
  function getNote(id: string)   { return notes[id] ?? ""; }

  const { data: payrollData, isLoading } = useQuery({
    queryKey: ["payroll", period],
    queryFn: async () => {
      const res = await fetch(`/api/employees/salary/payroll?period=${period}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  // All employees shown in both views — per-day rate handles the difference:
  // Weekly: weeklyAmount ÷ 6 per day | Monthly: monthlyAmount ÷ workingDays per day
  const payroll: any[] = payrollData?.payroll ?? [];

  // Fetch employee advances for those with outstanding
  const { data: allAdvancesData } = useQuery({
    queryKey: ["all-advances-for-salary", period],
    enabled: payroll.length > 0,
    queryFn: async () => {
      const employeesWithAdvances = payroll.filter((p: any) => p.calculation.outstandingAdvances > 0);
      if (employeesWithAdvances.length === 0) return {};
      
      const results = await Promise.all(
        employeesWithAdvances.map(async (p: any) => {
          const res = await fetch(`/api/employees/${p.employee.id}/advances`);
          if (!res.ok) return { employeeId: p.employee.id, advances: [] };
          const advances = await res.json();
          return {
            employeeId: p.employee.id,
            advances: advances
              .filter((a: any) => a.status !== "RECOVERED")
              .sort((a: any, b: any) => new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime()), // FIFO
          };
        })
      );
      
      const map: Record<string, any[]> = {};
      results.forEach((r) => {
        map[r.employeeId] = r.advances;
      });
      return map;
    },
  });

  const allAdvances = allAdvancesData ?? {};

  const saveMutation = useMutation({
    mutationFn: async ({
      employeeId,
      periodStart,
      periodEnd,
      grossAmount,
      netAmount,
      method,
      note,
      advanceDeduction,
      advancesToRecover,
    }: {
      employeeId: string;
      periodStart: string;
      periodEnd: string;
      grossAmount: number;
      netAmount: number;
      method: string;
      note: string;
      advanceDeduction: number;
      advancesToRecover: { advanceId: string; amount: number }[];
    }) => {
      const res = await fetch(`/api/employees/${employeeId}/salary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart,
          periodEnd,
          grossAmount,
          deductions: 0,
          netAmount,
          method,
          notes: note || undefined,
          advanceDeduction,
          advancesToRecover: advancesToRecover.length > 0 ? advancesToRecover : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll", period] });
      queryClient.invalidateQueries({ queryKey: ["all-advances-for-salary"] });
      queryClient.invalidateQueries({ queryKey: ["all-advances"] });
      setPaymentDialogOpen(false);
      setSelectedPayroll(null);
    },
  });

  const unpaidCount = payroll.filter((p: any) => !p.paidThisPeriod).length;

  return (
    <div className="space-y-4">

      {/* ── Period selector ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Mode toggle */}
        <div className="flex gap-1 rounded-md border p-0.5 bg-muted">
          {(["weekly","monthly"] as const).map((m) => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors capitalize ${
                viewMode === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >{m}</button>
          ))}
        </div>

        {/* Period navigator */}
        <div className="flex items-center gap-1 rounded-md border px-1 py-0.5">
          <button
            onClick={() => isWeek ? setWeekPeriod(prevPeriod(period, true)) : setMonthPeriod(prevPeriod(period, false))}
            className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground"
          >‹</button>
          <span className="text-sm font-medium px-2 min-w-[10rem] text-center">
            {periodLabel(period, isWeek)}
          </span>
          <button
            onClick={() => isWeek ? setWeekPeriod(nextPeriod(period, true)) : setMonthPeriod(nextPeriod(period, false))}
            className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground"
          >›</button>
        </div>

        {/* Jump to current */}
        <button
          onClick={() => { setMonthPeriod(currentYearMonth()); setWeekPeriod(currentWeekMonday()); }}
          className="text-xs text-primary hover:underline"
        >
          Today
        </button>
      </div>

      {/* ── Summary banner ── */}
      {!isLoading && unpaidCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span><span className="font-semibold">{unpaidCount} employee{unpaidCount > 1 ? "s" : ""}</span> unpaid for this period</span>
        </div>
      )}

      {/* ── Payroll cards ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-20 pt-4" /></Card>
          ))}
        </div>
      ) : payroll.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No active employees found.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {payroll.map((row: any) => {
            const { employee: emp, attendance, calculation, paidThisPeriod, period: pd } = row;
            const isPaid = !!paidThisPeriod;
            const hasUnmarked = attendance.unmarkedWorkingDays > 0;
            const isBreakdownOpen = showBreakdown[emp.id];

            return (
              <Card key={emp.id} className={isPaid ? "opacity-70" : hasUnmarked ? "border-amber-200" : ""}>
                <CardContent className="pt-3 pb-3 space-y-2">

                  {/* ── Top row: name + badges + net pay ── */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/dashboard/employees/${emp.id}`}
                          className="font-semibold hover:text-primary transition-colors">
                          {emp.name}
                        </Link>
                        <Badge className={emp.payCycle === "WEEKLY" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>
                          {emp.payCycle}
                        </Badge>
                        {isPaid && (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Paid
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{emp.jobRole}</p>
                    </div>

                    {/* Net pay — prominent */}
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold leading-none">
                        ₹{calculation.netPayable.toLocaleString("en-IN")}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">net payable</p>
                    </div>
                  </div>

                  {/* ── Attendance summary row ── */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="text-green-600 font-medium">{attendance.present}P</span>
                    {attendance.halfDay > 0 && <span className="text-yellow-600 font-medium">{attendance.halfDay}½</span>}
                    {attendance.absent > 0  && <span className="text-red-500 font-medium">{attendance.absent}A</span>}
                    <span className="text-muted-foreground">/ {pd.workingDays} days</span>
                    {hasUnmarked && !isPaid && (
                      <span className="text-amber-600 font-medium">⚠ {attendance.unmarkedWorkingDays} unmarked</span>
                    )}
                    {calculation.outstandingAdvances > 0 && (
                      <span className="text-orange-600 font-medium">
                        advance −₹{calculation.outstandingAdvances.toLocaleString("en-IN")}
                        {calculation.totalAdvances > calculation.outstandingAdvances && (
                          <span className="text-green-600 ml-1">
                            (₹{(calculation.totalAdvances - calculation.outstandingAdvances).toLocaleString("en-IN")} recovered)
                          </span>
                        )}
                      </span>
                    )}
                    {/* Breakdown toggle */}
                    <button
                      onClick={() => setShowBreakdown((prev: Record<string, boolean>) => ({ ...prev, [emp.id]: !isBreakdownOpen }))}
                      className="text-primary/70 hover:text-primary text-[10px] underline"
                    >
                      {isBreakdownOpen ? "hide" : "how?"}
                    </button>
                  </div>

                  {/* ── Breakdown (collapsible) ── */}
                  {isBreakdownOpen && (
                    <div className="rounded-md bg-muted/50 px-3 py-2 text-xs space-y-0.5 text-muted-foreground">
                      <p>₹{Number(emp.salaryAmount).toLocaleString()} ÷ {pd.workingDays} days = <span className="font-medium text-foreground">₹{calculation.perDay}/day</span></p>
                      <p>{attendance.effectiveDays} effective days × ₹{calculation.perDay} = <span className="font-medium text-foreground">₹{calculation.grossEarned.toLocaleString()}</span></p>
                      {calculation.outstandingAdvances > 0 && (
                        <p>− ₹{calculation.outstandingAdvances.toLocaleString()} advance = <span className="font-semibold text-foreground">₹{calculation.netPayable.toLocaleString()}</span></p>
                      )}
                    </div>
                  )}

                  {/* ── Payment row (only if not paid) ── */}
                  {!isPaid && (
                    <div className="flex items-center gap-2 pt-1 border-t">
                      <Select
                        value={getMethod(emp.id)}
                        onValueChange={(v: string) => setMethods((prev: Record<string, string>) => ({ ...prev, [emp.id]: v }))}
                      >
                        <SelectTrigger className="h-7 text-xs w-24 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">Cash</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                          <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                          <SelectItem value="CARD">Card</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Note (optional)"
                        value={getNote(emp.id)}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setNotes((prev: Record<string, string>) => ({ ...prev, [emp.id]: e.target.value }))
                        }
                        className="h-7 text-xs flex-1"
                      />
                      <Button
                        size="sm"
                        className="h-7 shrink-0"
                        disabled={saveMutation.isPending || calculation.netPayable <= 0}
                        onClick={() => {
                          // If employee has outstanding advances, show confirmation dialog
                          if (calculation.outstandingAdvances > 0) {
                            setSelectedPayroll(row);
                            setPaymentDialogOpen(true);
                          } else {
                            // Direct payment without advances
                            saveMutation.mutate({
                              employeeId: emp.id,
                              periodStart: pd.start,
                              periodEnd: pd.end,
                              grossAmount: calculation.grossEarned,
                              netAmount: calculation.netPayable,
                              method: getMethod(emp.id),
                              note: getNote(emp.id),
                              advanceDeduction: 0,
                              advancesToRecover: [],
                            });
                          }
                        }}
                      >
                        ✓ Pay ₹{calculation.netPayable.toLocaleString("en-IN")}
                      </Button>
                    </div>
                  )}

                  {/* ── Already paid stamp ── */}
                  {isPaid && (
                    <p className="text-xs text-green-600">
                      Paid ₹{Number(paidThisPeriod.netAmount).toLocaleString("en-IN")} on{" "}
                      {new Date(paidThisPeriod.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      {" "}· {paidThisPeriod.method}
                    </p>
                  )}

                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Payment Confirmation Dialog */}
      {selectedPayroll && (
        <PaymentConfirmDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          employee={selectedPayroll.employee}
          periodStart={selectedPayroll.period.start}
          periodEnd={selectedPayroll.period.end}
          grossAmount={selectedPayroll.calculation.grossEarned}
          outstandingAdvances={selectedPayroll.calculation.outstandingAdvances}
          advances={allAdvances[selectedPayroll.employee.id] ?? []}
          paymentMethod={getMethod(selectedPayroll.employee.id)}
          paymentNote={getNote(selectedPayroll.employee.id)}
          onConfirm={(deductionAmount, advancesToRecover) => {
            saveMutation.mutate({
              employeeId: selectedPayroll.employee.id,
              periodStart: selectedPayroll.period.start,
              periodEnd: selectedPayroll.period.end,
              grossAmount: selectedPayroll.calculation.grossEarned,
              netAmount: selectedPayroll.calculation.grossEarned - deductionAmount,
              method: getMethod(selectedPayroll.employee.id),
              note: getNote(selectedPayroll.employee.id),
              advanceDeduction: deductionAmount,
              advancesToRecover,
            });
          }}
          isPending={saveMutation.isPending}
        />
      )}
    </div>
  );
}


// ─── Advances Tab ─────────────────────────────────────────────────────────────

function AdvancesTab() {
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);

  // Fetch all employees
  const { data: empData } = useQuery({
    queryKey: ["employees", ""],
    queryFn: async () => {
      const res = await fetch("/api/employees?limit=100");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const employees: any[] = (empData?.employees ?? []).filter((e: any) => e.active);

  // Fetch all advances for all employees
  const { data: allAdvances = [], isLoading } = useQuery({
    queryKey: ["all-advances"],
    enabled: employees.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        employees.map((emp: any) =>
          fetch(`/api/employees/${emp.id}/advances`).then((r) => (r.ok ? r.json() : []))
        )
      );
      return results.flat();
    },
  });

  // Group by employee
  const advancesByEmployee = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const adv of allAdvances) {
      if (!map.has(adv.employeeId)) map.set(adv.employeeId, []);
      map.get(adv.employeeId)!.push(adv);
    }
    return map;
  }, [allAdvances]);

  // Calculate stats per employee
  const employeeStats = useMemo(() => {
    return employees.map((emp) => {
      const advances = advancesByEmployee.get(emp.id) ?? [];
      const outstanding = advances
        .filter((a) => a.status !== "RECOVERED")
        .reduce((sum, a) => sum + (Number(a.amount) - Number(a.recoveredAmount)), 0);
      const totalIssued = advances.reduce((sum, a) => sum + Number(a.amount), 0);
      const totalRecovered = advances.reduce((sum, a) => sum + Number(a.recoveredAmount), 0);

      return {
        employee: emp,
        advances,
        outstanding,
        totalIssued,
        totalRecovered,
      };
    });
  }, [employees, advancesByEmployee]);

  // Filter: show employees with advances or selected employee
  const filteredStats = employeeStats.filter(
    (stat) => stat.advances.length > 0 || (selectedEmployee && stat.employee.id === selectedEmployee)
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {filteredStats.filter((s) => s.outstanding > 0).length} employees with outstanding advances
          </p>
        </div>
        <Button size="sm" onClick={() => setIssueDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Issue Advance
        </Button>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-24 pt-4" />
            </Card>
          ))}
        </div>
      ) : filteredStats.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No advances issued yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredStats.map((stat) => {
            const { employee: emp, advances, outstanding, totalIssued, totalRecovered } = stat;

            return (
              <Card key={emp.id} className={outstanding > 0 ? "border-orange-200" : "opacity-70"}>
                <CardContent className="pt-4 pb-4 space-y-3">
                  {/* Employee header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
                        <DollarSign className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <Link
                          href={`/dashboard/employees/${emp.id}`}
                          className="font-semibold hover:text-primary transition-colors"
                        >
                          {emp.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{emp.jobRole}</p>
                      </div>
                    </div>

                    {outstanding > 0 ? (
                      <div className="text-right">
                        <p className="text-lg font-bold text-orange-600">
                          ₹{outstanding.toLocaleString("en-IN")}
                        </p>
                        <p className="text-[10px] text-muted-foreground">outstanding</p>
                      </div>
                    ) : (
                      <Badge className="bg-green-100 text-green-700">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        All Recovered
                      </Badge>
                    )}
                  </div>

                  {/* Summary stats */}
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Total Issued: ₹{totalIssued.toLocaleString("en-IN")}</span>
                    <span>Recovered: ₹{totalRecovered.toLocaleString("en-IN")}</span>
                    <span>{advances.length} advance{advances.length > 1 ? "s" : ""}</span>
                  </div>

                  {/* Advances list */}
                  <div className="space-y-2">
                    {advances.map((adv) => {
                      const remaining = Number(adv.amount) - Number(adv.recoveredAmount);
                      const isRecovered = adv.status === "RECOVERED";

                      return (
                        <div
                          key={adv.id}
                          className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs ${
                            isRecovered ? "bg-muted/30 opacity-60" : "bg-background"
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                ₹{Number(adv.amount).toLocaleString("en-IN")}
                              </span>
                              {adv.status === "OUTSTANDING" && (
                                <Badge variant="outline" className="text-orange-600 border-orange-300">
                                  Outstanding
                                </Badge>
                              )}
                              {adv.status === "PARTIALLY_RECOVERED" && (
                                <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                                  Partial
                                </Badge>
                              )}
                              {adv.status === "RECOVERED" && (
                                <Badge className="bg-green-100 text-green-700">Recovered</Badge>
                              )}
                            </div>
                            {adv.reason && (
                              <p className="text-muted-foreground mt-0.5">{adv.reason}</p>
                            )}
                            <p className="text-muted-foreground mt-0.5">
                              Issued {new Date(adv.issuedAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          </div>

                          <div className="text-right">
                            {!isRecovered && (
                              <>
                                <p className="font-medium text-orange-600">
                                  ₹{remaining.toLocaleString("en-IN")}
                                </p>
                                <p className="text-muted-foreground">remaining</p>
                              </>
                            )}
                            {Number(adv.recoveredAmount) > 0 && (
                              <p className="text-green-600 text-[10px]">
                                <TrendingDown className="h-3 w-3 inline mr-0.5" />
                                ₹{Number(adv.recoveredAmount).toLocaleString("en-IN")} recovered
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Issue Advance Dialog */}
      <IssueAdvanceDialog
        open={issueDialogOpen}
        onOpenChange={setIssueDialogOpen}
        employees={employees}
        selectedEmployeeId={selectedEmployee}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["all-advances"] });
          setIssueDialogOpen(false);
        }}
      />
    </div>
  );
}

// ─── Issue Advance Dialog ─────────────────────────────────────────────────────

interface IssueAdvanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: any[];
  selectedEmployeeId?: string;
  onSuccess: () => void;
}

function IssueAdvanceDialog({
  open,
  onOpenChange,
  employees,
  selectedEmployeeId,
  onSuccess,
}: IssueAdvanceDialogProps) {
  const [employeeId, setEmployeeId] = useState(selectedEmployeeId ?? "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  // Reset when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setEmployeeId(selectedEmployeeId ?? "");
      setAmount("");
      setReason("");
      setNotes("");
    }
  }, [open, selectedEmployeeId]);

  // Get selected employee's details
  const selectedEmployee = employees.find((e) => e.id === employeeId);

  // Fetch employee's current outstanding advances
  const { data: existingAdvances = [] } = useQuery({
    queryKey: ["advances", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/advances`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const outstandingTotal = existingAdvances
    .filter((a: any) => a.status !== "RECOVERED")
    .reduce((sum: number, a: any) => sum + (Number(a.amount) - Number(a.recoveredAmount)), 0);

  // Validations
  const amountNum = parseFloat(amount);
  const isAmountValid = !isNaN(amountNum) && amountNum > 0;
  const isReasonValid = reason.trim().length >= 3;
  const canSubmit = employeeId && isAmountValid && isReasonValid;

  // Warnings
  const showOutstandingWarning = outstandingTotal > 0;
  const showLargeAmountWarning =
    selectedEmployee && isAmountValid && amountNum > Number(selectedEmployee.salaryAmount) * 2;

  const issueMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/advances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to issue advance");
      return res.json();
    },
    onSuccess,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Issue Advance</DialogTitle>
          <DialogDescription>
            Provide an advance payment to an employee. It will be deducted from future salary payments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Employee Selection */}
          <div className="space-y-2">
            <Label htmlFor="employee">Employee *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger id="employee">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name} — {emp.jobRole}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Show current outstanding if any */}
          {showOutstandingWarning && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Existing outstanding: ₹{outstandingTotal.toLocaleString("en-IN")}</p>
                <p className="text-xs">This employee already has pending advances.</p>
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="100"
            />
            {!isAmountValid && amount && (
              <p className="text-xs text-red-600">Amount must be greater than 0</p>
            )}
            {showLargeAmountWarning && (
              <p className="text-xs text-amber-600">
                ⚠️ This exceeds 2x the employee's salary (₹
                {Number(selectedEmployee.salaryAmount).toLocaleString("en-IN")})
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Input
              id="reason"
              placeholder="e.g., Medical emergency, Family event"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
            />
            {reason && reason.length < 3 && (
              <p className="text-xs text-red-600">Reason must be at least 3 characters</p>
            )}
          </div>

          {/* Notes (optional) */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Summary */}
          {selectedEmployee && isAmountValid && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              <p className="font-medium">{selectedEmployee.name}</p>
              <p className="text-muted-foreground">
                New advance: ₹{amountNum.toLocaleString("en-IN")}
              </p>
              {showOutstandingWarning && (
                <p className="text-muted-foreground">
                  Total outstanding: ₹{(outstandingTotal + amountNum).toLocaleString("en-IN")}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={issueMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => issueMutation.mutate()}
            disabled={!canSubmit || issueMutation.isPending}
          >
            {issueMutation.isPending ? "Issuing..." : "Issue Advance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment Confirmation Dialog (for Salary with Advances) ──────────────────

interface PaymentConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: any;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  outstandingAdvances: number;
  advances: any[];
  paymentMethod: string;
  paymentNote: string;
  onConfirm: (deductionAmount: number, advancesToRecover: { advanceId: string; amount: number }[]) => void;
  isPending: boolean;
}

function PaymentConfirmDialog({
  open,
  onOpenChange,
  employee,
  periodStart,
  periodEnd,
  grossAmount,
  outstandingAdvances,
  advances,
  paymentMethod,
  paymentNote,
  onConfirm,
  isPending,
}: PaymentConfirmDialogProps) {
  const [deductionMode, setDeductionMode] = useState<"FULL" | "PARTIAL" | "NONE">("FULL");
  const [partialAmount, setPartialAmount] = useState("");

  // Reset when dialog opens
  React.useEffect(() => {
    if (open) {
      setDeductionMode(outstandingAdvances > 0 ? "FULL" : "NONE");
      setPartialAmount("");
    }
  }, [open, outstandingAdvances]);

  const partialAmountNum = parseFloat(partialAmount);
  const isPartialValid =
    deductionMode !== "PARTIAL" ||
    (!isNaN(partialAmountNum) &&
      partialAmountNum > 0 &&
      partialAmountNum <= outstandingAdvances &&
      partialAmountNum <= grossAmount);

  const actualDeduction =
    deductionMode === "FULL"
      ? Math.min(outstandingAdvances, grossAmount)
      : deductionMode === "PARTIAL"
      ? partialAmountNum
      : 0;

  const netPayable = grossAmount - actualDeduction;

  // Show warning if net pay is very low
  const showLowPayWarning = netPayable === 0 || netPayable < 500;

  const canConfirm = isPartialValid && !isPending;

  const handleConfirm = () => {
    // FIFO: distribute deduction across advances from oldest first
    const advancesToRecover: { advanceId: string; amount: number }[] = [];
    let remaining = actualDeduction;

    for (const adv of advances) {
      if (remaining <= 0) break;
      const advOutstanding = Number(adv.amount) - Number(adv.recoveredAmount);
      const toRecover = Math.min(remaining, advOutstanding);
      advancesToRecover.push({ advanceId: adv.id, amount: toRecover });
      remaining -= toRecover;
    }

    onConfirm(actualDeduction, advancesToRecover);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Confirm Salary Payment</DialogTitle>
          <DialogDescription>{employee.name} — {employee.jobRole}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary */}
          <div className="rounded-md border px-3 py-2 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gross Salary:</span>
              <span className="font-medium">₹{grossAmount.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outstanding Advance:</span>
              <span className="font-medium text-orange-600">
                ₹{outstandingAdvances.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Deduction Options */}
          {outstandingAdvances > 0 && (
            <div className="space-y-3">
              <Label>Deduct advance from this payment?</Label>
              <RadioGroup value={deductionMode} onValueChange={(v) => setDeductionMode(v as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="FULL" id="full" />
                  <Label htmlFor="full" className="font-normal cursor-pointer">
                    Yes, deduct full amount (₹
                    {Math.min(outstandingAdvances, grossAmount).toLocaleString("en-IN")})
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PARTIAL" id="partial" />
                  <Label htmlFor="partial" className="font-normal cursor-pointer">
                    Deduct partial amount
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="NONE" id="none" />
                  <Label htmlFor="none" className="font-normal cursor-pointer">
                    No, don't deduct this time
                  </Label>
                </div>
              </RadioGroup>

              {/* Partial amount input */}
              {deductionMode === "PARTIAL" && (
                <div className="ml-6 space-y-2">
                  <Label htmlFor="partialAmount">Deduct Amount</Label>
                  <Input
                    id="partialAmount"
                    type="number"
                    placeholder="0"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    min="0"
                    max={Math.min(outstandingAdvances, grossAmount)}
                    step="100"
                  />
                  {partialAmount && !isPartialValid && (
                    <p className="text-xs text-red-600">
                      {partialAmountNum > outstandingAdvances
                        ? "Cannot exceed outstanding amount"
                        : partialAmountNum > grossAmount
                        ? "Cannot exceed gross salary"
                        : "Must be greater than 0"}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Max: ₹{Math.min(outstandingAdvances, grossAmount).toLocaleString("en-IN")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Net Payable */}
          <div className="rounded-md bg-primary/5 border border-primary/20 px-4 py-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Net Payable:</span>
              <span className="text-2xl font-bold text-primary">
                ₹{netPayable.toLocaleString("en-IN")}
              </span>
            </div>
            {actualDeduction > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                After deducting ₹{actualDeduction.toLocaleString("en-IN")} from advances
              </p>
            )}
          </div>

          {/* Low pay warning */}
          {showLowPayWarning && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Warning: Net payment is {netPayable === 0 ? "₹0" : "very low"}</p>
                <p className="text-xs">Employee will receive {netPayable === 0 ? "nothing" : `only ₹${netPayable}`} this period.</p>
              </div>
            </div>
          )}

          {/* Payment details */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Method: {paymentMethod}</p>
            {paymentNote && <p>Note: {paymentNote}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {isPending ? "Processing..." : `Confirm Payment — ₹${netPayable.toLocaleString("en-IN")}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
