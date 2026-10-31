import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { employeeEmploymentPeriods, employees } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { currentEmploymentDate } from "@/lib/employee-employment";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const periodsSchema = z.object({
  periods: z.array(z.object({
    startDate: dateSchema,
    endDate: dateSchema.nullable(),
  })),
});

export const GET = withPermission(
  { resource: "employee", action: "read" },
  async (_request, { params }) => {
    const { id } = await params;
    const rows = await db
      .select({ startDate: employeeEmploymentPeriods.startDate, endDate: employeeEmploymentPeriods.endDate })
      .from(employeeEmploymentPeriods)
      .where(eq(employeeEmploymentPeriods.employeeId, id))
      .orderBy(employeeEmploymentPeriods.startDate);
    return NextResponse.json(rows);
  }
);

export const PUT = withPermission(
  { resource: "employee", action: "update" },
  async (request, { params }) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = periodsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const [employee] = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, id)).limit(1);
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const periods = [...parsed.data.periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
    for (let index = 0; index < periods.length; index++) {
      const period = periods[index];
      const start = new Date(`${period.startDate}T00:00:00Z`);
      if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== period.startDate) {
        return NextResponse.json({ error: "Invalid employment start date" }, { status: 400 });
      }
      if (period.endDate) {
        const end = new Date(`${period.endDate}T00:00:00Z`);
        if (Number.isNaN(end.getTime()) || end.toISOString().slice(0, 10) !== period.endDate || period.endDate < period.startDate) {
          return NextResponse.json({ error: "Employment end date must be on or after its start date" }, { status: 400 });
        }
      }
      const next = periods[index + 1];
      if (!period.endDate && next) {
        return NextResponse.json({ error: "Only the latest employment period can be open-ended" }, { status: 400 });
      }
      if (next && period.endDate && next.startDate <= period.endDate) {
        return NextResponse.json({ error: "Employment periods cannot overlap" }, { status: 400 });
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(employeeEmploymentPeriods).where(eq(employeeEmploymentPeriods.employeeId, id));
      if (periods.length) {
        await tx.insert(employeeEmploymentPeriods).values(
          periods.map((period) => ({ employeeId: id, ...period }))
        );
      }
      const today = currentEmploymentDate();
      const hasCurrentPeriod = periods.some(
        (period) => period.startDate <= today && (!period.endDate || period.endDate >= today)
      );
      await tx.update(employees).set({ active: hasCurrentPeriod, updatedAt: new Date() }).where(eq(employees.id, id));
    });

    return NextResponse.json(periods);
  }
);
