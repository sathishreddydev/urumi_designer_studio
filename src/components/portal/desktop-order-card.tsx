"use client";

import React, { useState } from "react";
import { Calendar, Shirt, Upload, Check, Lock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OutfitStatusBadge, APPROVAL_ALLOWED_STATUSES } from "@/components/outfit-status-badge";
import { InlinePhotoStrip } from "@/components/portal/portal-reference-card";
import { DesktopUploadZone } from "@/components/portal/portal-upload";
import { fmtPrice, outfitTotals, orderTotals, isCompletionVisible, outfitThumbnail } from "@/components/portal/portal-utils";
import { formatDate } from "@/lib/utils";

/* ── Stat Card ──────────────────────────────────────────── */
export function StatCard({
  icon,
  value,
  label,
  sub,
  color,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  sub: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl ${color} px-4 py-3 flex items-center gap-3`}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-xl font-bold tabular-nums leading-none">{value}</p>
        <p className="text-xs font-semibold mt-0.5">{label}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

/* ── Desktop Order Card ─────────────────────────────────── */
export function DesktopOrderCard({ order, token }: { order: any; token: string }) {
  const [expanded, setExpanded] = useState(true);
  const { displayTotal, paid, balance } = orderTotals(order);

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* Order header */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold">Order #{order.orderNumber}</p>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold">
                {order.outfits.length} Outfit{order.outfits.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Placed on {formatDate(order.orderDate ?? order.createdAt)}
            </p>
          </div>
        </div>

        {/* Financial summary */}
        <div className="flex items-center gap-6 shrink-0">
          {displayTotal > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Total Amount</p>
              <p className="text-sm font-bold tabular-nums">{fmtPrice(displayTotal)}</p>
            </div>
          )}
          {paid > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Paid Amount</p>
              <p className="text-sm font-bold tabular-nums text-green-600">{fmtPrice(paid)}</p>
            </div>
          )}
          {balance > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Balance</p>
              <p className="text-sm font-bold tabular-nums text-destructive">{fmtPrice(balance)}</p>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 rounded-lg"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide Details" : "View Details"}
            <ChevronRight
              className={`h-3.5 w-3.5 ml-1 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Outfit rows */}
      {expanded && (
        <div>
          {order.outfits.map((outfit: any, idx: number) => (
            <DesktopOutfitRow
              key={outfit.id}
              outfit={outfit}
              token={token}
              isLast={idx === order.outfits.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Desktop Outfit Row ─────────────────────────────────── */
export function DesktopOutfitRow({
  outfit,
  token,
  isLast,
}: {
  outfit: any;
  token: string;
  isLast: boolean;
}) {
  const canApprove = APPROVAL_ALLOWED_STATUSES.includes(outfit.status as any);
  const designRefs = (outfit.references || []).filter(
    (r: any) => r.type !== "FABRIC" && r.type !== "COMPLETION"
  );
  const fabricRefs = (outfit.references || []).filter((r: any) => r.type === "FABRIC");
  const completionRefs = (outfit.references || []).filter((r: any) => r.type === "COMPLETION");
  const showCompletion =
    completionRefs.length > 0 && isCompletionVisible(outfit.status);

  const { price, total } = outfitTotals(outfit);
  const hasPrice = price > 0 || (outfit.addOns || []).length > 0;
  const coverRef = outfitThumbnail(outfit);

  return (
    <div className={`grid grid-cols-[90px_1fr_1fr_1fr] gap-0 ${!isLast ? "border-b" : ""}`}>
      {/* Cover image */}
      <div className="bg-muted flex items-center justify-center overflow-hidden">
        {coverRef ? (
          <img
            src={coverRef.url}
            alt={outfit.name}
            className="w-full h-full object-cover"
            style={{ minHeight: 80 }}
          />
        ) : (
          <Shirt className="h-8 w-8 text-muted-foreground/30" />
        )}
      </div>

      {/* Name + status */}
      <div className="px-4 py-4 flex flex-col justify-center gap-2 border-r">
        <div>
          <p className="text-sm font-bold leading-tight">{outfit.name}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="text-xs text-muted-foreground">{outfit.type}</span>
            {outfit.maggamRequired && (
              <Badge
                variant="secondary"
                className="text-[9px] px-1.5 py-0 bg-pink-100 text-pink-700 border-0"
              >
                Maggam Work
              </Badge>
            )}
          </div>
        </div>
        <OutfitStatusBadge status={outfit.status} responsive={false} />
      </div>

      {/* Price */}
      <div className="px-4 py-4 border-r flex flex-col justify-center">
        {!hasPrice ? (
          <p className="text-xs text-muted-foreground italic">Quotation pending</p>
        ) : (
          <div className="space-y-1.5 text-xs">
            {price > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Outfit / Design</span>
                <span className="font-medium tabular-nums">{fmtPrice(price)}</span>
              </div>
            )}
            {(outfit.addOns || []).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground truncate">{a.name}</span>
                <span className="font-medium tabular-nums shrink-0">
                  {fmtPrice(Number(a.price) || 0)}
                </span>
              </div>
            ))}
            <div className="border-t pt-1.5 flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold">Total Amount</p>
                <p className="text-[10px] text-muted-foreground">Including add-ons</p>
              </div>
              <span className="font-bold tabular-nums text-sm">{fmtPrice(total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* References */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {designRefs.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
              Design References
              {canApprove && <span className="text-amber-600">(Requires Approval)</span>}
              {!canApprove && <Lock className="h-2.5 w-2.5 text-muted-foreground" />}
            </p>
            <InlinePhotoStrip
              references={designRefs}
              token={token}
              outfitId={outfit.id}
              canApprove={canApprove}
            />
          </div>
        )}

        {fabricRefs.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground">Customer Material</p>
            <InlinePhotoStrip
              references={fabricRefs}
              token={token}
              outfitId={outfit.id}
              canApprove={false}
            />
          </div>
        )}

        {canApprove && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
              <Upload className="h-3 w-3" /> Upload New Reference
            </p>
            <DesktopUploadZone
              outfitId={outfit.id}
              token={token}
              maggamRequired={outfit.maggamRequired}
            />
          </div>
        )}

        {showCompletion && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
              Finished Outfit
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                <Check className="h-2.5 w-2.5" /> READY
              </span>
            </p>
            <InlinePhotoStrip
              references={completionRefs}
              token={token}
              outfitId={outfit.id}
              canApprove={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
