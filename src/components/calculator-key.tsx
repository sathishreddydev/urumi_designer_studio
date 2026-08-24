"use client";

import type { ReactNode } from "react";

interface CalculatorKeyProps {
  children: ReactNode;
  onClick: () => void;
  variant?: "number" | "operator" | "action" | "equals";
  className?: string;
}

export function CalculatorKey({
  children,
  onClick,
  variant = "number",
  className = "",
}: CalculatorKeyProps) {
  const base =
    "h-8 rounded-2xl flex items-center justify-center text-base font-semibold select-none transition-all duration-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/40";

  const variants = {
    number:
      "bg-background border border-border text-foreground hover:bg-muted shadow-sm",
    operator:
      "bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20",
    action:
      "bg-muted border border-border text-muted-foreground hover:bg-muted/70",
    equals:
      "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}