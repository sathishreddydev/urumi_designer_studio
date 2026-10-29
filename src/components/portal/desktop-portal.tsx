"use client";

import React from "react";
import { Search, Filter, Shirt, ShoppingBag, Clock, CheckCircle2, Ruler } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProfileMeasurements } from "@/components/portal/profile-measurements";
import { StatCard, DesktopOrderCard } from "@/components/portal/desktop-order-card";
import { formatStatus } from "@/lib/utils";

export function DesktopPortal({
  data,
  totalOutfits,
  inProd,
  delivered,
  filteredOrders,
  allOutfitStatuses,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  desktopView,
  setDesktopView,
  token,
}: {
  data: any;
  totalOutfits: number;
  inProd: number;
  delivered: number;
  filteredOrders: any[];
  allOutfitStatuses: string[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  desktopView: "orders" | "measurements";
  setDesktopView: (v: "orders" | "measurements") => void;
  token: string;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 sm:px-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card mt-6 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 max-w-lg">
            <h1 className="text-2xl font-bold tracking-tight">Welcome!</h1>
            <p className="text-sm font-medium text-foreground/80">
              Here&apos;s your custom outfit journey with us.
            </p>
            <p className="text-xs text-muted-foreground">
              From design to delivery, we&apos;ll keep you updated at every step.
            </p>
          </div>
          <div className="shrink-0 text-right space-y-0.5 hidden lg:block">
            <p className="text-sm italic text-muted-foreground">&ldquo;Custom outfits,</p>
            <p className="text-sm italic text-muted-foreground">crafted with care&rdquo;</p>
            <p className="text-xs font-semibold text-primary mt-1">— Urumi by Mounika</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-4 gap-3">
          <StatCard
            icon={<ShoppingBag className="h-5 w-5 text-primary" />}
            value={data.orders.length}
            label="Total Orders"
            sub="Your custom creations"
            color="bg-primary/10"
          />
          <StatCard
            icon={<Shirt className="h-5 w-5 text-blue-600" />}
            value={totalOutfits}
            label="Total Outfits"
            sub="Across all orders"
            color="bg-blue-50"
          />
          <StatCard
            icon={<Clock className="h-5 w-5 text-amber-600" />}
            value={inProd}
            label="In Production"
            sub="Making great progress"
            color="bg-amber-50"
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
            value={delivered}
            label="Delivered"
            sub="Ready to wear"
            color="bg-green-50"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 grid grid-cols-2 gap-0 rounded-xl overflow-hidden border bg-card shadow-sm">
        <button
          onClick={() => setDesktopView("orders")}
          className={`flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
            desktopView === "orders"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <ShoppingBag className="h-4 w-4" /> Orders
        </button>
        <button
          onClick={() => setDesktopView("measurements")}
          className={`flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
            desktopView === "measurements"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Ruler className="h-4 w-4" /> My Measurements
        </button>
      </div>

      {/* Measurements view */}
      {desktopView === "measurements" && (
        <div className="mt-5 rounded-2xl border bg-card p-6 shadow-sm">
          <ProfileMeasurements measurements={data.measurements} />
        </div>
      )}

      {/* Orders view */}
      {desktopView === "orders" && (
        <div className="mt-5 space-y-5">
          {/* Search & Filter */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search outfits by name or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 bg-background pl-9 text-sm rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 min-w-[160px] bg-background rounded-xl text-sm">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {allOutfitStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {formatStatus(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
              {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""} ·{" "}
              {filteredOrders.reduce((s: number, o: any) => s + o.outfits.length, 0)} outfits
            </span>
          </div>

          {filteredOrders.length === 0 && (
            <div className="rounded-2xl border border-dashed bg-card px-5 py-14 text-center text-sm text-muted-foreground">
              <Shirt className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
              <p className="font-medium">No matching outfits found</p>
              <p className="text-xs mt-1">
                Try clearing search terms or selecting a different status filter.
              </p>
            </div>
          )}

          {filteredOrders.map((order: any) => (
            <DesktopOrderCard key={order.id} order={order} token={token} />
          ))}
        </div>
      )}

      {/* Footer */}
      <p className="mt-10 text-center text-xs text-muted-foreground">
        Thank you for choosing Urumi by Mounika ❤️
        <br />
        <span className="italic">Custom outfits. Timeless stories.</span>
      </p>
    </main>
  );
}
