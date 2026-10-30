
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
    const [primary, ...secondary] = stats;

    if (!primary) return null;

    const PrimaryIcon = primary.icon;

    return (
        <Card className={cn("overflow-hidden", className)}>
            <div className="p-4 sm:p-5 lg:px-6 lg:py-5">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:items-center lg:gap-0">

                    {/* Primary stat */}
                    <div className="col-span-2 flex min-w-0 flex-col gap-2 lg:col-span-2 lg:px-3 lg:py-2">
                        <div className="flex items-center gap-2">
                            <PrimaryIcon
                                className={cn(
                                    "h-4 w-4 shrink-0",
                                    iconColors[primary.color || "green"]
                                )}
                            />
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {primary.label}
                            </p>
                        </div>

                        <p className="truncate text-lg font-bold tracking-tight">
                            {primary.value}
                        </p>
                    </div>

                    {/* Secondary stats */}
                    {secondary.map((stat, index) => {
                        const Icon = stat.icon;

                        return (
                            <div
                                key={`${stat.label}-${index}`}
                                className={cn(
                                    "min-w-0 space-y-2 border-t pt-3",
                                    "lg:border-l lg:border-t-0 lg:px-5 lg:py-2",
                                    index === 0 && "lg:col-span-1",
                                    index === 1 && "lg:col-span-2"
                                )}
                            >
                                <Icon
                                    className={cn(
                                        "h-4 w-4",
                                        iconColors[stat.color || "blue"]
                                    )}
                                />

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
            </div>
        </Card>
    );
}
