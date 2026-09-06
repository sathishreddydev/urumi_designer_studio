import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employees, employeeSalaryPayments } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";

export const GET = withPermission(
  { resource: "employee", action: "read" },
  async () => {
    // Fetch all active employees
    const allEmployees = await db
      .select()
      .from(employees)
      .where(eq(employees.active, true))
      .orderBy(employees.name);

    // Fetch all salary payments ordered by paidAt desc
    const allPayments = await db
      .select()
      .from(employeeSalaryPayments)
      .orderBy(desc(employeeSalaryPayments.paidAt));

    // Build a map: employeeId → latest payment
    const latestPaymentMap = new Map<string, typeof allPayments[0]>();
    for (const p of allPayments) {
      if (!latestPaymentMap.has(p.employeeId)) {
        latestPaymentMap.set(p.employeeId, p);
      }
    }

    const summary = allEmployees.map((emp) => {
      const latest = latestPaymentMap.get(emp.id) ?? null;

      // Determine if overdue
      let overdue = false;
      if (latest) {
        const periodEnd = new Date(latest.periodEnd + "T00:00:00");
        const today = new Date();
        // overdue if last period ended more than one pay cycle ago
        const msPerDay = 86400000;
        const daysSincePeriodEnd = Math.floor((today.getTime() - periodEnd.getTime()) / msPerDay);
        if (emp.payCycle === "WEEKLY" && daysSincePeriodEnd > 7) overdue = true;
        if (emp.payCycle === "MONTHLY" && daysSincePeriodEnd > 31) overdue = true;
      } else {
        // Never been paid — always overdue if they have been active a while
        const daysSinceCreated = Math.floor(
          (new Date().getTime() - new Date(emp.createdAt).getTime()) / 86400000
        );
        if (daysSinceCreated > 7) overdue = true;
      }

      return {
        employee: emp,
        lastPayment: latest,
        overdue,
      };
    });

    return NextResponse.json(summary);
  }
);
