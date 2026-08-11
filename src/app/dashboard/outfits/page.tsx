"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/pagination";
import { Shirt, Calendar, AlertTriangle, Search, X } from "lucide-react";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";

const ALL_STATUSES = [
  "DRAFT", "DESIGN_IN_PROGRESS", "WAITING_FOR_REFERENCES",
  "WAITING_FOR_DEPENDENCIES", "PRODUCTION_READY",
  "PATTERN_DRAFTING", "MAGGAM_WORK", "MAGGAM_REVIEW",
  "FABRIC_CUTTING", "STITCHING", "PRODUCTION_COMPLETED",
  "TRIAL", "ALTERATION", "QC", "READY_FOR_DELIVERY", "DELIVERED",
];

const LIMIT = 20;

export default function OutfitsPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["outfits", status, search, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", String(LIMIT));
      const res = await fetch(`/api/outfits?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const outfits = data?.outfits || [];
  const total = data?.total || 0;

  function clearFilters() {
    setStatus("");
    setSearch("");
    setPage(1);
  }

  const hasFilters = status || search;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Outfits</h1>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search outfit name..."
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
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{formatStatus(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : outfits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {hasFilters ? "No outfits match your filters" : "No outfits found"}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Outfit</th>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium">Order</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Designer</th>
                  <th className="text-left px-4 py-3 font-medium">Master</th>
                  <th className="text-left px-4 py-3 font-medium">Delivery</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {outfits.map((outfit: any) => {
                  const isBlocked = outfit.status === "WAITING_FOR_DEPENDENCIES";
                  const isUrgent = outfit.deliveryDate && new Date(outfit.deliveryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

                  return (
                    <tr key={outfit.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => window.location.href = `/dashboard/outfits/${outfit.id}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{outfit.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {outfit.type}{outfit.maggamRequired && " · M"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{outfit.customerName || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{outfit.orderNumber || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge className={getStatusColor(outfit.status)}>
                          {formatStatus(outfit.status)}
                        </Badge>
                        {isBlocked && <Badge variant="destructive" className="ml-1 text-[10px]">BLOCKED</Badge>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{outfit.designerName || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{outfit.masterName || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={isUrgent ? "text-red-600 font-medium text-xs" : "text-muted-foreground text-xs"}>
                          {formatDate(outfit.deliveryDate)}
                          {isUrgent && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-2">
            {outfits.map((outfit: any) => {
              const isBlocked = outfit.status === "WAITING_FOR_DEPENDENCIES";
              const isUrgent = outfit.deliveryDate && new Date(outfit.deliveryDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

              return (
                <Link key={outfit.id} href={`/dashboard/outfits/${outfit.id}`}>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Shirt className="h-3.5 w-3.5 text-primary shrink-0" />
                            <p className="font-medium text-sm truncate">{outfit.name}</p>
                          </div>
                          <p className="text-xs text-muted-foreground ml-5">
                            {outfit.customerName && `${outfit.customerName} · `}{outfit.type}{outfit.maggamRequired && " · Maggam"}
                          </p>
                          {outfit.orderNumber && (
                            <p className="text-[10px] text-muted-foreground ml-5">{outfit.orderNumber}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={`text-[10px] ${getStatusColor(outfit.status)}`}>
                            {formatStatus(outfit.status)}
                          </Badge>
                          {isBlocked && <Badge variant="destructive" className="text-[10px]">BLOCKED</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 ml-5">
                        {outfit.deliveryDate && (
                          <div className="flex items-center gap-1 text-xs">
                            <Calendar className="h-3 w-3" />
                            <span className={isUrgent ? "text-red-600 font-medium" : "text-muted-foreground"}>
                              {formatDate(outfit.deliveryDate)}
                            </span>
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground">
                          {outfit.masterName && `M: ${outfit.masterName}`}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          <Pagination page={page} total={total} limit={LIMIT} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
