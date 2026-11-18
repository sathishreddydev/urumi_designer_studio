"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LockIcon,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import {
  currentWeekMonday,
  currentYearMonth,
  getMonthDates,
  getWeekDates,
  toYMD,
} from "./utils";
import { PeriodNavigator } from "./period-navigator";
import { isEmployedOnDate } from "@/lib/employee-employment";
import {
  AttendanceEntryMode,
  AttendanceHoursRecord,
  calculateWorkedHours,
  DEFAULT_WORK_SCHEDULE,
  getRegularShiftHours,
  WorkScheduleSettings,
} from "@/lib/employee-hours";

type AttendanceSaveRecord = {
  employeeId: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "HOLIDAY";
  entryMode?: AttendanceEntryMode;
  workedHours?: number;
  checkIn?: string;
  checkOut?: string;
  notes?: string;
};

type PublicHoliday = {
  date: string;
  name: string;
};

function WorkScheduleSettingsPanel({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const { data: savedSettings } = useQuery<WorkScheduleSettings>({
    queryKey: ["employee-payroll-settings"],
    queryFn: async () => {
      const response = await fetch("/api/employees/payroll-settings");
      if (!response.ok) throw new Error("Failed to load work schedule");
      return response.json();
    },
  });
  const settings = savedSettings ?? DEFAULT_WORK_SCHEDULE;
  const { data: publicHolidays = [], isError: holidaysError } = useQuery<PublicHoliday[]>({
    queryKey: ["employee-public-holidays"],
    queryFn: async () => {
      const response = await fetch("/api/employees/public-holidays");
      if (!response.ok) throw new Error("Failed to load public holidays");
      return response.json();
    },
  });
  const [shiftStart, setShiftStart] = useState(settings.shiftStart);
  const [shiftEnd, setShiftEnd] = useState(settings.shiftEnd);
  const [breakMinutes, setBreakMinutes] = useState(settings.breakMinutes);

  useEffect(() => {
    setShiftStart(settings.shiftStart);
    setShiftEnd(settings.shiftEnd);
    setBreakMinutes(settings.breakMinutes);
  }, [settings.shiftStart, settings.shiftEnd, settings.breakMinutes]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/employees/payroll-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftStart, shiftEnd, breakMinutes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.formErrors?.[0] ?? "Failed to save work schedule");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-payroll-settings"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      setOpen(false);
    },
  });

  const saveHolidayMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/employees/public-holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: holidayDate, name: holidayName }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.formErrors?.[0] ?? "Failed to save public holiday");
      return result;
    },
    onSuccess: () => {
      setHolidayDate("");
      setHolidayName("");
      queryClient.invalidateQueries({ queryKey: ["employee-public-holidays"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-range"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: async (date: string) => {
      const response = await fetch("/api/employees/public-holidays", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.formErrors?.[0] ?? "Failed to remove public holiday");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-public-holidays"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-range"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
  });

  if (!isAdmin) return null;

  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Normal shift: <span className="font-medium text-foreground">{settings.shiftStart}–{settings.shiftEnd}</span>
          {" · "}{settings.breakMinutes} min unpaid break
          {" · "}{getRegularShiftHours(settings)} regular hours/day
        </p>
        <Button size="sm" variant="outline" onClick={() => setOpen((value) => !value)}>
          {open ? "Close schedule" : "Work schedule"}
        </Button>
      </div>
      {open && (
        <div className="mt-3 space-y-4 border-t pt-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.2fr_auto] sm:items-end">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="work-shift-start">Shift start</Label>
              <Input id="work-shift-start" type="time" value={shiftStart} onChange={(event) => setShiftStart(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="work-shift-end">Shift end</Label>
              <Input id="work-shift-end" type="time" value={shiftEnd} onChange={(event) => setShiftEnd(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="work-break">Unpaid break</Label>
              <select id="work-break" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={breakMinutes} onChange={(event) => setBreakMinutes(Number(event.target.value))}>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
              </select>
            </div>
            <Button size="sm" disabled={saveMutation.isPending || getRegularShiftHours({ shiftStart, shiftEnd, breakMinutes }) <= 0} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Saving…" : "Save schedule"}
            </Button>
            {saveMutation.isError && <p className="text-xs text-destructive sm:col-span-4">{saveMutation.error.message}</p>}
          </div>

          <div className="space-y-2 border-t pt-3">
            <div>
              <p className="text-sm font-medium">Public holidays</p>
              <p className="text-xs text-muted-foreground">Employees receive normal scheduled-day pay. Public holidays on Sundays are unpaid.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="public-holiday-date">Date</Label>
                <Input id="public-holiday-date" type="date" value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="public-holiday-name">Holiday name</Label>
                <Input id="public-holiday-name" value={holidayName} maxLength={100} onChange={(event) => setHolidayName(event.target.value)} placeholder="e.g. Diwali" />
              </div>
              <Button
                size="sm"
                className="self-end"
                disabled={!holidayDate || !holidayName.trim() || saveHolidayMutation.isPending}
                onClick={() => saveHolidayMutation.mutate()}
              >
                {saveHolidayMutation.isPending ? "Saving…" : "Add holiday"}
              </Button>
            </div>
            {(holidaysError || saveHolidayMutation.isError || deleteHolidayMutation.isError) && (
              <p className="text-xs text-destructive" role="alert">
                {holidaysError ? "Failed to load public holidays." : saveHolidayMutation.error?.message ?? deleteHolidayMutation.error?.message}
              </p>
            )}
            {publicHolidays.length > 0 && (
              <ul className="max-h-40 divide-y overflow-y-auto rounded border">
                {publicHolidays.map((holiday) => {
                  const sunday = new Date(`${holiday.date}T00:00:00.000Z`).getUTCDay() === 0;
                  return (
                    <li key={holiday.date} className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                      <span>
                        <span className="font-medium">{holiday.name}</span>
                        <span className="text-muted-foreground"> · {holiday.date}{sunday ? " · Sunday (unpaid)" : ""}</span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deleteHolidayMutation.isPending}
                        onClick={() => deleteHolidayMutation.mutate(holiday.date)}
                      >
                        Remove
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AttendanceCell({
  record,
  employeeId,
  date,
  isSunday,
  compact,
  locked,
  inactive,
  publicHoliday,
  editable,
  editing,
  schedule,
  saving,
  onEdit,
  onCancel,
  onSave,
}: {
  record: any;
  employeeId: string;
  date: string;
  isSunday: boolean;
  compact: boolean;
  locked: boolean;
  inactive: boolean;
  publicHoliday: PublicHoliday | null;
  editable: boolean;
  editing: boolean;
  schedule: WorkScheduleSettings;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (record: AttendanceSaveRecord) => void;
}) {
  if (inactive) return <span className="text-xs text-muted-foreground/50">—</span>;
  if (publicHoliday) {
    const sunday = isSunday;
    return (
      <span
        className={`mx-auto flex min-h-8 w-full flex-col items-center justify-center rounded px-1 text-[10px] leading-tight ${sunday ? "text-muted-foreground" : "font-medium text-blue-700"}`}
        title={sunday ? `${publicHoliday.name} — Sunday public holidays are unpaid` : `${publicHoliday.name} — paid public holiday`}
      >
        <span>{sunday ? "Sunday · unpaid" : "Public holiday"}</span>
        {!compact && <span className="text-[9px]">{publicHoliday.name}</span>}
      </span>
    );
  }

  const regularHoursPerDay = getRegularShiftHours(schedule);
  const savedHours = record?.entryMode
    ? calculateWorkedHours(record, schedule.breakMinutes)
    : null;

  if (editing && editable && !locked && !compact) {
    return (
      <AttendanceCellEditor
        key={`${employeeId}-${date}-${record?.id ?? "new"}`}
        record={record}
        employeeId={employeeId}
        date={date}
        schedule={schedule}
        saving={saving}
        onCancel={onCancel}
        onSave={onSave}
      />
    );
  }

  let summary = "Enter";
  let detail = "";
  if (record?.entryMode && savedHours !== null) {
    const savedRegularHours = Number(record.regularShiftHours) > 0 ? Number(record.regularShiftHours) : regularHoursPerDay;
    const regular = Math.min(savedHours, savedRegularHours);
    const overtime = Math.max(savedHours - savedRegularHours, 0);
    summary = `${isSunday ? "Sun " : ""}${regular.toFixed(regular % 1 ? 1 : 0)}h`;
    detail = overtime > 0 ? `OT ${overtime.toFixed(overtime % 1 ? 1 : 0)}h` : "Regular";
  } else if (record?.status === "ABSENT") {
    summary = "Absent";
  } else if (record?.status === "HOLIDAY") {
    summary = isSunday ? "Sunday" : "Holiday";
  } else if (record?.status === "HALF_DAY") {
    summary = "½ · legacy";
  } else if (record?.status === "PRESENT") {
    summary = "Present · legacy";
  }

  const readOnly = compact || locked || !editable;
  return (
    <button
      type="button"
      disabled={readOnly}
      onClick={onEdit}
      className={`mx-auto flex min-h-8 w-full flex-col items-center justify-center rounded px-1 text-[10px] leading-tight ${
        locked ? "text-muted-foreground" : record?.entryMode ? "text-foreground hover:bg-muted" : "text-muted-foreground hover:bg-muted"
      } ${compact ? "min-h-5" : ""}`}
      title={locked ? "Salary paid — attendance locked" : compact ? "Switch to weekly view to edit attendance" : editable ? "Edit attendance" : "Only admins can edit attendance"}
    >
      <span>{locked && <LockIcon className="mr-1 inline h-3 w-3" />}{summary}</span>
      {detail && !compact && <span className={detail.startsWith("OT") ? "font-medium text-amber-700" : "text-muted-foreground"}>{detail}</span>}
    </button>
  );
}

function AttendanceCellEditor({
  record,
  employeeId,
  date,
  schedule,
  saving,
  onCancel,
  onSave,
}: {
  record: any;
  employeeId: string;
  date: string;
  schedule: WorkScheduleSettings;
  saving: boolean;
  onCancel: () => void;
  onSave: (record: AttendanceSaveRecord) => void;
}) {
  const [entryMode, setEntryMode] = useState<AttendanceEntryMode>(record?.entryMode ?? "HOURS");
  const [hours, setHours] = useState(record?.entryMode === "HOURS" ? String(record.workedHours ?? "") : "");
  const [checkIn, setCheckIn] = useState(record?.checkIn ?? schedule.shiftStart);
  const [checkOut, setCheckOut] = useState(record?.checkOut ?? schedule.shiftEnd);
  const [notes, setNotes] = useState(record?.notes ?? "");

  const workedHours = calculateWorkedHours({
    status: "PRESENT",
    entryMode,
    workedHours: entryMode === "HOURS" && hours !== "" ? Number(hours) : null,
    regularShiftHours: null,
    checkIn: entryMode === "TIME_RANGE" ? checkIn : null,
    checkOut: entryMode === "TIME_RANGE" ? checkOut : null,
  }, schedule.breakMinutes);
  const regularHours = getRegularShiftHours(schedule);
  const regular = workedHours === null ? 0 : Math.min(workedHours, regularHours);
  const overtime = workedHours === null ? 0 : Math.max(workedHours - regularHours, 0);
  const canSave = workedHours !== null;

  function save() {
    onSave({
      employeeId,
      date,
      status: "PRESENT",
      entryMode,
      ...(entryMode === "HOURS" ? { workedHours: Number(hours) } : { checkIn, checkOut }),
      notes: notes || undefined,
    });
  }

  return (
    <div className="min-w-36 space-y-1.5 rounded border bg-background p-2 text-left shadow-sm">
      <div className="grid grid-cols-2 gap-1">
        {(["HOURS", "TIME_RANGE"] as const).map((value) => (
          <button key={value} type="button" onClick={() => setEntryMode(value)} className={`rounded border px-1 py-1 text-[9px] ${entryMode === value ? "border-primary bg-primary/10 font-semibold text-primary" : "text-muted-foreground"}`}>
            {value === "HOURS" ? "Hours" : "Start–End"}
          </button>
        ))}
      </div>
      {entryMode === "HOURS" ? (
        <label className="block text-[9px] text-muted-foreground">
          Hours worked, excluding lunch
          <input type="number" min="0" max="24" step="0.25" value={hours} onChange={(event) => setHours(event.target.value)} className="mt-0.5 h-7 w-full rounded border bg-background px-2 text-xs text-foreground" />
        </label>
      ) : (
        <div className="grid grid-cols-2 gap-1">
          <label className="text-[9px] text-muted-foreground">Start<input aria-label="Start time" type="time" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className="mt-0.5 h-7 w-full rounded border bg-background px-1 text-[10px] text-foreground" /></label>
          <label className="text-[9px] text-muted-foreground">End<input aria-label="End time" type="time" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} className="mt-0.5 h-7 w-full rounded border bg-background px-1 text-[10px] text-foreground" /></label>
        </div>
      )}
      <p className="text-[9px] font-medium text-foreground">
        {workedHours === null
          ? "Enter time to calculate"
          : workedHours === 0
          ? "0 hours clears this attendance entry"
          : `${regular.toFixed(regular % 1 ? 1 : 0)}h regular · ${overtime.toFixed(overtime % 1 ? 1 : 0)}h OT`}
      </p>
      <input aria-label="Attendance note" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Note (optional)" className="h-7 w-full rounded border bg-background px-2 text-[10px]" />
      <div className="flex justify-end gap-1">
        <button type="button" onClick={onCancel} className="rounded px-2 py-1 text-[10px] text-muted-foreground">Cancel</button>
        <button type="button" disabled={!canSave || saving} onClick={save} className="rounded bg-primary px-2 py-1 text-[10px] text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

export function AttendanceTab({ isAdmin = false }: { isAdmin?: boolean }) {
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
  const employees: any[] = (empData?.employees ?? []).filter((employee: any) =>
    displayDates.some((date) => isEmployedOnDate(employee.employmentPeriods ?? [], toYMD(date)))
  );
  const { data: savedSchedule } = useQuery<WorkScheduleSettings>({
    queryKey: ["employee-payroll-settings"],
    queryFn: async () => {
      const response = await fetch("/api/employees/payroll-settings");
      if (!response.ok) throw new Error("Failed to load work schedule");
      return response.json();
    },
  });
  const schedule = savedSchedule ?? DEFAULT_WORK_SCHEDULE;
  const {
    data: publicHolidays = [],
    isLoading: holidaysLoading,
    isError: holidaysLoadError,
  } = useQuery<PublicHoliday[]>({
    queryKey: ["employee-public-holidays"],
    queryFn: async () => {
      const response = await fetch("/api/employees/public-holidays");
      if (!response.ok) throw new Error("Failed to load public holidays");
      return response.json();
    },
  });
  const holidayMap = useMemo(
    () => new Map(publicHolidays.map((holiday) => [holiday.date, holiday])),
    [publicHolidays]
  );

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

  const [editingCell, setEditingCell] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (record: AttendanceSaveRecord) => {
      const res = await fetch("/api/employees/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: [record] }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.formErrors?.[0] ?? "Failed to save attendance");
    },
    onSuccess: () => {
      setEditingCell(null);
      queryClient.invalidateQueries({ queryKey: ["attendance-range"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
  });

  const isLoading = empLoading || attLoading || holidaysLoading;

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

      <WorkScheduleSettingsPanel isAdmin={isAdmin} />
      {holidaysLoadError && (
        <p className="text-xs text-destructive" role="alert">
          Could not load public holidays. Attendance on a configured holiday will be rejected until this is resolved.
        </p>
      )}

      {mode === "monthly" && <p className="text-xs text-muted-foreground">Month view is a summary. Switch to weekly view to enter or edit hours.</p>}

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
                      const isToday = ymd === todayYMD;
                      const isSunday = d.getDay() === 0;
                      const locked = isLocked(emp.id, ymd);
                      const employed = isEmployedOnDate(emp.employmentPeriods ?? [], ymd);
                      const cellKey = `${emp.id}|${ymd}`;
                      return (
                        <td key={ymd}
                          className={`text-center border-r ${!employed ? "bg-muted/40" : locked ? "bg-muted/60" :
                              isToday ? "bg-primary/5" :
                                isSunday ? "bg-blue-50/30" :
                                  ""
                            }`}
                          style={{ padding: mode === "weekly" ? "0.375rem 0.25rem" : "0.25rem 0.1rem", minWidth: mode === "weekly" ? "10rem" : "2.2rem" }}
                        >
                          <AttendanceCell
                            record={recMap[cellKey]}
                            employeeId={emp.id}
                            date={ymd}
                            isSunday={isSunday}
                            compact={mode === "monthly"}
                            locked={locked}
                            inactive={!employed}
                            publicHoliday={holidayMap.get(ymd) ?? null}
                            editable={isAdmin}
                            editing={editingCell === cellKey}
                            schedule={schedule}
                            saving={saveMutation.isPending}
                            onEdit={() => setEditingCell(cellKey)}
                            onCancel={() => setEditingCell(null)}
                            onSave={(entry) => saveMutation.mutate(entry)}
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
      {saveMutation.isError && <p className="text-xs text-destructive">{saveMutation.error.message}</p>}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground items-center">
        <span className="font-medium text-foreground">{mode === "weekly" ? "Select a day to enter hours:" : "Recorded hours and day status"}</span>
        <span>Worked hours exclude unpaid break</span>
        <span>OT is paid at the normal hourly rate</span>
        <span className="flex items-center gap-1 border-l pl-3">
          <LockIcon className="h-3 w-3" />
          Salary paid — locked
        </span>
      </div>
    </div>
  );
}