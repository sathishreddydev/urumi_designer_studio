"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  Calendar,
  Shirt,
  MessageCircle,
  Pencil,
} from "lucide-react";

export default function CustomerDetailPage() {
  const params = useParams();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!customer) return <p className="text-muted-foreground">Customer not found</p>;

  const totalOrders = customer.orders?.length || 0;
  const totalOutfits = customer.orders?.reduce(
    (sum: number, o: any) => sum + (o.outfits?.length || 0), 0
  ) || 0;
  const totalPaid = customer.orders?.reduce(
    (sum: number, o: any) =>
      sum + (o.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0),
    0
  ) || 0;

  return (
    <div className="space-y-4">
      {/* Back */}
      <Link href="/dashboard/customers">
        <Button variant="ghost" size="sm" className="gap-1 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Customers
        </Button>
      </Link>

      {/* Customer Header Card */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: Name + Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold lg:text-2xl">{customer.name}</h1>
                <Link href={`/dashboard/customers/${customer.id}/edit`}>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                {customer.occasion && (
                  <Badge variant="outline">{customer.occasion}</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {customer.mobile}
                </span>
                {customer.whatsapp && (
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" /> {customer.whatsapp}
                  </span>
                )}
                {customer.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {customer.email}
                  </span>
                )}
                {customer.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {customer.address}
                  </span>
                )}
              </div>
              {customer.notes && (
                <p className="text-xs text-muted-foreground italic">{customer.notes}</p>
              )}
            </div>

            {/* Right: Stats */}
            <div className="flex gap-4 text-center">
              <div>
                <p className="text-lg font-bold">{totalOrders}</p>
                <p className="text-xs text-muted-foreground">Orders</p>
              </div>
              <div>
                <p className="text-lg font-bold">{totalOutfits}</p>
                <p className="text-xs text-muted-foreground">Outfits</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Order Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Orders</h2>
        <div className="flex gap-2">
          {customer.portalToken && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const url = `${window.location.origin}/portal/${customer.portalToken}`;
                const message = `Hi ${customer.name}! Track your outfit progress here: ${url}`;
                window.open(`https://wa.me/${customer.mobile?.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`, "_blank");
              }}
            >
              Share via WhatsApp
            </Button>
          )}
          <Link href={`/dashboard/orders/new?customerId=${customer.id}`}>
            <Button size="sm">
              <ShoppingBag className="h-3.5 w-3.5" /> New Order
            </Button>
          </Link>
        </div>
      </div>

      {/* Orders List */}
      {totalOrders === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Shirt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No orders yet</p>
            <Link href={`/dashboard/orders/new?customerId=${customer.id}`}>
              <Button size="sm" className="mt-3">Create First Order</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {customer.orders.map((order: any) => (
            <Link key={order.id} href={`/dashboard/orders/${order.id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="pt-4 pb-4">
                  {/* Order header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{order.orderNumber}</p>
                      <Badge variant="secondary" className="text-xs">{order.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(order.orderDate)}
                    </div>
                  </div>

                  {/* Outfits in this order */}
                  {order.outfits?.length > 0 ? (
                    <div className="space-y-1.5">
                      {order.outfits.map((outfit: any) => (
                        <div
                          key={outfit.id}
                          className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <Shirt className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{outfit.name}</span>
                            <span className="text-xs text-muted-foreground">· {outfit.type}</span>
                          </div>
                          <Badge className={`text-[10px] ${getStatusColor(outfit.status)}`}>
                            {formatStatus(outfit.status)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No outfits added</p>
                  )}

                  {/* Payment summary for this order */}
                  {order.payments?.length > 0 && (
                    <div className="mt-2 pt-2 border-t flex justify-between text-xs text-muted-foreground">
                      <span>{order.payments.length} payment(s)</span>
                      <span className="font-medium text-foreground">
                        ₹{order.payments.reduce((s: number, p: any) => s + Number(p.amount), 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
