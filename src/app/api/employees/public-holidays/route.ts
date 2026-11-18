import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { employeePublicHolidays } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { isValidYmdDate } from "@/lib/employee-employment";

const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidYmdDate, "Enter a valid holiday date."),
  name: z.string().trim().min(1).max(100),
});

export const GET = withPermission(
  { resource: "employee", action: "read" },
  async () => {
    const holidays = await db
      .select()
      .from(employeePublicHolidays)
      .orderBy(asc(employeePublicHolidays.date));
    return NextResponse.json(holidays);
  }
);

export const POST = withPermission(
  { resource: "employee", action: "update" },
  async (request, { session }) => {
    if (session.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can manage public holidays." }, { status: 403 });
    }

    const parsed = holidaySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const [holiday] = await db
      .insert(employeePublicHolidays)
      .values({ ...parsed.data, createdBy: session.id })
      .onConflictDoUpdate({
        target: employeePublicHolidays.date,
        set: { name: parsed.data.name, createdBy: session.id },
      })
      .returning();

    return NextResponse.json(holiday);
  }
);

export const DELETE = withPermission(
  { resource: "employee", action: "update" },
  async (request, { session }) => {
    if (session.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can manage public holidays." }, { status: 403 });
    }

    const parsed = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidYmdDate, "Enter a valid holiday date."),
    }).safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await db
      .delete(employeePublicHolidays)
      .where(eq(employeePublicHolidays.date, parsed.data.date));
    return NextResponse.json({ success: true });
  }
);
