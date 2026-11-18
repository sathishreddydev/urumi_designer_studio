import { NextResponse } from "next/server";
import { and, asc, eq, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { employees, employeeSalaryPayments, employeeAdvances } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { z } from "zod";

function isValidDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const salarySchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  grossAmount: z.number().positive(),
  deductions: z.number().min(0).default(0),
  netAmount: z.number().min(0),
  method: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER"]).default("CASH"),
  notes: z.string().optional(),
  // Advance deduction fields
  advanceDeduction: z.number().min(0).default(0),
  advancesToRecover: z.array(z.object({
    advanceId: z.string(),
    amount: z.number().positive(),
  })).optional(),
}).superRefine((data, context) => {
  if (!isValidDate(data.periodStart) || !isValidDate(data.periodEnd) || data.periodEnd < data.periodStart) {
    context.addIssue({ code: "custom", message: "Enter a valid salary period." });
  }

  const totalDeductions = data.deductions + data.advanceDeduction;
  if (totalDeductions > data.grossAmount + 0.001) {
    context.addIssue({ code: "custom", message: "Deductions cannot exceed gross salary." });
  }
  if (Math.abs(data.grossAmount - totalDeductions - data.netAmount) > 0.011) {
    context.addIssue({ code: "custom", message: "Net amount must equal gross salary minus deductions." });
  }

  const advances = data.advancesToRecover ?? [];
  if (new Set(advances.map((advance) => advance.advanceId)).size !== advances.length) {
    context.addIssue({ code: "custom", message: "An advance can only be recovered once per payment." });
  }
  const recoveryTotal = advances.reduce((sum, advance) => sum + advance.amount, 0);
  if (Math.abs(recoveryTotal - data.advanceDeduction) > 0.011) {
    context.addIssue({ code: "custom", message: "Advance deductions must match the recovery amounts." });
  }
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

    const advancesToRecover = parsed.data.advancesToRecover ?? [];
    const result = await db.transaction(async (tx) => {
      const [employee] = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.id, id))
        .for("update")
        .limit(1);
      if (!employee) {
        return { error: "Employee not found.", status: 404 as const };
      }

      const existingPayments = await tx
        .select({ periodStart: employeeSalaryPayments.periodStart, periodEnd: employeeSalaryPayments.periodEnd })
        .from(employeeSalaryPayments)
        .where(eq(employeeSalaryPayments.employeeId, id));
      const overlappingPayment = existingPayments.some((payment) =>
        payment.periodStart <= parsed.data.periodEnd && payment.periodEnd >= parsed.data.periodStart
      );
      if (overlappingPayment) {
        return { error: "Salary has already been recorded for this period.", status: 409 as const };
      }

      const advanceIds = advancesToRecover.map((advance) => advance.advanceId);
      const lockedAdvances = advanceIds.length > 0
        ? await tx
            .select()
            .from(employeeAdvances)
            .where(and(
              eq(employeeAdvances.employeeId, id),
              inArray(employeeAdvances.id, advanceIds)
            ))
            .orderBy(asc(employeeAdvances.id))
            .for("update")
        : [];
      if (lockedAdvances.length !== advanceIds.length) {
        return { error: "One or more advances do not belong to this employee.", status: 400 as const };
      }
      for (const recovery of advancesToRecover) {
        const advance = lockedAdvances.find((item) => item.id === recovery.advanceId);
        if (!advance || recovery.amount > Number(advance.amount) - Number(advance.recoveredAmount) + 0.001) {
          return { error: "An advance recovery exceeds its outstanding balance.", status: 400 as const };
        }
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
        const advance = lockedAdvances.find((item) => item.id === adv.advanceId)!;

        const newRecovered = Number(advance.recoveredAmount) + adv.amount;
        const totalAmount = Number(advance.amount);
        const status: "OUTSTANDING" | "PARTIALLY_RECOVERED" | "RECOVERED" =
          newRecovered >= totalAmount ? "RECOVERED" : newRecovered > 0 ? "PARTIALLY_RECOVERED" : "OUTSTANDING";

        await tx
          .update(employeeAdvances)
          .set({ recoveredAmount: String(newRecovered), status })
          .where(eq(employeeAdvances.id, adv.advanceId));
      }

      return { payment };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    }
    return NextResponse.json(result.payment, { status: 201 });
  }
);
