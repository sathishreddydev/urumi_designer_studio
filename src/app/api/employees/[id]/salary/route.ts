import { NextResponse } from "next/server";
import { eq, desc, and, ne, sql, isNull } from "drizzle-orm";
import { getStudioDb } from "@/lib/multi-tenant/studio";
import { employeeSalaryCarryovers, employeeSalaryPayments, employeeAdvances } from "@/lib/db/schema";
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
  // Advance deduction fields
  advanceDeduction: z.number().min(0).default(0),
  advancesToRecover: z.array(z.object({
    advanceId: z.string(),
    amount: z.number().positive(),
  })).optional(),
});

export const GET = withPermission(
  { resource: "employee", action: "read" },
  async (_request, { params }) => {
    const db = await getStudioDb();
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
    const db = await getStudioDb();
    const { id } = await params;
    const body = await request.json();
    const parsed = salarySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const advancesToRecover = parsed.data.advancesToRecover ?? [];
    const result = await db.transaction(async (tx) => {
      const pendingCarryovers = await tx
        .select()
        .from(employeeSalaryCarryovers)
        .where(and(
          eq(employeeSalaryCarryovers.employeeId, id),
          eq(employeeSalaryCarryovers.targetPeriodStart, parsed.data.periodStart),
          eq(employeeSalaryCarryovers.targetPeriodEnd, parsed.data.periodEnd),
          isNull(employeeSalaryCarryovers.appliedAt)
        ));
      const carryoverTotal = pendingCarryovers.reduce((sum, item) => sum + Number(item.amount), 0);
      if (parsed.data.grossAmount + 0.001 < carryoverTotal) {
        return { error: "Salary payment must include all carry-forward amounts for this period." };
      }

      const [payment] = await tx
        .insert(employeeSalaryPayments)
        .values({
          employeeId: id,
          periodStart: parsed.data.periodStart,
          periodEnd: parsed.data.periodEnd,
          grossAmount: String(parsed.data.grossAmount),
          deductions: String(parsed.data.deductions + parsed.data.advanceDeduction),
          netAmount: String(parsed.data.netAmount),
          method: parsed.data.method,
          paidBy: session.id,
          notes: parsed.data.notes ?? null,
        })
        .returning();

      for (const adv of advancesToRecover) {
        const [advance] = await tx
          .select()
          .from(employeeAdvances)
          .where(eq(employeeAdvances.id, adv.advanceId));
        if (!advance) continue;

        const newRecovered = Number(advance.recoveredAmount) + adv.amount;
        const totalAmount = Number(advance.amount);
        const status: "OUTSTANDING" | "PARTIALLY_RECOVERED" | "RECOVERED" =
          newRecovered >= totalAmount ? "RECOVERED" : newRecovered > 0 ? "PARTIALLY_RECOVERED" : "OUTSTANDING";

        await tx
          .update(employeeAdvances)
          .set({ recoveredAmount: String(newRecovered), status })
          .where(eq(employeeAdvances.id, adv.advanceId));
      }

      if (pendingCarryovers.length > 0) {
        await tx
          .update(employeeSalaryCarryovers)
          .set({ appliedAt: new Date(), salaryPaymentId: payment.id })
          .where(and(
            eq(employeeSalaryCarryovers.employeeId, id),
            eq(employeeSalaryCarryovers.targetPeriodStart, parsed.data.periodStart),
            eq(employeeSalaryCarryovers.targetPeriodEnd, parsed.data.periodEnd),
            isNull(employeeSalaryCarryovers.appliedAt)
          ));
      }
      return { payment };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result.payment, { status: 201 });
  }
);
