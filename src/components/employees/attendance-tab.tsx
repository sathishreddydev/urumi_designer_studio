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
import {
  toYMD,
  getWeekDates,
  getMonthDates,
  rangeLabel,
  PRIMARY_STATUSES,
  PILL_COLORS,
  StatusKey,
} from "./utils";

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

export function AttendanceTab() {
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