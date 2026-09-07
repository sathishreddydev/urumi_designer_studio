import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  employees,
  employeeAttendance,
  employeeSalaryPayments,
  employeeAdvances,
} from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";

// Count Mon–Sat days in a given YYYY-MM period (or a week range)
function countWorkingDays(dates: string[]): number {
  return dates.filter((d) => {
    const day = new Date(d + "T00:00:00").getDay(); // 0=Sun
    return day !== 0; // exclude Sunday
  }).length;
}

function getMonthDates(ym: string): string[] {
  const [y, m] = ym.split("-").map(Number);
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const dd = String(i + 1).padStart(2, "0");
    return `${ym}-${dd}`;
  });
}

function getWeekDates(weekStart: string): string[] {
  const start = new Date(weekStart + "T00:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

export const GET = withPermission(
  { resource: "employee", action: "read" },
  async (request) => {
    const { searchParams } = new URL(request.url);
    // period = "YYYY-MM" for monthly, "YYYY-MM-DD" (monday) for weekly
    const period = searchParams.get("period") ?? new Date().toISOString().slice(0, 7);
    const isWeek = period.length === 10; // YYYY-MM-DD means week mode

    // Build the date strings for the period
    const periodDates = isWeek ? getWeekDates(period) : getMonthDates(period);
    const periodStart = periodDates[0];
    const periodEnd   = periodDates[periodDates.length - 1];
    const workingDays = countWorkingDays(periodDates); // Mon–Sat count

    // All active employees
    const allEmployees = await db
      .select()
      .from(employees)
      .where(eq(employees.active, true))
      .orderBy(employees.name);

    // All attendance in this period for all employees
    const allAttendance = await db
      .select()
      .from(employeeAttendance)
      .then((rows) =>
        rows.filter((r) => r.date >= periodStart && r.date <= periodEnd)
      );

    // Latest salary payment per employee
    const allPayments = await db
      .select()
      .from(employeeSalaryPayments)
      .orderBy(desc(employeeSalaryPayments.paidAt));

    const latestPaymentMap = new Map<string, typeof allPayments[0]>();
    for (const p of allPayments) {
      if (!latestPaymentMap.has(p.employeeId)) {
        latestPaymentMap.set(p.employeeId, p);
      }
    }

    // Check if already paid for this period
    const paidThisPeriodMap = new Map<string, typeof allPayments[0]>();
    for (const p of allPayments) {
      if (p.periodStart === periodStart && p.periodEnd === periodEnd) {
        paidThisPeriodMap.set(p.employeeId, p);
      }
    }

    // Outstanding advances per employee
    const allAdvances = await db
      .select()
      .from(employeeAdvances)
      .then((rows) =>
        rows.filter((r) => r.status !== "RECOVERED")
      );

    const advanceMap = new Map<string, number>();
    for (const a of allAdvances) {
      const outstanding = Number(a.amount) - Number(a.recoveredAmount);
      advanceMap.set(a.employeeId, (advanceMap.get(a.employeeId) ?? 0) + outstanding);
    }

    // Build per-employee payroll summary
    const payroll = allEmployees.map((emp) => {
      const empAttendance = allAttendance.filter((a) => a.employeeId === emp.id);

      const present  = empAttendance.filter((a) => a.status === "PRESENT").length;
      const halfDay  = empAttendance.filter((a) => a.status === "HALF_DAY").length;
      const absent   = empAttendance.filter((a) => a.status === "ABSENT").length;
      const holiday  = empAttendance.filter((a) => a.status === "HOLIDAY").length;

      // Universal per-day rate:
      // Weekly employees: weeklyAmount ÷ 6 (Mon–Sat)
      // Monthly employees: monthlyAmount ÷ working days in the period
      const divisor = emp.payCycle === "WEEKLY" ? 6 : workingDays;
      const perDay = divisor > 0 ? Number(emp.salaryAmount) / divisor : 0;

      const effectiveDays = present + halfDay * 0.5;
      const grossEarned = Math.round(effectiveDays * perDay * 100) / 100;

      const outstandingAdvances = advanceMap.get(emp.id) ?? 0;
      const netPayable = Math.max(0, grossEarned - outstandingAdvances);

      // How many working days have no attendance record yet
      const markedDates = new Set(empAttendance.map((a) => a.date));
      const unmarkedWorkingDays = periodDates.filter((d) => {
        const day = new Date(d + "T00:00:00").getDay();
        return day !== 0 && !markedDates.has(d); // not Sunday and not marked
      }).length;

      const paidRecord = paidThisPeriodMap.get(emp.id) ?? null;
      const latestPayment = latestPaymentMap.get(emp.id) ?? null;

      return {
        employee: emp,
        period: { start: periodStart, end: periodEnd, workingDays: divisor },
        attendance: { present, halfDay, absent, holiday, effectiveDays, unmarkedWorkingDays },
        calculation: { perDay: Math.round(perDay * 100) / 100, grossEarned, outstandingAdvances, netPayable },
        paidThisPeriod: paidRecord,
        latestPayment,
      };
    });

    return NextResponse.json({ period, periodStart, periodEnd, workingDays, payroll });
  }
);
