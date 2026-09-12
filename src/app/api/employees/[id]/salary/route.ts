import { NextResponse } from "next/server";
import { eq, desc, and, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { employeeSalaryPayments, employeeAdvances } from "@/lib/db/schema";
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

    // If advances are being recovered, update them in a transaction
    if (parsed.data.advancesToRecover && parsed.data.advancesToRecover.length > 0) {
      await db.transaction(async (tx) => {
        // Create salary payment record
        await tx
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
          });

        // Update each advance
        for (const adv of parsed.data.advancesToRecover) {
          const [advance] = await tx
            .select()
            .from(employeeAdvances)
            .where(eq(employeeAdvances.id, adv.advanceId));

          if (!advance) continue;

          const currentRecovered = Number(advance.recoveredAmount);
          const newRecovered = currentRecovered + adv.amount;
          const totalAmount = Number(advance.amount);
          
          let newStatus: "OUTSTANDING" | "PARTIALLY_RECOVERED" | "RECOVERED" = "OUTSTANDING";
          if (newRecovered >= totalAmount) {
            newStatus = "RECOVERED";
          } else if (newRecovered > 0) {
            newStatus = "PARTIALLY_RECOVERED";
          }

          await tx
            .update(employeeAdvances)
            .set({
              recoveredAmount: String(newRecovered),
              status: newStatus,
            })
            .where(eq(employeeAdvances.id, adv.advanceId));
        }
      });

      return NextResponse.json({ success: true }, { status: 201 });
    }

    // No advance recovery - simple payment
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
