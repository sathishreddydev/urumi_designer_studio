import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(7).optional(),
  jobRole: z.string().min(1).optional(),
  payCycle: z.enum(["WEEKLY", "MONTHLY"]).optional(),
  salaryAmount: z.number().positive().optional(),
  shiftStart: z.string().nullable().optional(),
  shiftEnd: z.string().nullable().optional(),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export const GET = withPermission(
  { resource: "employee", action: "read" },
  async (_request, { params }) => {
    const { id } = await params;
    const [emp] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(emp);
  }
);

export const PATCH = withPermission(
  { resource: "employee", action: "update" },
  async (request, { params }) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
    if (parsed.data.jobRole !== undefined) updateData.jobRole = parsed.data.jobRole;
    if (parsed.data.payCycle !== undefined) updateData.payCycle = parsed.data.payCycle;
    if (parsed.data.salaryAmount !== undefined) updateData.salaryAmount = String(parsed.data.salaryAmount);
    if (parsed.data.shiftStart !== undefined) updateData.shiftStart = parsed.data.shiftStart;
    if (parsed.data.shiftEnd !== undefined) updateData.shiftEnd = parsed.data.shiftEnd;
    if (parsed.data.active !== undefined) updateData.active = parsed.data.active;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

    const [updated] = await db
      .update(employees)
      .set(updateData)
      .where(eq(employees.id, id))
      .returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  }
);

export const DELETE = withPermission(
  { resource: "employee", action: "delete" },
  async (_request, { params }) => {
    const { id } = await params;
    await db.delete(employees).where(eq(employees.id, id));
    return NextResponse.json({ success: true });
  }
);
