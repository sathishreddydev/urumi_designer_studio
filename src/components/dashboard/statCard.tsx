"use client";

import Link from "next/link";
import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";


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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                <CardTitle className="text-xs font-medium leading-tight line-clamp-2">{title}</CardTitle>
                <div className={`shrink-0 ml-1 ${highlight ? "text-primary" : "text-muted-foreground"}`}>{icon}</div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
                <div className={`text-lg font-bold ${highlight ? "text-primary" : ""}`}>{value}</div>
            </CardContent>
        </Card>
    );

    if (href) {
        return <Link href={href} className="block hover:opacity-80 transition-opacity">{card}</Link>;
    }
    return card;
}