import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { employeeSalaryPayments } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { z } from "zod";

const salarySchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  grossAmount: z.number().positive(),
  deductions: z.number().min(0).default(0),
  netAmount: z.number().positive(),
  method: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER"]).default("CASH"),
  notes: z.string().optional(),
});

export const GET = withPermission(
  { resource: "employee", action: "read" },
  async (_request, { params }) => {
    const { id } = await params;
    const rows = await db
      .select()
      .from(employeeSalaryPayments)
      .where(eq(employeeSalaryPayments.employeeId, id))
      .orderBy(desc(employeeSalaryPayments.paidAt));
    return NextResponse.json(rows);
  }
);

export const POST = withPermission(
  { resource: "employee", action: "update" },
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = salarySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const [record] = await db
      .insert(employeeSalaryPayments)
      .values({
        employeeId: id,
        periodStart: parsed.data.periodStart,
        periodEnd: parsed.data.periodEnd,
        grossAmount: String(parsed.data.grossAmount),
        deductions: String(parsed.data.deductions),
        netAmount: String(parsed.data.netAmount),
        method: parsed.data.method,
        paidBy: session.id,
        notes: parsed.data.notes ?? null,
      })
      .returning();

    return NextResponse.json(record, { status: 201 });
  }
);
