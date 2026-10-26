"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LockIcon,
} from "lucide-react";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import {
  currentWeekMonday,
  currentYearMonth,
  getMonthDates,
  getWeekDates,
  PILL_COLORS,
  PRIMARY_STATUSES,
  StatusKey,
  toYMD,
} from "./utils";
import { PeriodNavigator } from "./period-navigator";

function StatusPills({
  status,
  onSelect,
  compact,
  locked,
}: {
  status: StatusKey;
  onSelect: (s: StatusKey) => void;
  compact?: boolean; // month mode — show only active + minimal inactive dots
  locked?: boolean;  // salary already paid — read-only
}) {
  // Locked: show a small lock badge instead of interactive pills
  if (locked) {
    const active = PRIMARY_STATUSES.find((s) => s.key === status);
    return (
      <div className="flex flex-col items-center gap-0.5" title="Salary paid — attendance locked">
        {active ? (
          <span className={`h-5 w-5 rounded text-[9px] font-bold border flex items-center justify-center opacity-60 ${active.active}`}>
            {active.label}
          </span>
        ) : (
          <span className="h-5 w-5 rounded text-[9px] flex items-center justify-center text-muted-foreground/40">—</span>
        )}
      </div>
    );
  }

  if (compact) {
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

export function AttendanceTab() {
  const queryClient = useQueryClient();
  const todayYMD = toYMD(new Date());

  const [mode, setMode] = useState<"weekly" | "monthly">("weekly");
  const [weekPeriod, setWeekPeriod] = useState(currentWeekMonday());
  const [monthPeriod, setMonthPeriod] = useState(currentYearMonth());

  const isWeek = mode === "weekly";
  const period = isWeek ? weekPeriod : monthPeriod;

  const displayDates = useMemo(() => {
    if (isWeek) {
      const anchor = new Date(weekPeriod + "T00:00:00");
      return getWeekDates(anchor);
    } else {
      const [y, m] = monthPeriod.split("-").map(Number);
      return getMonthDates(new Date(y, m - 1, 1));
    }
  }, [isWeek, weekPeriod, monthPeriod]);

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

  // Fetch all salary payments so we can lock paid-period cells
  const { data: salaryPayments = [] } = useQuery({
    queryKey: ["salary-payments-all"],
    queryFn: async () => {
      // Get payments for all employees by fetching the payroll summary which includes paidThisPeriod
      // We need raw payments — use the payroll endpoint for a wide enough range instead,
      // or simply hit each employee's salary history. Easier: call the payroll API for a
      // very early period (just to get the payment list) isn't reliable, so we fetch each
      // active employee's salary history.
      if (employees.length === 0) return [];
      const results = await Promise.all(
        employees.map((emp: any) =>
          fetch(`/api/employees/${emp.id}/salary`).then((r) => r.ok ? r.json() : [])
        )
      );
      // Each result is an array of payment records; flatten and tag with employeeId
      return results.flatMap((rows: any[], i: number) =>
        rows.map((row: any) => ({ ...row, employeeId: employees[i].id }))
      );
    },
    enabled: employees.length > 0,
  });

  // Build a set "employeeId|YYYY-MM-DD" for every date inside a paid period
  const paidDateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const payment of salaryPayments as any[]) {
      const start = payment.periodStart as string;
      const end = payment.periodEnd as string;
      const empId = payment.employeeId as string;
      // iterate each date in the paid range
      const cur = new Date(start + "T00:00:00");
      const last = new Date(end + "T00:00:00");
      while (cur <= last) {
        keys.add(`${empId}|${cur.toISOString().slice(0, 10)}`);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return keys;
  }, [salaryPayments]);

  function isLocked(empId: string, ymd: string): boolean {
    return paidDateKeys.has(`${empId}|${ymd}`);
  }

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
    if (isLocked(empId, date)) return; // salary paid — no edits
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

        // Only auto-mark if no record exists yet and not in a paid period
        if (!existing && !optimistic[key] && !isLocked(emp.id, ymd)) {
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
      <PeriodNavigator
        mode={mode}
        weekPeriod={weekPeriod}
        monthPeriod={monthPeriod}
        onModeChange={setMode}
        onWeekChange={setWeekPeriod}
        onMonthChange={setMonthPeriod}
      />

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
                    style={{ minWidth: mode === "weekly" ? "9rem" : "7rem" }}>
                    Employee
                  </th>
                  {displayDates.map((d) => {
                    const ymd = toYMD(d);
                    const isToday = ymd === todayYMD;
                    const isSunday = d.getDay() === 0;
                    return (
                      <th key={ymd}
                        className={`py-2 text-center font-medium border-r ${isToday ? "text-primary bg-primary/5" :
                            isSunday ? "text-blue-600 bg-blue-50/50" :
                              "text-muted-foreground"
                          }`}
                        style={{ minWidth: mode === "weekly" ? "7rem" : "2.2rem", padding: mode === "weekly" ? "0.5rem 0.25rem" : "0.5rem 0.1rem" }}
                      >
                        {mode === "weekly" ? (
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
                      style={{ minWidth: mode === "weekly" ? "9rem" : "7rem" }}>
                      <Link href={`/dashboard/employees/${emp.id}`}
                        className="font-medium hover:text-primary transition-colors block truncate"
                        style={{ maxWidth: mode === "weekly" ? "8rem" : "6.5rem" }}>
                        {emp.name}
                      </Link>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[8rem]">{emp.jobRole}</p>

                    </td>
                    {displayDates.map((d) => {
                      const ymd = toYMD(d);
                      const status = getStatus(emp.id, ymd);
                      const isToday = ymd === todayYMD;
                      const isSunday = d.getDay() === 0;
                      const locked = isLocked(emp.id, ymd);
                      return (
                        <td key={ymd}
                          className={`text-center border-r ${locked ? "bg-muted/60" :
                              isToday ? "bg-primary/5" :
                                isSunday ? "bg-blue-50/30" :
                                  ""
                            }`}
                          style={{ padding: mode === "weekly" ? "0.375rem 0.25rem" : "0.25rem 0.1rem" }}
                        >
                          <StatusPills
                            status={status}
                            onSelect={(s) => handleSelect(emp.id, ymd, s)}
                            compact={mode === "monthly"}
                            locked={locked}
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
          {mode === "weekly" ? "Tap P·A·½·H to mark:" : "Tap dots to mark:"}
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
        <span className="flex items-center gap-1 border-l pl-3">
          <LockIcon className="h-3 w-3" />
          Salary paid — locked
        </span>
      </div>
    </div>
  );
}