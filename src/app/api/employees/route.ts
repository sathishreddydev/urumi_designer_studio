import { NextResponse } from "next/server";
import { ilike, or, desc, count, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { employeeEmploymentPeriods, employees } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { z } from "zod";
import { requiredPhoneSchema } from "@/lib/validations";
import { normalizePhoneNumber } from "@/lib/phone-utils";
import { currentEmploymentDate } from "@/lib/employee-employment";

const employeeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: requiredPhoneSchema,
  jobRole: z.string().min(1, "Job role is required"),
  payCycle: z.enum(["WEEKLY", "MONTHLY"]).default("MONTHLY"),
  salaryAmount: z.number().positive("Salary must be positive"),
  shiftStart: z.string().optional(),
  shiftEnd: z.string().optional(),
  active: z.boolean().default(true),
  notes: z.string().optional(),
});

export const GET = withPermission(
  { resource: "employee", action: "read" },
  async (request) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const condition = search
      ? or(
          ilike(employees.name, `%${search}%`),
          ilike(employees.phone, `%${search}%`),
          ilike(employees.jobRole, `%${search}%`)
        )
      : undefined;

    const employeeRows = await db
      .select()
      .from(employees)
      .where(condition)
      .orderBy(desc(employees.createdAt))
      .limit(limit)
      .offset(offset);

    const allPeriods = await db.select().from(employeeEmploymentPeriods);
    const rows = employeeRows.map((employee) => ({
      ...employee,
      employmentPeriods: allPeriods
        .filter((period) => period.employeeId === employee.id)
        .map(({ startDate, endDate }) => ({ startDate, endDate }))
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    }));

    const [{ total }] = await db.select({ total: count() }).from(employees).where(condition);

    return NextResponse.json({ employees: rows, total, page, limit });
  }
);

export const POST = withPermission(
  { resource: "employee", action: "create" },
  async (request) => {
    const body = await request.json();
    const parsed = employeeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // If an employee with the same phone already exists, mark them inactive first
    const [existing] = await db
      .select({ id: employees.id, name: employees.name })
      .from(employees)
      .where(eq(employees.phone, parsed.data.phone))
      .limit(1);

    let deactivatedPrevious: { id: string; name: string } | null = null;
    if (existing) {
      const today = currentEmploymentDate();
      const yesterdayDate = new Date(`${today}T00:00:00Z`);
      yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
      const yesterday = yesterdayDate.toISOString().slice(0, 10);
      const openPeriod = await db
        .select()
        .from(employeeEmploymentPeriods)
        .where(eq(employeeEmploymentPeriods.employeeId, existing.id))
        .then((periods) => periods.find((period) => !period.endDate));
      if (openPeriod) {
        if (openPeriod.startDate > yesterday) {
          await db.delete(employeeEmploymentPeriods).where(and(
            eq(employeeEmploymentPeriods.employeeId, existing.id),
            eq(employeeEmploymentPeriods.startDate, openPeriod.startDate)
          ));
        } else {
          await db.update(employeeEmploymentPeriods)
            .set({ endDate: yesterday })
            .where(and(
              eq(employeeEmploymentPeriods.employeeId, existing.id),
              eq(employeeEmploymentPeriods.startDate, openPeriod.startDate)
            ));
        }
      }
      await db
        .update(employees)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(employees.id, existing.id));
      deactivatedPrevious = { id: existing.id, name: existing.name };
    }

    const [emp] = await db
      .insert(employees)
      .values({
        name: parsed.data.name,
        phone: normalizePhoneNumber(parsed.data.phone)!,
        jobRole: parsed.data.jobRole,
        payCycle: parsed.data.payCycle,
        salaryAmount: String(parsed.data.salaryAmount),
        shiftStart: parsed.data.shiftStart ?? null,
        shiftEnd: parsed.data.shiftEnd ?? null,
        active: parsed.data.active,
        notes: parsed.data.notes ?? null,
      })
      .returning();
    if (emp.active) {
      await db.insert(employeeEmploymentPeriods).values({
        employeeId: emp.id,
        startDate: currentEmploymentDate(),
        endDate: null,
      });
    }
    return NextResponse.json({ ...emp, deactivatedPrevious }, { status: 201 });
  }
);
