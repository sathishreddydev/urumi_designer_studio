import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getStudioDb } from "@/lib/multi-tenant/studio";
import { employeeAttendance, employeeEmploymentPeriods, employeeSalaryPayments } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { z } from "zod";
import { isEmployedOnDate } from "@/lib/employee-employment";

const bulkSchema = z.object({
  records: z.array(
    z.object({
      employeeId: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      status: z.enum(["PRESENT", "ABSENT", "HALF_DAY", "HOLIDAY"]),
    })
  ).min(1),
});

export const POST = withPermission(
  { resource: "employee", action: "update" },
  async (request, { session }) => {
    const db = await getStudioDb();
    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const allEmploymentPeriods = await db.select().from(employeeEmploymentPeriods);
    const inactiveDates = parsed.data.records.filter((record) =>
      !isEmployedOnDate(
        allEmploymentPeriods
          .filter((period) => period.employeeId === record.employeeId)
          .map(({ startDate, endDate }) => ({ startDate, endDate })),
        record.date
      )
    );
    if (inactiveDates.length > 0) {
      return NextResponse.json(
        {
          error: "Attendance cannot be recorded outside the employee's employment dates.",
          inactiveDates: inactiveDates.map(({ employeeId, date }) => ({ employeeId, date })),
        },
        { status: 400 }
      );
    }

    const salaryPayments = await db
      .select({
        employeeId: employeeSalaryPayments.employeeId,
        periodStart: employeeSalaryPayments.periodStart,
        periodEnd: employeeSalaryPayments.periodEnd,
      })
      .from(employeeSalaryPayments);
    const lockedDates = parsed.data.records.filter((record) =>
      salaryPayments.some((payment) =>
        payment.employeeId === record.employeeId &&
        record.date >= payment.periodStart &&
        record.date <= payment.periodEnd
      )
    );
    if (lockedDates.length > 0) {
      return NextResponse.json(
        {
          error: "Attendance is locked because salary for this period has been paid.",
          lockedDates: lockedDates.map(({ employeeId, date }) => ({ employeeId, date })),
        },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      parsed.data.records.map(async ({ employeeId, date, status }) => {
        // Fetch all for this employee then find by date (matches existing pattern)
        const existing = await db
          .select()
          .from(employeeAttendance)
          .where(eq(employeeAttendance.employeeId, employeeId))
          .then((rows) => rows.find((r) => r.date === date));

        if (existing) {
          const [updated] = await db
            .update(employeeAttendance)
            .set({ status, recordedBy: session.id })
            .where(eq(employeeAttendance.id, existing.id))
            .returning();
          return updated;
        }

        const [inserted] = await db
          .insert(employeeAttendance)
          .values({ employeeId, date, status, recordedBy: session.id })
          .returning();
        return inserted;
      })
    );

    return NextResponse.json({ saved: results.length, records: results });
  }
);
