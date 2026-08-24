"use client";

interface CalculatorDisplayProps {
  value: string;
  expression?: string;
}

export function CalculatorDisplay({
  value,
  expression,
}: CalculatorDisplayProps) {
  return (
    <div className="rounded-3xl bg-background border border-border p-5 shadow-inner">
      {/* Expression */}
      <div className="h-6 text-right overflow-hidden">
        {expression ? (
          <span className="text-sm text-muted-foreground tabular-nums">
            {expression}
          </span>
        ) : (
          <span className="text-sm text-transparent select-none">.</span>
        )}
      </div>

      {/* Main display */}
      <div className="mt-1 text-right overflow-hidden">
        <span
          className="
            block
            text-xl
            font-bold
            tracking-tight
            tabular-nums
            break-all
            leading-tight
          "
        >
          {value}
        </span>
      </div>
    </div>
  );
}
