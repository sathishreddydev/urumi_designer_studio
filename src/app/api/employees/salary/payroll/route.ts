import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  employees,
  employeeAttendance,
  employeeSalaryPayments,
  employeeAdvances,
  employeePayrollSettings,
  employeeEmploymentPeriods,
  employeePublicHolidays,
} from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { calculateEmployeePeriodEarnings, DEFAULT_WORK_SCHEDULE } from "@/lib/employee-hours";
import { currentEmploymentDate, isEmployedOnDate, isValidYmdDate } from "@/lib/employee-employment";

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
  const [year, month, day] = weekStart.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d.toISOString().split("T")[0];
  });
}

export const GET = withPermission(
  { resource: "employee", action: "read" },
  async (request) => {
    const { searchParams } = new URL(request.url);
    // period = "YYYY-MM" for monthly, "YYYY-MM-DD" (monday) for weekly
    const period = searchParams.get("period") ?? currentEmploymentDate().slice(0, 7);
    const isWeek = /^\d{4}-\d{2}-\d{2}$/.test(period);
    const isMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
    if (
      (!isWeek && !isMonth) ||
      (isWeek && (
        !isValidYmdDate(period) ||
        new Date(`${period}T00:00:00.000Z`).getUTCDay() !== 1
      ))
    ) {
      return NextResponse.json(
        { error: "Period must be a valid month or a Monday date for weekly payroll." },
        { status: 400 }
      );
    }

    // Build the date strings for the period
    const periodDates = isWeek ? getWeekDates(period) : getMonthDates(period);
    const periodStart = periodDates[0];
    const periodEnd   = periodDates[periodDates.length - 1];
    const workingDays = countWorkingDays(periodDates); // Mon–Sat count

    // Include inactive employees when they have payroll history in this period.
    const allEmployees = await db
      .select()
      .from(employees)
      .orderBy(employees.name);
    const allEmploymentPeriods = await db.select().from(employeeEmploymentPeriods);

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
    const publicHolidays = await db.select().from(employeePublicHolidays);

    const [savedSettings] = await db
      .select()
      .from(employeePayrollSettings)
      .where(eq(employeePayrollSettings.id, "default"))
      .limit(1);
    const workSchedule = savedSettings ?? { id: "default", ...DEFAULT_WORK_SCHEDULE };

    const latestPaymentMap = new Map<string, typeof allPayments[0]>();
    for (const p of allPayments) {
      if (!latestPaymentMap.has(p.employeeId)) {
        latestPaymentMap.set(p.employeeId, p);
      }
    }

    // Check if already paid for this period
    const paidThisPeriodMap = new Map<string, typeof allPayments[0]>();
    for (const p of allPayments) {
      if (p.periodStart <= periodEnd && p.periodEnd >= periodStart) {
        if (!paidThisPeriodMap.has(p.employeeId)) {
          paidThisPeriodMap.set(p.employeeId, p);
        }
      }
    }

    // Outstanding advances per employee
    const allAdvances = await db
      .select()
      .from(employeeAdvances);

    const advanceMap = new Map<string, { outstanding: number; total: number }>();
    for (const a of allAdvances) {
      const outstanding = Math.max(Number(a.amount) - Number(a.recoveredAmount), 0);
      const total = Number(a.amount);
      const existing = advanceMap.get(a.employeeId) ?? { outstanding: 0, total: 0 };
      advanceMap.set(a.employeeId, {
        outstanding: existing.outstanding + outstanding,
        total: existing.total + total,
      });
    }

    // Build per-employee payroll summary
    const payroll = allEmployees
      // In monthly view, only show monthly-cycle employees.
      // Weekly employees are paid week-by-week and should only appear in weekly view.
      .filter((emp) => emp.payCycle === (isWeek ? "WEEKLY" : "MONTHLY"))
      .filter((emp) => emp.active ||
        allPayments.some((payment) =>
          payment.employeeId === emp.id &&
          payment.periodStart <= periodEnd &&
          payment.periodEnd >= periodStart
        )
      )
      .map((emp) => {
      const empAttendance = allAttendance.filter((a) => a.employeeId === emp.id);
      const employmentPeriods = allEmploymentPeriods
        .filter((employmentPeriod) => employmentPeriod.employeeId === emp.id)
        .map(({ startDate, endDate }) => ({ startDate, endDate }));
      const publicHolidayDates = publicHolidays
        .filter((holiday) =>
          holiday.date >= periodStart &&
          holiday.date <= periodEnd &&
          isEmployedOnDate(employmentPeriods, holiday.date)
        )
        .map((holiday) => holiday.date);
      const publicHolidaySet = new Set(publicHolidayDates);
      const payableAttendance = empAttendance.filter((record) => !publicHolidaySet.has(record.date));

      const present  = payableAttendance.filter((a) => a.status === "PRESENT").length;
      const halfDay  = payableAttendance.filter((a) => a.status === "HALF_DAY").length;
      const absent   = payableAttendance.filter((a) => a.status === "ABSENT").length;
      const holiday  = payableAttendance.filter((a) => a.status === "HOLIDAY").length;

      const divisor = emp.payCycle === "WEEKLY" ? 6 : workingDays;
      const perDay = divisor > 0 ? Number(emp.salaryAmount) / divisor : 0;
      const effectiveDays = present + halfDay * 0.5;
      const earnings = calculateEmployeePeriodEarnings(
        payableAttendance,
        Number(emp.salaryAmount),
        emp.payCycle,
        workingDays,
        workSchedule,
        publicHolidayDates
      );
      const grossEarned = earnings.grossEarned;

      const advanceInfo = advanceMap.get(emp.id) ?? { outstanding: 0, total: 0 };
      const outstandingAdvances = advanceInfo.outstanding;
      const totalAdvances = advanceInfo.total;
      // Don't deduct advances here - that happens in the payment dialog
      // netPayable at this stage is just the gross earned amount
      const netPayable = grossEarned;

      // How many working days have no attendance record yet
      const markedDates = new Set(empAttendance.map((a) => a.date));
      const unmarkedWorkingDays = periodDates.filter((d) => {
        const day = new Date(d + "T00:00:00").getDay();
        return day !== 0 &&
          isEmployedOnDate(employmentPeriods, d) &&
          !publicHolidaySet.has(d) &&
          !markedDates.has(d);
      }).length;

      const paidRecord = paidThisPeriodMap.get(emp.id) ?? null;
      const latestPayment = latestPaymentMap.get(emp.id) ?? null;

      return {
        employee: emp,
        period: { start: periodStart, end: periodEnd, workingDays: divisor },
        attendance: {
          present,
          halfDay,
          absent,
          holiday,
          publicHoliday: earnings.paidHolidayDays,
          effectiveDays,
          unmarkedWorkingDays,
          regularHours: earnings.regularHours,
          overtimeHours: earnings.overtimeHours,
        },
        calculation: {
          perDay: Math.round(perDay * 100) / 100,
          hourlyRate: earnings.hourlyRate,
          regularHours: earnings.regularHours,
          overtimeHours: earnings.overtimeHours,
          regularEarnings: earnings.regularEarnings,
          overtimeEarnings: earnings.overtimeEarnings,
          legacyEarnings: earnings.legacyEarnings,
          publicHolidayEarnings: earnings.publicHolidayEarnings,
          grossEarned,
          outstandingAdvances,
          totalAdvances,
          netPayable,
        },
        paidThisPeriod: paidRecord,
        latestPayment,
      };
    });

    return NextResponse.json({ period, periodStart, periodEnd, workingDays, payroll });
  }
);
