import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employeeAttendance } from "@/lib/db/schema";
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
