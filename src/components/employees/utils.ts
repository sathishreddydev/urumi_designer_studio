export function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function getWeekDates(anchor: Date): Date[] {
  const day = anchor.getDay();
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export function getMonthDates(anchor: Date): Date[] {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const count = new Date(y, m + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => new Date(y, m, i + 1));
}

export function rangeLabel(dates: Date[], mode: "week" | "month"): string {
  if (mode === "month") {
    return dates[0].toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`;
}

// Get current week's Monday as YYYY-MM-DD
export function currentWeekMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return toYMD(monday);
}

export function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function prevPeriod(period: string, isWeek: boolean): string {
  if (isWeek) {
    const d = new Date(period + "T00:00:00");
    d.setDate(d.getDate() - 7);
    return toYMD(d);
  }
  const [y, m] = period.split("-").map(Number);
  const prev = new Date(y, m - 2, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

export function nextPeriod(period: string, isWeek: boolean): string {
  if (isWeek) {
    const d = new Date(period + "T00:00:00");
    d.setDate(d.getDate() + 7);
    return toYMD(d);
  }
  const [y, m] = period.split("-").map(Number);
  const next = new Date(y, m, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

export function periodLabel(period: string, isWeek: boolean): string {
  if (isWeek) {
    const start = new Date(period + "T00:00:00");
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return `${fmt(start)} – ${fmt(end)}`;
  }
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

// Status config
export const PRIMARY_STATUSES = [
  { key: "PRESENT",  label: "P",  title: "Present",  active: "bg-green-500 text-white border-green-500",  inactive: "border-green-300 text-green-600 hover:bg-green-50" },
  { key: "ABSENT",   label: "A",  title: "Absent",   active: "bg-red-500 text-white border-red-500",      inactive: "border-red-300 text-red-500 hover:bg-red-50" },
  { key: "HALF_DAY", label: "½",  title: "Half Day", active: "bg-yellow-400 text-white border-yellow-400",inactive: "border-yellow-300 text-yellow-600 hover:bg-yellow-50" },
  { key: "HOLIDAY",  label: "H",  title: "Holiday",  active: "bg-blue-400 text-white border-blue-400",    inactive: "border-blue-300 text-blue-500 hover:bg-blue-50" },
] as const;

export type StatusKey = typeof PRIMARY_STATUSES[number]["key"] | "";

export const PILL_COLORS: Record<string, string> = {
  PRESENT:  "bg-green-100 text-green-700",
  ABSENT:   "bg-red-100 text-red-700",
  HALF_DAY: "bg-yellow-100 text-yellow-700",
  HOLIDAY:  "bg-blue-100 text-blue-700",
};
