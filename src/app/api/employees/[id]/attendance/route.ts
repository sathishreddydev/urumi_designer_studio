import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { employeeAttendance, employeeEmploymentPeriods, employeePayrollSettings, employeeSalaryPayments, employeePublicHolidays, employees } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { isEmployedOnDate, isValidYmdDate } from "@/lib/employee-employment";
import { z } from "zod";
import { attendanceEntryFields, calculateWorkedHours, DEFAULT_WORK_SCHEDULE, getRegularShiftHours, refineAttendanceEntry } from "@/lib/employee-hours";

const attendanceSchema = attendanceEntryFields.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").refine(isValidYmdDate, "Date must be a valid calendar date."),
}).superRefine(refineAttendanceEntry);

export const GET = withPermission(
  { resource: "employee", action: "read" },
  async (request, { params }) => {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // "YYYY-MM"

    let rows = await db
      .select()
      .from(employeeAttendance)
      .where(eq(employeeAttendance.employeeId, id))
      .orderBy(desc(employeeAttendance.date));

    if (month) {
      rows = rows.filter((r) => r.date.startsWith(month));
    }

    return NextResponse.json(rows);
  }
);

export const POST = withPermission(
  { resource: "employee", action: "update" },
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = attendanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const [payrollSettings] = await db
      .select()
      .from(employeePayrollSettings)
      .where(eq(employeePayrollSettings.id, "default"))
      .limit(1);
    const workSchedule = payrollSettings ?? { id: "default", ...DEFAULT_WORK_SCHEDULE };
    const breakMinutes = workSchedule.breakMinutes;
    const regularShiftHours = getRegularShiftHours(workSchedule);

    // Upsert — one record per employee per day
    // Check for existing record for this date
    const { date, status, entryMode, workedHours, checkIn, checkOut, notes } = parsed.data;
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
    if (entryMode && calculatedHours === null) {
      return NextResponse.json({ error: "Enter a valid work duration." }, { status: 400 });
    }
    const attendanceValues = {
      status,
      checkIn: entryMode === "TIME_RANGE" ? checkIn ?? null : null,
      checkOut: entryMode === "TIME_RANGE" ? checkOut ?? null : null,
      workedHours: calculatedHours === null ? null : String(calculatedHours),
      regularShiftHours: entryMode ? String(regularShiftHours) : null,
      entryMode: entryMode ?? null,
      notes: notes ?? null,
      recordedBy: session.id,
    };
    const result = await db.transaction(async (tx) => {
      const [employee] = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.id, id))
        .for("update")
        .limit(1);
      if (!employee) return { error: "Employee not found.", status: 404 as const };

      const periods = await tx
        .select({ startDate: employeeEmploymentPeriods.startDate, endDate: employeeEmploymentPeriods.endDate })
        .from(employeeEmploymentPeriods)
        .where(eq(employeeEmploymentPeriods.employeeId, id));
      if (!isEmployedOnDate(periods, date)) {
        return { error: "Attendance cannot be recorded outside the employee's employment dates.", status: 400 as const };
      }

      const [publicHoliday] = await tx
        .select({ name: employeePublicHolidays.name })
        .from(employeePublicHolidays)
        .where(eq(employeePublicHolidays.date, date))
        .limit(1);
      if (publicHoliday) {
        return { error: "Attendance timings cannot be entered on a public holiday.", status: 400 as const };
      }

      const salaryPayments = await tx
        .select({ periodStart: employeeSalaryPayments.periodStart, periodEnd: employeeSalaryPayments.periodEnd })
        .from(employeeSalaryPayments)
        .where(eq(employeeSalaryPayments.employeeId, id));
      if (salaryPayments.some((payment) => date >= payment.periodStart && date <= payment.periodEnd)) {
        return { error: "Attendance is locked because salary for this period has been paid.", status: 400 as const };
      }

      if (entryMode === "HOURS" && workedHours === 0) {
        await tx
          .delete(employeeAttendance)
          .where(and(
            eq(employeeAttendance.employeeId, id),
            eq(employeeAttendance.date, date)
          ));
        return { cleared: true as const, status: 200 as const };
      }

      const [existingForDate] = await tx
        .select({ id: employeeAttendance.id })
        .from(employeeAttendance)
        .where(and(
          eq(employeeAttendance.employeeId, id),
          eq(employeeAttendance.date, date)
        ))
        .limit(1);
      if (existingForDate) {
        const [updated] = await tx
          .update(employeeAttendance)
          .set(attendanceValues)
          .where(eq(employeeAttendance.id, existingForDate.id))
          .returning();
        return { record: updated, status: 200 as const };
      }

      const [record] = await tx
        .insert(employeeAttendance)
        .values({ employeeId: id, date, ...attendanceValues })
        .returning();
      return { record, status: 201 as const };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    if ("cleared" in result) {
      return NextResponse.json({ cleared: true }, { status: result.status });
    }
    return NextResponse.json(result.record, { status: result.status });
  }
);
