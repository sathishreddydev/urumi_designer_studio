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
  "Active",
  "In Design",
  "Production Ready",
  "Waiting For Dependencies",
  "In Production",
  "Trial/QC",
  "Ready For Delivery",
  "Completed",
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
      {/* Header */}
      <div className="flex gap-3 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-xs text-muted-foreground">{data?.total || 0} total</p>
        </div>
        <Link href="/dashboard/orders/new">
          <Button className="w-full sm:w-auto" size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Order
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order number or customer..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[200px]">
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
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => { setSearch(""); setStatus(""); setPage(1); }}>
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
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {hasFilters ? "No orders match your filters" : "No orders found"}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-lg border overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Order</th>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium whitespace-nowrap">Estimated</th>
                  <th className="text-right px-4 py-3 font-medium whitespace-nowrap">Paid</th>
                  <th className="text-right px-4 py-3 font-medium whitespace-nowrap">Balance</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Delivery</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.orders.map((order: any) => {
                  const estimated = Number(order.estimatedAmount) || 0;
                  const paid = order.totalPaid || 0;
                  const balance = estimated - paid;
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => (window.location.href = `/dashboard/orders/${order.id}`)}
                    >
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{order.orderNumber}</td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <p className="text-xs truncate">{order.customerName}</p>
                        <p className="text-[10px] text-muted-foreground">{order.customerMobile}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`${getStatusColor(order.status)} whitespace-nowrap text-xs`}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                        {estimated > 0 ? `₹${estimated.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium whitespace-nowrap">
                        ₹{paid.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={balance > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                          {estimated > 0 ? `₹${Math.max(0, balance).toLocaleString("en-IN")}` : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDate(order.deliveryDate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden flex flex-col gap-3">
            {data.orders.map((order: any) => {
              const estimated = Number(order.estimatedAmount) || 0;
              const paid = order.totalPaid || 0;
              const balance = estimated - paid;
              return (
                <Link key={order.id} href={`/dashboard/orders/${order.id}`} className="block">
                  <div className="rounded-xl border bg-card shadow-sm p-4 active:scale-[0.99] transition-all hover:shadow-md">
                    {/* Top row: order number + status badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{order.orderNumber}</p>
                        <p className="text-xs text-muted-foreground truncate">{order.customerName}</p>
                      </div>
                      <Badge className={`${getStatusColor(order.status)} text-[10px] shrink-0 max-w-[120px] truncate`}>
                        {order.status}
                      </Badge>
                    </div>

                    {/* Bottom row: financials + delivery */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {estimated > 0 && (
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          Est: ₹{estimated.toLocaleString("en-IN")}
                        </span>
                      )}
                      {paid > 0 && (
                        <span className="text-[11px] text-green-600 font-medium whitespace-nowrap">
                          Paid: ₹{paid.toLocaleString("en-IN")}
                        </span>
                      )}
                      {estimated > 0 && balance > 0 && (
                        <span className="text-[11px] text-red-600 font-medium whitespace-nowrap">
                          Bal: ₹{balance.toLocaleString("en-IN")}
                        </span>
                      )}
                      {order.deliveryDate && (
                        <span className="text-[11px] text-muted-foreground ml-auto flex items-center gap-0.5 whitespace-nowrap">
                          <Calendar className="h-3 w-3 shrink-0" />
                          {formatDate(order.deliveryDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <Pagination page={page} total={data?.total || 0} limit={LIMIT} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
