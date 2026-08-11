"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Shirt } from "lucide-react";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";

export default function AppointmentsPage() {
  // Fetch outfits with upcoming trial dates
  const { data: trials, isLoading: trialsLoading } = useQuery({
    queryKey: ["appointments-trials"],
    queryFn: async () => {
      const res = await fetch("/api/outfits?status=TRIAL&limit=50");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Fetch outfits ready for delivery
  const { data: deliveries, isLoading: deliveriesLoading } = useQuery({
    queryKey: ["appointments-deliveries"],
    queryFn: async () => {
      const res = await fetch("/api/outfits?status=READY_FOR_DELIVERY&limit=50");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold lg:text-3xl">Appointments</h1>
        <p className="text-sm text-muted-foreground">Upcoming trials and deliveries</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Upcoming Trials
          </h2>
          {trialsLoading ? (
            <Card className="animate-pulse"><CardContent className="h-20 pt-6" /></Card>
          ) : trials?.outfits?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No upcoming trials
              </CardContent>
            </Card>
          ) : (
            trials?.outfits?.map((outfit: any) => (
              <Link key={outfit.id} href={`/dashboard/outfits/${outfit.id}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{outfit.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {outfit.order?.customer?.name}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge className={getStatusColor(outfit.status)}>Trial</Badge>
                        {outfit.trialDate && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDate(outfit.trialDate)}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shirt className="h-4 w-4" /> Ready for Delivery
          </h2>
          {deliveriesLoading ? (
            <Card className="animate-pulse"><CardContent className="h-20 pt-6" /></Card>
          ) : deliveries?.outfits?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No outfits ready for delivery
              </CardContent>
            </Card>
          ) : (
            deliveries?.outfits?.map((outfit: any) => (
              <Link key={outfit.id} href={`/dashboard/outfits/${outfit.id}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{outfit.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {outfit.order?.customer?.name}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge className="bg-green-100 text-green-700">Ready</Badge>
                        {outfit.deliveryDate && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDate(outfit.deliveryDate)}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
