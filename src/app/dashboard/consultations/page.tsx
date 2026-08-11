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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Consultations</h1>
        <p className="text-muted-foreground">New outfits awaiting design consultation</p>
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
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Shirt className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold">{outfit.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {outfit.order?.customer?.name} · {outfit.type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge className={getStatusColor(outfit.status)}>
                        {formatStatus(outfit.status)}
                      </Badge>
                      {outfit.deliveryDate && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                          <Calendar className="h-3 w-3" /> {formatDate(outfit.deliveryDate)}
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
