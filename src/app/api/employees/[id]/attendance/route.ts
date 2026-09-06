import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { employeeAttendance } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { z } from "zod";

const attendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  status: z.enum(["PRESENT", "ABSENT", "HALF_DAY", "HOLIDAY"]),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  notes: z.string().optional(),
});

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

    // Upsert — one record per employee per day
    const existing = await db
      .select({ id: employeeAttendance.id })
      .from(employeeAttendance)
      .where(eq(employeeAttendance.employeeId, id))
      .then((rows) => rows.find((r) => {
        // filter by date after fetch since we don't have a compound index query helper here
        return true; // handled below
      }));

    // Check for existing record for this date
    const existingForDate = await db
      .select()
      .from(employeeAttendance)
      .where(eq(employeeAttendance.employeeId, id))
      .then((rows) => rows.find((r) => r.date === parsed.data.date));

    if (existingForDate) {
      const [updated] = await db
        .update(employeeAttendance)
        .set({
          status: parsed.data.status,
          checkIn: parsed.data.checkIn ?? null,
          checkOut: parsed.data.checkOut ?? null,
          notes: parsed.data.notes ?? null,
          recordedBy: session.id,
        })
        .where(eq(employeeAttendance.id, existingForDate.id))
        .returning();
      return NextResponse.json(updated);
    }

    const [record] = await db
      .insert(employeeAttendance)
      .values({
        employeeId: id,
        date: parsed.data.date,
        status: parsed.data.status,
        checkIn: parsed.data.checkIn ?? null,
        checkOut: parsed.data.checkOut ?? null,
        notes: parsed.data.notes ?? null,
        recordedBy: session.id,
      })
      .returning();

    return NextResponse.json(record, { status: 201 });
  }
);
