import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employeeAttendance, employeeSalaryPayments } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { z } from "zod";

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
    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Fetch all salary payments to check for paid periods
    const allPayments = await db.select().from(employeeSalaryPayments);

    // Build a set of "employeeId|date" keys that fall inside a paid period
    const paidKeys = new Set<string>();
    for (const payment of allPayments) {
      for (const record of parsed.data.records) {
        if (
          record.employeeId === payment.employeeId &&
          record.date >= payment.periodStart &&
          record.date <= payment.periodEnd
        ) {
          paidKeys.add(`${record.employeeId}|${record.date}`);
        }
      }
    }

    // Reject if any record falls in a paid period
    const lockedRecords = parsed.data.records.filter(
      (r) => paidKeys.has(`${r.employeeId}|${r.date}`)
    );
    if (lockedRecords.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot edit attendance for periods where salary has already been paid.",
          lockedDates: lockedRecords.map((r) => r.date),
        },
        { status: 403 }
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
