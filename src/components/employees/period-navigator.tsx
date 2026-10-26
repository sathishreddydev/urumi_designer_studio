"use client";

import {
  currentWeekMonday,
  currentYearMonth,
  nextPeriod,
  periodLabel,
  prevPeriod,
} from "./utils";

interface PeriodNavigatorProps {
  mode: "weekly" | "monthly";
  weekPeriod: string;
  monthPeriod: string;
  onModeChange: (mode: "weekly" | "monthly") => void;
  onWeekChange: (period: string) => void;
  onMonthChange: (period: string) => void;
}

export function PeriodNavigator({
  mode,
  weekPeriod,
  monthPeriod,
  onModeChange,
  onWeekChange,
  onMonthChange,
}: PeriodNavigatorProps) {
  const isWeek = mode === "weekly";
  const period = isWeek ? weekPeriod : monthPeriod;

  function handlePrev() {
    if (isWeek) onWeekChange(prevPeriod(period, true));
    else onMonthChange(prevPeriod(period, false));
  }

  function handleNext() {
    if (isWeek) onWeekChange(nextPeriod(period, true));
    else onMonthChange(nextPeriod(period, false));
  }

  function handleToday() {
    onWeekChange(currentWeekMonday());
    onMonthChange(currentYearMonth());
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Mode toggle */}
      <div className="flex gap-1 rounded-md border p-0.5 bg-muted">
        {(["weekly", "monthly"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors capitalize ${
              mode === m
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Period navigator */}
      <div className="flex items-center gap-1 rounded-md border px-1 py-0.5">
        <button
          onClick={handlePrev}
          className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground"
        >
          ‹
        </button>
        <span className="text-sm font-medium px-2 min-w-[10rem] text-center">
          {periodLabel(period, isWeek)}
        </span>
        <button
          onClick={handleNext}
          className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground"
        >
          ›
        </button>
      </div>

      {/* Jump to current */}
      <button
        onClick={handleToday}
        className="text-xs text-primary hover:underline"
      >
        Today
      </button>
    </div>
  );
}
