import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { employeePayrollSettings } from "@/lib/db/schema";
import { DEFAULT_WORK_SCHEDULE } from "@/lib/employee-hours";
import { withPermission } from "@/lib/api-guard";

const settingsSchema = z.object({
  shiftStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  shiftEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  breakMinutes: z.union([z.literal(30), z.literal(60)]),
}).superRefine((settings, context) => {
  if (settings.shiftEnd <= settings.shiftStart) {
    context.addIssue({ code: "custom", message: "Shift end must be after shift start." });
    return;
  }
  const [startHour, startMinute] = settings.shiftStart.split(":").map(Number);
  const [endHour, endMinute] = settings.shiftEnd.split(":").map(Number);
  const duration = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (duration <= settings.breakMinutes) {
    context.addIssue({ code: "custom", message: "The shift must be longer than the unpaid break." });
  }
});

export const GET = withPermission(
  { resource: "employee", action: "read" },
  async () => {
    const [settings] = await db
      .select()
      .from(employeePayrollSettings)
      .where(eq(employeePayrollSettings.id, "default"))
      .limit(1);
    return NextResponse.json(settings ?? { id: "default", ...DEFAULT_WORK_SCHEDULE });
  }
);

export const PUT = withPermission(
  { resource: "employee", action: "update" },
  async (request, { session }) => {
    if (session.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can change payroll settings." }, { status: 403 });
    }

    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const [settings] = await db
      .insert(employeePayrollSettings)
      .values({ id: "default", ...parsed.data, updatedBy: session.id, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: employeePayrollSettings.id,
        set: { ...parsed.data, updatedBy: session.id, updatedAt: new Date() },
      })
      .returning();

    return NextResponse.json(settings);
  }
);