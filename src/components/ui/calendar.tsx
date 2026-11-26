"use client";

import * as React from "react";
import { DayButton, DayPicker, type DateRange, type DayButtonProps } from "react-day-picker";
import { addYears, setMonth as setMonthFn, setYear as setYearFn } from "date-fns";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  onRangeDragSelect?: (range: DateRange) => void;
};

type CalendarView = "day" | "month" | "year";

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ─── Shared nav bar ───────────────────────────────────────────────────────────
function NavBar({
  onPrev,
  onNext,
  children,
}: {
  onPrev: () => void;
  onNext: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center justify-center h-9">
      <button
        type="button"
        onClick={onPrev}
        className={cn(buttonVariants({ variant: "outline" }), "absolute left-0 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100")}
        aria-label="Previous"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {children}
      <button
        type="button"
        onClick={onNext}
        className={cn(buttonVariants({ variant: "outline" }), "absolute right-0 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100")}
        aria-label="Next"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Year grid ────────────────────────────────────────────────────────────────
function YearGrid({ current, fromYear, toYear, onSelect }: {
  current: Date; fromYear: number; toYear: number; onSelect: (y: number) => void;
}) {
  const selected = current.getFullYear();
  const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    ref.current?.querySelector("[data-selected=true]")?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <div ref={ref} className="h-56 overflow-y-auto grid grid-cols-3 gap-1 px-1 py-1">
      {years.map((y) => (
        <button
          key={y}
          type="button"
          data-selected={y === selected}
          onClick={() => onSelect(y)}
          className={cn(
            "rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
            y === selected ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground"
          )}
        >
          {y}
        </button>
      ))}
    </div>
  );
}

// ─── Month grid ───────────────────────────────────────────────────────────────
function MonthGrid({ current, onSelect, onYearClick }: {
  current: Date; onSelect: (m: number) => void; onYearClick: () => void;
}) {
  const selected = current.getMonth();
  return (
    <div className="grid grid-cols-3 gap-1 px-1">
      {MONTHS_SHORT.map((m, i) => (
        <button
          key={m}
          type="button"
          data-selected={i === selected}
          onClick={() => onSelect(i)}
          className={cn(
            "rounded-md px-2 py-2 text-sm font-medium transition-colors",
            i === selected ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground"
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

// ─── Main Calendar ────────────────────────────────────────────────────────────
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const { onRangeDragSelect, ...dayPickerProps } = props;
  const fromYear: number = (props as any).fromYear ?? 2000;
  const toYear: number   = (props as any).toYear   ?? new Date().getFullYear() + 5;
  const selected = (props as { selected?: unknown }).selected;
  const rangeDragRef = React.useRef<{
    pointerId: number;
    start: Date;
    current: Date;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = React.useRef(false);

  const [view, setView] = React.useState<CalendarView>("day");
  const [month, setMonth] = React.useState<Date>(() => {
    if (selected instanceof Date) return selected;
    if (props.defaultMonth) return props.defaultMonth;
    return new Date();
  });

  // Keep month in sync when the selected prop changes from outside
  React.useEffect(() => {
    if (selected instanceof Date) setMonth(selected);
  }, [selected]);

  const RangeDragDayButton = React.useCallback((buttonProps: DayButtonProps) => {
    const { day, modifiers } = buttonProps;

    function updatePointerDate(event: React.PointerEvent<HTMLButtonElement>) {
      const drag = rangeDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId || modifiers.disabled) return;
      drag.current = day.date;
      drag.moved = drag.current.getTime() !== drag.start.getTime();
    }

    return (
      <DayButton
        {...buttonProps}
        onPointerDown={(event) => {
          buttonProps.onPointerDown?.(event);
          if (event.button !== 0 || modifiers.disabled) return;
          rangeDragRef.current = {
            pointerId: event.pointerId,
            start: day.date,
            current: day.date,
            moved: false,
          };
        }}
        onPointerEnter={(event) => {
          buttonProps.onPointerEnter?.(event);
          updatePointerDate(event);
        }}
        onPointerUp={(event) => {
          buttonProps.onPointerUp?.(event);
          updatePointerDate(event);
        }}
        onClick={(event) => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          buttonProps.onClick?.(event);
        }}
      />
    );
  }, []);

  React.useEffect(() => {
    const selectRange = onRangeDragSelect;
    if (!selectRange || props.mode !== "range") return;

    function finishDrag(event: PointerEvent) {
      const drag = rangeDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      rangeDragRef.current = null;

      if (!drag.moved) return;

      const [from, to] =
        drag.start.getTime() <= drag.current.getTime()
          ? [drag.start, drag.current]
          : [drag.current, drag.start];
      selectRange({ from, to });
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }

    function cancelDrag(event: PointerEvent) {
      if (rangeDragRef.current?.pointerId === event.pointerId) {
        rangeDragRef.current = null;
      }
    }

    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", cancelDrag);
    return () => {
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", cancelDrag);
    };
  }, [onRangeDragSelect, props.mode]);

  function prevMonth() {
    if (view === "year")  { setMonth((m) => addYears(m, -12)); return; }
    if (view === "month") { setMonth((m) => setYearFn(m, m.getFullYear() - 1)); return; }
    setMonth((m) => setMonthFn(m, m.getMonth() - 1));
  }

  function nextMonth() {
    if (view === "year")  { setMonth((m) => addYears(m, 12)); return; }
    if (view === "month") { setMonth((m) => setYearFn(m, m.getFullYear() + 1)); return; }
    setMonth((m) => setMonthFn(m, m.getMonth() + 1));
  }

  function handleYearSelect(year: number) {
    setMonth((m) => setYearFn(m, year));
    setView("month");
  }

  function handleMonthSelect(monthIndex: number) {
    setMonth((m) => setMonthFn(m, monthIndex));
    setView("day");
  }

  const caption = (
    <NavBar onPrev={prevMonth} onNext={nextMonth}>
      {view === "day" && (
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => setView("month")}
            className="rounded px-1.5 py-0.5 text-sm font-semibold hover:text-primary transition-colors">
            {MONTHS_FULL[month.getMonth()]}
          </button>
          <button type="button" onClick={() => setView("year")}
            className="rounded px-1.5 py-0.5 text-sm font-semibold hover:text-primary transition-colors">
            {month.getFullYear()}
          </button>
        </div>
      )}
      {view === "month" && (
        <button type="button" onClick={() => setView("year")}
          className="rounded px-1.5 py-0.5 text-sm font-semibold hover:text-primary transition-colors">
          {month.getFullYear()}
        </button>
      )}
      {view === "year" && (
        <span className="text-sm font-semibold text-muted-foreground">
          {fromYear} – {toYear}
        </span>
      )}
    </NavBar>
  );

  return (
    <div className={cn("p-3 w-[280px]", className)}>
      {view === "day" && (
        <DayPicker
          showOutsideDays={showOutsideDays}
          month={month}
          onMonthChange={setMonth}
          fromYear={fromYear}
          toYear={toYear}
          classNames={{
            months: "flex flex-col",
            month: "space-y-3",
            month_caption: "flex justify-center pt-1 relative items-center h-9",
            caption_label: "hidden",
            nav: "hidden",
            month_grid: "w-full border-collapse space-y-1",
            weekdays: "flex",
            weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
            week: "flex w-full mt-2",
            day: cn(
              "h-9 w-9 text-center text-sm p-0 relative",
              "[&:has([aria-selected].range-end)]:rounded-r-md",
              "[&:has([aria-selected].outside)]:bg-accent/50",
              "[&:has([aria-selected])]:bg-accent",
              "first:[&:has([aria-selected])]:rounded-l-md",
              "last:[&:has([aria-selected])]:rounded-r-md",
              "focus-within:relative focus-within:z-20"
            ),
            day_button: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
            range_end: "range-end",
            selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            today: "bg-accent text-accent-foreground",
            outside: "outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
            disabled: "text-muted-foreground opacity-50",
            range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
            hidden: "invisible",
            ...classNames,
          }}
          {...dayPickerProps}
          components={{
            ...dayPickerProps.components,
            MonthCaption: () => caption,
            ...(onRangeDragSelect && props.mode === "range"
              ? { DayButton: RangeDragDayButton }
              : {}),
          }}
        />
      )}

      {view === "month" && (
        <div className="space-y-3">
          {caption}
          <MonthGrid current={month} onSelect={handleMonthSelect} onYearClick={() => setView("year")} />
        </div>
      )}

      {view === "year" && (
        <div className="space-y-3">
          {caption}
          <YearGrid current={month} fromYear={fromYear} toYear={toYear} onSelect={handleYearSelect} />
        </div>
      )}
    </div>
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
