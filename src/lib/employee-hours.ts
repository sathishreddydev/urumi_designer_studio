import { z } from "zod";

export const UNPAID_BREAK_MINUTES = 30;

export type AttendanceEntryMode = "HOURS" | "TIME_RANGE";

export type WorkScheduleSettings = {
  shiftStart: string;
  shiftEnd: string;
  breakMinutes: number;
};

export const DEFAULT_WORK_SCHEDULE: WorkScheduleSettings = {
  shiftStart: "11:00",
  shiftEnd: "20:00",
  breakMinutes: 30,
};

export type AttendanceHoursRecord = {
  date?: string;
  status: string;
  entryMode: string | null;
  workedHours: string | number | null;
  regularShiftHours: string | number | null;
  checkIn: string | null;
  checkOut: string | null;
};

export const attendanceEntryFields = z.object({
  status: z.enum(["PRESENT", "ABSENT", "HALF_DAY", "HOLIDAY"]),
  entryMode: z.enum(["HOURS", "TIME_RANGE"]).optional(),
  workedHours: z.number().min(0).max(24).optional(),
  checkIn: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  checkOut: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  notes: z.string().optional(),
});

export function refineAttendanceEntry(
  entry: z.infer<typeof attendanceEntryFields>,
  context: z.RefinementCtx
) {
  if (!entry.entryMode) return;
  if (entry.status !== "PRESENT") {
    context.addIssue({ code: "custom", message: "Hours can only be entered for a work day." });
    return;
  }
  if (entry.entryMode === "HOURS" && entry.workedHours === undefined) {
    context.addIssue({ code: "custom", message: "Enter the hours worked." });
  }
  if (entry.entryMode === "TIME_RANGE") {
    const start = parseTime(entry.checkIn ?? null);
    const end = parseTime(entry.checkOut ?? null);
    if (start === null || end === null || end <= start) {
      context.addIssue({ code: "custom", message: "Enter a valid start and end time." });
    }
  }
}

export const attendanceEntrySchema = attendanceEntryFields.superRefine(refineAttendanceEntry);

function parseTime(value: string | null): number | null {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function calculateWorkedHours(
  record: AttendanceHoursRecord,
  breakMinutes = UNPAID_BREAK_MINUTES
): number | null {
  if (record.entryMode === "HOURS") {
    if (record.workedHours === null) return null;
    const hours = Number(record.workedHours);
    return Number.isFinite(hours) && hours >= 0 ? Math.round(hours * 100) / 100 : null;
  }

  if (record.entryMode === "TIME_RANGE") {
    if (record.workedHours !== null) {
      const hours = Number(record.workedHours);
      return Number.isFinite(hours) && hours >= 0 ? Math.round(hours * 100) / 100 : null;
    }
    const start = parseTime(record.checkIn);
    const end = parseTime(record.checkOut);
    if (start === null || end === null || end <= start) return null;
    const workedMinutes = Math.max(end - start - breakMinutes, 0);
    return Math.round((workedMinutes / 60) * 100) / 100;
  }

  return null;
}

export function getRegularShiftHours(settings: WorkScheduleSettings): number {
  const start = parseTime(settings.shiftStart);
  const end = parseTime(settings.shiftEnd);
  if (start === null || end === null || end <= start) return 0;
  return Math.max(Math.round((end - start - settings.breakMinutes) / 60 * 100) / 100, 0);
}

export function calculateEmployeePeriodEarnings(
  records: AttendanceHoursRecord[],
  salaryAmount: number,
  payCycle: "WEEKLY" | "MONTHLY",
  workingDays: number,
  settings: WorkScheduleSettings = DEFAULT_WORK_SCHEDULE,
  publicHolidayDates: string[] = []
) {
  const scheduledDays = payCycle === "WEEKLY" ? 6 : workingDays;
  const publicHolidaySet = new Set(publicHolidayDates);
  const defaultRegularHours = getRegularShiftHours(settings);
  const savedShiftHours = records
    .filter((record) => record.entryMode === "HOURS" || record.entryMode === "TIME_RANGE")
    .map((record) => Number(record.regularShiftHours))
    .filter((hours) => Number.isFinite(hours) && hours > 0);
  const regularShiftHours = savedShiftHours.length > 0
    ? savedShiftHours.reduce((sum, hours) => sum + hours, 0) / savedShiftHours.length
    : defaultRegularHours;
  const legacyDailyRate = scheduledDays > 0 ? salaryAmount / scheduledDays : 0;
  const hourlyRate = scheduledDays > 0 && regularShiftHours > 0
    ? salaryAmount / (scheduledDays * regularShiftHours)
    : 0;
  let regularHours = 0;
  let overtimeHours = 0;
  let legacyEarnings = 0;

  for (const record of records) {
    if (record.date && publicHolidaySet.has(record.date)) continue;

    if (record.entryMode === "HOURS" || record.entryMode === "TIME_RANGE") {
      const hours = calculateWorkedHours(record) ?? 0;
      const dailyRegularHours = Number(record.regularShiftHours) > 0
        ? Number(record.regularShiftHours)
        : defaultRegularHours;
      regularHours += Math.min(hours, dailyRegularHours);
      overtimeHours += Math.max(hours - dailyRegularHours, 0);
      continue;
    }

    if (record.status === "PRESENT") legacyEarnings += legacyDailyRate;
    if (record.status === "HALF_DAY") legacyEarnings += legacyDailyRate * 0.5;
  }

  const roundedRegularHours = Math.round(regularHours * 100) / 100;
  const roundedOvertimeHours = Math.round(overtimeHours * 100) / 100;
  const regularEarnings = roundedRegularHours * hourlyRate;
  const overtimeEarnings = roundedOvertimeHours * hourlyRate;
  const paidHolidayDays = publicHolidayDates.filter((date) => {
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    return weekday !== 0;
  }).length;
  const publicHolidayEarnings = Math.round(paidHolidayDays * legacyDailyRate * 100) / 100;
  const grossEarned = Math.round(
    (regularEarnings + overtimeEarnings + legacyEarnings + publicHolidayEarnings) * 100
  ) / 100;

  return {
    hourlyRate: Math.round(hourlyRate * 100) / 100,
    regularHours: roundedRegularHours,
    overtimeHours: roundedOvertimeHours,
    regularEarnings: Math.round(regularEarnings * 100) / 100,
    overtimeEarnings: Math.round(overtimeEarnings * 100) / 100,
    legacyEarnings: Math.round(legacyEarnings * 100) / 100,
    paidHolidayDays,
    publicHolidayEarnings,
    grossEarned,
  };
}