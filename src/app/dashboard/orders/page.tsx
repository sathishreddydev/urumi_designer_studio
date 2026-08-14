"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/pagination";
import { Plus, Search, Calendar, X } from "lucide-react";
import { formatDate, getStatusColor } from "@/lib/utils";
import Link from "next/link";

const ORDER_STATUSES = [
  "Active", "In Design", "Production Ready", "Waiting For Dependencies",
  "In Production", "Trial/QC", "Ready For Delivery", "Completed",
];
const LIMIT = 20;

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["orders", search, status, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status && status !== "all") params.set("status", status);
      params.set("page", String(page));
      params.set("limit", String(LIMIT));
      const res = await fetch(`/api/orders?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const hasFilters = search || status;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Orders</h1>
          <p className="text-sm text-muted-foreground">{data?.total || 0} total</p>
        </div>
        <Link href="/dashboard/orders/new">
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4" /> New Order
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order number..."
            className="pl-10"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="icon" onClick={() => { setSearch(""); setStatus(""); setPage(1); }}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : data?.orders?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {hasFilters ? "No orders match your filters" : "No orders found"}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Order</th>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Estimated</th>
                  <th className="text-right px-4 py-3 font-medium">Advance</th>
                  <th className="text-right px-4 py-3 font-medium">Paid</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Delivery</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.orders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => window.location.href = `/dashboard/orders/${order.id}`}>
                    <td className="px-4 py-3 font-medium">{order.orderNumber}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm">{order.customerName}</p>
                      <p className="text-xs text-muted-foreground">{order.customerMobile}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={order.estimatedAmount ? "font-medium" : "text-muted-foreground"}>
                        {order.estimatedAmount ? `₹${Number(order.estimatedAmount).toLocaleString("en-IN")}` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={order.advanceAmount ? "text-blue-600 font-medium" : "text-muted-foreground"}>
                        {order.advanceAmount ? `₹${Number(order.advanceAmount).toLocaleString("en-IN")}` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={order.totalPaid > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                        ₹{order.totalPaid?.toLocaleString("en-IN") || "0"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(order.orderDate)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(order.deliveryDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-2">
            {data.orders.map((order: any) => (
              <Link key={order.id} href={`/dashboard/orders/${order.id}`}>
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{order.orderNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.customerName} · {formatDate(order.orderDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className={`text-[10px] ${getStatusColor(order.status)}`}>{order.status}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[11px]">
                      {order.estimatedAmount && (
                        <span className="text-muted-foreground">Est: ₹{Number(order.estimatedAmount).toLocaleString("en-IN")}</span>
                      )}
                      {order.advanceAmount && (
                        <span className="text-blue-600">Adv: ₹{Number(order.advanceAmount).toLocaleString("en-IN")}</span>
                      )}
                      {order.totalPaid > 0 && (
                        <span className="text-green-600">Paid: ₹{order.totalPaid?.toLocaleString("en-IN")}</span>
                      )}
                      {order.deliveryDate && (
                        <span className="text-muted-foreground ml-auto flex items-center gap-0.5">
                          <Calendar className="h-2.5 w-2.5" /> {formatDate(order.deliveryDate)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <Pagination page={page} total={data?.total || 0} limit={LIMIT} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
