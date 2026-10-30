
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export interface SummaryStat {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: "green" | "amber" | "cyan" | "blue" | "red" | "purple";
}

interface SummaryStatsProps {
  stats: SummaryStat[];
  className?: string;
}

const colorStyles = {
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

export function SummaryStats({
  stats,
  className,
}: SummaryStatsProps) {
  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${className || ""}`}>
      {stats.map((stat, index) => {
        const Icon = stat.icon;

        return (
          <Card key={`${stat.label}-${index}`}>
            <CardContent className="flex items-center gap-3 px-3 py-3 sm:px-4">
              <div className={`shrink-0 rounded-md p-2 ${colorStyles[stat.color]}`}>
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
