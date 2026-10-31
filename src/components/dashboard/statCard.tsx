"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";


export default function StatCard({
    title,
    value,
    icon,
    href,
    highlight,
}: {
    title: string;
    value: number;
    icon: React.ReactNode;
    href?: string;
    highlight?: boolean;
}) {
    const card = (
        <Card className={highlight ? "border-primary/50 bg-primary/5" : undefined}>
            <CardContent className="flex flex-col items-center justify-center gap-1.5 p-2.5 text-center sm:flex-row sm:items-center sm:gap-2 sm:text-left">
                <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                        highlight ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                >
                    {icon}
                </div>
                <div className="min-w-0 flex flex-col items-center gap-0.5 sm:items-start">
                    <div className={`text-base font-bold leading-none ${highlight ? "text-primary" : ""}`}>
                        {value}
                    </div>
                    <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground leading-tight text-center sm:text-left break-words">
                        {title}
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (href) {
        return <Link href={href} className="block hover:opacity-80 transition-opacity">{card}</Link>;
    }
    return card;
}