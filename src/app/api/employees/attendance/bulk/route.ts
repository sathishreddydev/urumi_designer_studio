import { NextResponse } from "next/server";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { employeeAttendance, employeeEmploymentPeriods, employeePayrollSettings, employeeSalaryPayments, employeePublicHolidays, employees } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { z } from "zod";
import { isEmployedOnDate, isValidYmdDate } from "@/lib/employee-employment";
import { attendanceEntryFields, calculateWorkedHours, DEFAULT_WORK_SCHEDULE, getRegularShiftHours, refineAttendanceEntry } from "@/lib/employee-hours";

const bulkSchema = z.object({
  records: z.array(attendanceEntryFields.extend({
    employeeId: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidYmdDate, "Date must be a valid calendar date."),
  }).superRefine(refineAttendanceEntry)).min(1),
});

const attendanceRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidYmdDate),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidYmdDate),
}).refine((range) => range.startDate <= range.endDate, "Start date must be before end date.")
  .refine((range) => {
    const start = new Date(`${range.startDate}T00:00:00Z`).getTime();
    const end = new Date(`${range.endDate}T00:00:00Z`).getTime();
    return (end - start) / 86_400_000 <= 62;
  }, "Attendance range cannot exceed 63 days.");

export const GET = withPermission(
  { resource: "employee", action: "read" },
  async (request) => {
    const { searchParams } = new URL(request.url);
    const parsed = attendanceRangeSchema.safeParse({
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(employeeAttendance)
      .where(and(
        gte(employeeAttendance.date, parsed.data.startDate),
        lte(employeeAttendance.date, parsed.data.endDate)
      ))
      .orderBy(asc(employeeAttendance.date), asc(employeeAttendance.employeeId));
    return NextResponse.json(rows);
  }
);

export const POST = withPermission(
  { resource: "employee", action: "update" },
  async (request, { session }) => {
    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const recordKeys = parsed.data.records.map((record) => `${record.employeeId}|${record.date}`);
    if (new Set(recordKeys).size !== recordKeys.length) {
      return NextResponse.json({ error: "A batch cannot contain duplicate employee dates." }, { status: 400 });
    }

    const [payrollSettings] = await db
      .select()
      .from(employeePayrollSettings)
      .where(eq(employeePayrollSettings.id, "default"))
      .limit(1);
    const workSchedule = payrollSettings ?? { id: "default", ...DEFAULT_WORK_SCHEDULE };
    const breakMinutes = workSchedule.breakMinutes;
    const regularShiftHours = getRegularShiftHours(workSchedule);
    const invalidHoursRecord = parsed.data.records.some((record) => {
      if (!record.entryMode) return false;
      const hours = calculateWorkedHours({
        status: record.status,
        entryMode: record.entryMode,
        workedHours: record.entryMode === "HOURS" ? record.workedHours ?? null : null,
        regularShiftHours: null,
        checkIn: record.checkIn ?? null,
        checkOut: record.checkOut ?? null,
      }, breakMinutes);
      return hours === null;
    });
    if (invalidHoursRecord) {
      return NextResponse.json({ error: "Enter a valid work duration." }, { status: 400 });
    }

    const employeeIds = [...new Set(parsed.data.records.map((record) => record.employeeId))];
    const result = await db.transaction(async (tx) => {
      const lockedEmployees = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(inArray(employees.id, employeeIds))
        .orderBy(asc(employees.id))
        .for("update");
      if (lockedEmployees.length !== employeeIds.length) {
        return { error: "One or more employees were not found.", status: 404 as const };
      }

      const allEmploymentPeriods = await tx
        .select()
        .from(employeeEmploymentPeriods)
        .where(inArray(employeeEmploymentPeriods.employeeId, employeeIds));
      const inactiveDates = parsed.data.records.filter((record) =>
        !isEmployedOnDate(
          allEmploymentPeriods
            .filter((period) => period.employeeId === record.employeeId)
            .map(({ startDate, endDate }) => ({ startDate, endDate })),
          record.date
        )
      );
      if (inactiveDates.length > 0) {
        return {
          error: "Attendance cannot be recorded outside the employee's employment dates.",
          status: 400 as const,
          inactiveDates: inactiveDates.map(({ employeeId, date }) => ({ employeeId, date })),
        };
      }

      const publicHolidayDates = [...new Set(parsed.data.records.map((record) => record.date))];
      const publicHolidays = await tx
        .select({ date: employeePublicHolidays.date, name: employeePublicHolidays.name })
        .from(employeePublicHolidays)
        .where(inArray(employeePublicHolidays.date, publicHolidayDates));
      const holidayDateSet = new Set(publicHolidays.map((holiday) => holiday.date));
      const holidayRecords = parsed.data.records.filter((record) => holidayDateSet.has(record.date));
      if (holidayRecords.length > 0) {
        return {
          error: "Attendance timings cannot be entered on a public holiday.",
          status: 400 as const,
          holidayDates: [...new Set(holidayRecords.map(({ date }) => date))],
        };
      }

      const salaryPayments = await tx
        .select({
          employeeId: employeeSalaryPayments.employeeId,
          periodStart: employeeSalaryPayments.periodStart,
          periodEnd: employeeSalaryPayments.periodEnd,
        })
        .from(employeeSalaryPayments)
        .where(inArray(employeeSalaryPayments.employeeId, employeeIds));
      const lockedDates = parsed.data.records.filter((record) =>
        salaryPayments.some((payment) =>
          payment.employeeId === record.employeeId &&
          record.date >= payment.periodStart &&
          record.date <= payment.periodEnd
        )
      );
      if (lockedDates.length > 0) {
        return {
          error: "Attendance is locked because salary for this period has been paid.",
          status: 400 as const,
          lockedDates: lockedDates.map(({ employeeId, date }) => ({ employeeId, date })),
        };
      }

      const results: (typeof employeeAttendance.$inferSelect)[] = [];
      for (const record of parsed.data.records) {
        const { employeeId, date, status, entryMode, workedHours, checkIn, checkOut, notes } = record;
        if (entryMode === "HOURS" && workedHours === 0) {
          await tx
            .delete(employeeAttendance)
            .where(and(
              eq(employeeAttendance.employeeId, employeeId),
              eq(employeeAttendance.date, date)
            ));
          continue;
        }

        const calculatedHours = entryMode
          ? calculateWorkedHours({
              status,
              entryMode,
              workedHours: entryMode === "HOURS" ? workedHours ?? null : null,
              regularShiftHours: null,
              checkIn: checkIn ?? null,
              checkOut: checkOut ?? null,
            }, breakMinutes)
          : null;
        const attendanceValues = {
          status,
          checkIn: entryMode === "TIME_RANGE" ? checkIn ?? null : null,
          checkOut: entryMode === "TIME_RANGE" ? checkOut ?? null : null,
          workedHours: calculatedHours === null ? null : String(calculatedHours),
          regularShiftHours: entryMode ? String(regularShiftHours) : null,
          entryMode: entryMode ?? null,
          recordedBy: session.id,
        };
        const [existing] = await tx
          .select()
          .from(employeeAttendance)
          .where(and(
            eq(employeeAttendance.employeeId, employeeId),
            eq(employeeAttendance.date, date)
          ))
          .limit(1);

        if (existing) {
          const [updated] = await tx
            .update(employeeAttendance)
            .set({
              ...attendanceValues,
              ...(notes !== undefined ? { notes } : {}),
            })
            .where(eq(employeeAttendance.id, existing.id))
            .returning();
          results.push(updated);
          continue;
        }

        const [inserted] = await tx
          .insert(employeeAttendance)
          .values({ employeeId, date, ...attendanceValues, notes: notes ?? null })
          .returning();
        results.push(inserted);
      }
      return { results };
    });

    if ("error" in result) {
      return NextResponse.json(
        {
          error: result.error,
          ...("inactiveDates" in result ? { inactiveDates: result.inactiveDates } : {}),
          ...("holidayDates" in result ? { holidayDates: result.holidayDates } : {}),
          ...("lockedDates" in result ? { lockedDates: result.lockedDates } : {}),
        },
        { status: result.status }
      );
    }
    return NextResponse.json({ saved: result.results.length, records: result.results });
  }
);
