
import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SummaryStat {
    label: string;
    value: string | number;
    icon: LucideIcon;
    color?: "green" | "amber" | "cyan" | "blue" | "red" | "purple";
}

interface SummaryStatsProps {
    stats: SummaryStat[];
    className?: string;
}

const iconColors = {
    green: "text-green-600 dark:text-green-400",
    amber: "text-amber-600 dark:text-amber-400",
    cyan: "text-cyan-600 dark:text-cyan-400",
    blue: "text-blue-600 dark:text-blue-400",
    red: "text-red-600 dark:text-red-400",
    purple: "text-purple-600 dark:text-purple-400",
};

export function SummaryStats({
    stats,
    className,
}: SummaryStatsProps) {
    if (stats.length === 0) return null;

    return (
        <Card className={cn("overflow-hidden", className)}>
            <div className="grid grid-cols-2 gap-2 p-3 lg:grid-cols-4">
                {stats.map((stat, index) => {
                    const Icon = stat.icon;

                    return (
                        <div
                            key={`${stat.label}-${index}`}
                            className="min-w-0 space-y-1.5 rounded-md border p-2.5 sm:p-3"
                        >
                            <div className="flex items-center gap-1.5">
                                <Icon
                                    className={cn(
                                        "h-4 w-4 shrink-0",
                                        iconColors[stat.color || "blue"]
                                    )}
                                />
                            </div>

                            <p className="truncate text-lg font-bold tracking-tight">
                                {stat.value}
                            </p>

                            <p className="truncate text-[11px] text-muted-foreground">
                                {stat.label}
                            </p>
                        </div>
                    );
                })}
                </div>
        </Card>
    );
}
