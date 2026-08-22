"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shirt, Calendar } from "lucide-react";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";

export default function ConsultationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["consultations"],
    queryFn: async () => {
      const res = await fetch("/api/outfits?status=DRAFT&limit=50");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Consultations</h1>
        <p className="text-xs text-muted-foreground">New outfits awaiting design consultation</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-20 pt-6" /></Card>
          ))}
        </div>
      ) : data?.outfits?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No pending consultations
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data?.outfits?.map((outfit: any) => (
            <Link key={outfit.id} href={`/dashboard/outfits/${outfit.id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Shirt className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{outfit.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {outfit.order?.customer?.name} · {outfit.type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <Badge className={`text-[10px] ${getStatusColor(outfit.status)}`}>
                        {formatStatus(outfit.status)}
                      </Badge>
                      {outfit.deliveryDate && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                          <Calendar className="h-2.5 w-2.5" /> {formatDate(outfit.deliveryDate)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
