export interface EmploymentPeriod {
  startDate: string;
  endDate: string | null;
}

export function currentEmploymentDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isEmployedOnDate(
  periods: EmploymentPeriod[],
  date: string
): boolean {
  return periods.some(
    ({ startDate, endDate }) => date >= startDate && (!endDate || date <= endDate)
  );
}
