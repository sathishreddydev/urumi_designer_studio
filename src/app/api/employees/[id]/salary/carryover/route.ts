import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  employeeAttendance,
  employeeSalaryCarryovers,
  employeeSalaryPayments,
  employees,
} from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";

const requestSchema = z.object({
  sourcePeriodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourcePeriodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function parseYmd(value: string): Date | null {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function addDays(date: Date, count: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + count);
  return result;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const POST = withPermission(
  { resource: "employee", action: "update" },
  async (request, { params, session }) => {
    const { id } = await params;
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { sourcePeriodStart, sourcePeriodEnd } = parsed.data;
    const start = parseYmd(sourcePeriodStart);
    const end = parseYmd(sourcePeriodEnd);
    if (!start || !end || sourcePeriodEnd < sourcePeriodStart) {
      return NextResponse.json({ error: "Invalid source payroll dates" }, { status: 400 });
    }

    const periodLength = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    let targetPeriodStart: string;
    let targetPeriodEnd: string;

    if (periodLength === 7) {
      const targetStart = addDays(end, 1);
      targetPeriodStart = ymd(targetStart);
      targetPeriodEnd = ymd(addDays(targetStart, 6));
    } else if (
      start.getUTCDate() === 1 &&
      end.getUTCDate() === new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
    ) {
      const targetStart = addDays(end, 1);
      const targetEnd = new Date(Date.UTC(targetStart.getUTCFullYear(), targetStart.getUTCMonth() + 1, 0));
      targetPeriodStart = ymd(targetStart);
      targetPeriodEnd = ymd(targetEnd);
    } else {
      return NextResponse.json({ error: "Source period must be a complete payroll week or month" }, { status: 400 });
    }

    try {
      const result = await db.transaction(async (tx) => {
        const [employee] = await tx.select().from(employees).where(eq(employees.id, id)).limit(1);
        if (!employee) return { error: "Employee not found", status: 404 as const };

        const salaryPayments = await tx
          .select()
          .from(employeeSalaryPayments)
          .where(eq(employeeSalaryPayments.employeeId, id));
        const sourcePayments = salaryPayments.filter((payment) =>
          payment.periodStart === sourcePeriodStart && payment.periodEnd === sourcePeriodEnd
        );
        if (sourcePayments.length === 0) {
          return { error: "This source period has not been paid yet", status: 400 as const };
        }

        const attendanceRows = await tx
          .select()
          .from(employeeAttendance)
          .where(eq(employeeAttendance.employeeId, id));
        const sourceAttendance = attendanceRows.filter((record) =>
          record.date >= sourcePeriodStart && record.date <= sourcePeriodEnd
        );
        let workingDays = 0;
        let effectiveDays = 0;
        for (let date = new Date(start); date <= end; date = addDays(date, 1)) {
          if (date.getUTCDay() === 0) continue;
          workingDays++;
          const attendance = sourceAttendance.find((record) => record.date === ymd(date));
          if (attendance?.status === "PRESENT") effectiveDays++;
          if (attendance?.status === "HALF_DAY") effectiveDays += 0.5;
        }

        const divisor = employee.payCycle === "WEEKLY" ? 6 : workingDays;
        const perDay = divisor > 0 ? Number(employee.salaryAmount) / divisor : 0;
        const currentlyEarned = Math.round(effectiveDays * perDay * 100) / 100;
        const alreadyPaid = sourcePayments.reduce((total, payment) => total + Number(payment.grossAmount), 0);
        const priorCarryovers = await tx
          .select()
          .from(employeeSalaryCarryovers)
          .where(eq(employeeSalaryCarryovers.employeeId, id));
        const alreadyCarried = priorCarryovers
          .filter((carryover) =>
            carryover.sourcePeriodStart === sourcePeriodStart &&
            carryover.sourcePeriodEnd === sourcePeriodEnd
          )
          .reduce((total, carryover) => total + Number(carryover.amount), 0);
        const amount = Math.round(Math.max(currentlyEarned - alreadyPaid - alreadyCarried, 0) * 100) / 100;
        if (amount <= 0) {
          return { error: "There is no new salary balance to carry forward", status: 400 as const };
        }

        const [carryover] = await tx
          .insert(employeeSalaryCarryovers)
          .values({
            employeeId: id,
            sourcePeriodStart,
            sourcePeriodEnd,
            targetPeriodStart,
            targetPeriodEnd,
            amount: amount.toFixed(2),
            createdBy: session.id,
          })
          .returning();

        return { carryover, existing: false };
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json(result, { status: result.existing ? 200 : 201 });
    } catch (error: any) {
      throw error;
    }
  }
);
