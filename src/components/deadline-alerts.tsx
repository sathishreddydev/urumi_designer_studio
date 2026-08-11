"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Calendar, Shirt } from "lucide-react";
import { formatStatus, getStatusColor } from "@/lib/utils";

function daysUntil(date: string | Date): number {
  const target = new Date(date);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDeadline(date: string | Date): string {
  const days = daysUntil(date);
  if (days < -1) return `${Math.abs(days)} days overdue`;
  if (days === -1) return "1 day overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

export function DeadlineAlerts() {
  const { data, isLoading } = useQuery({
    queryKey: ["deadlines"],
    queryFn: async () => {
      const res = await fetch("/api/deadlines");
      if (!res.ok) return { overdue: [], dueSoon: [], upcomingTrials: [], totalAlerts: 0 };
      return res.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading || !data || data.totalAlerts === 0) return null;

  return (
    <div className="space-y-3">
      {/* Overdue — Red alert */}
      {data.overdue.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Overdue ({data.overdue.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {data.overdue.map((outfit: any) => (
              <Link key={outfit.id} href={`/dashboard/outfits/${outfit.id}`}>
                <div className="flex items-center justify-between rounded-md bg-white/60 dark:bg-black/20 px-3 py-2 hover:bg-white dark:hover:bg-black/30 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <Shirt className="h-3.5 w-3.5 text-red-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{outfit.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {outfit.customerName} · {outfit.orderNumber}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-[10px] font-semibold text-red-600">
                      {formatDeadline(outfit.deliveryDate)}
                    </p>
                    <Badge className={`text-[9px] ${getStatusColor(outfit.status)}`}>
                      {formatStatus(outfit.status)}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Due Soon — Yellow/amber alert */}
      {data.dueSoon.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Due Soon ({data.dueSoon.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {data.dueSoon.map((outfit: any) => (
              <Link key={outfit.id} href={`/dashboard/outfits/${outfit.id}`}>
                <div className="flex items-center justify-between rounded-md bg-white/60 dark:bg-black/20 px-3 py-2 hover:bg-white dark:hover:bg-black/30 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <Shirt className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{outfit.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {outfit.customerName} · {outfit.orderNumber}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-[10px] font-semibold text-amber-600">
                      {formatDeadline(outfit.deliveryDate)}
                    </p>
                    <Badge className={`text-[9px] ${getStatusColor(outfit.status)}`}>
                      {formatStatus(outfit.status)}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Trials — Blue info */}
      {data.upcomingTrials.length > 0 && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Trials Approaching ({data.upcomingTrials.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {data.upcomingTrials.map((outfit: any) => (
              <Link key={outfit.id} href={`/dashboard/outfits/${outfit.id}`}>
                <div className="flex items-center justify-between rounded-md bg-white/60 dark:bg-black/20 px-3 py-2 hover:bg-white dark:hover:bg-black/30 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <Shirt className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{outfit.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {outfit.customerName} · {outfit.orderNumber}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-[10px] font-semibold text-blue-600">
                      {formatDeadline(outfit.trialDate)}
                    </p>
                    <Badge className={`text-[9px] ${getStatusColor(outfit.status)}`}>
                      {formatStatus(outfit.status)}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
