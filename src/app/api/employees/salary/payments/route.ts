import { NextResponse } from "next/server";
import { and, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { employeeSalaryPayments } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { isValidYmdDate } from "@/lib/employee-employment";

const paymentRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidYmdDate),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidYmdDate),
}).refine((range) => range.startDate <= range.endDate, "Start date must be before end date.");

export const GET = withPermission(
  { resource: "employee", action: "read" },
  async (request) => {
    const { searchParams } = new URL(request.url);
    const parsed = paymentRangeSchema.safeParse({
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payments = await db
      .select({
        employeeId: employeeSalaryPayments.employeeId,
        periodStart: employeeSalaryPayments.periodStart,
        periodEnd: employeeSalaryPayments.periodEnd,
      })
      .from(employeeSalaryPayments)
      .where(and(
        lte(employeeSalaryPayments.periodStart, parsed.data.endDate),
        gte(employeeSalaryPayments.periodEnd, parsed.data.startDate)
      ));
    return NextResponse.json(payments);
  }
);
