"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Shirt,
  Search,
  Filter,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Ruler,
  Lock,
  Check,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
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
import { OutfitStatusBadge, ALL_OUTFIT_STATUSES, APPROVAL_ALLOWED_STATUSES } from "@/components/outfit-status-badge";
import { ProfileMeasurements } from "@/components/portal/profile-measurements";
import { PortalReferences, MobilePhotoStrip } from "@/components/portal/portal-reference-card";
import { PaymentHistoryDialog } from "@/components/portal/payment-history-dialog";
import { PortalUpload } from "@/components/portal/portal-upload";
import { fmtPrice, outfitTotals, orderTotals, MobileScreen, isCompletionVisible, outfitThumbnail } from "@/components/portal/portal-utils";
import { formatDate, formatStatus } from "@/lib/utils";

/* ── Mobile Stat Card ───────────────────────────────────── */
export function MobileStatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      {icon}
      <p className="text-lg font-bold tabular-nums leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground text-center leading-tight">{label}</p>
    </div>
  );
}

/* ── Mobile Section wrapper ─────────────────────────────── */
export function MobileSection({
  icon,
  title,
  subtitle,
  badge,
  onChevron,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  onChevron?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-semibold">{title}</p>
              {badge}
            </div>
            {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {onChevron && (
          <button onClick={onChevron} className="shrink-0 p-0.5">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

/* ── Approve All Button ─────────────────────────────────── */
export function ApproveAllButton({
  references,
  token,
  outfitId,
  action,
}: {
  references: any[];
  token: string;
  outfitId: string;
  action: "approved" | "rejected";
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleAll() {
    setLoading(true);
    setError("");
    const pending = references.filter((r: any) => !r.customerFeedback);
    let succeeded = true;
    for (const ref of pending) {
      try {
        const res = await fetch(`/api/portal/${token}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referenceId: ref.id, outfitId, feedback: action }),
        });
        if (!res.ok) succeeded = false;
      } catch {
        succeeded = false;
      }
    }
    if (succeeded) setDone(true);
    else setError("Some references could not be updated. Please try again.");
    setLoading(false);
  }

  if (done) return null;

  return (
    <div className="space-y-1.5">
      <button
        onClick={handleAll}
        disabled={loading}
        className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${action === "approved"
          ? "bg-green-600 hover:bg-green-700 text-white"
          : "border border-destructive text-destructive hover:bg-destructive/5"
          }`}
      >
        {action === "approved" ? (
          <ThumbsUp className="h-4 w-4" />
        ) : (
          <ThumbsDown className="h-4 w-4" />
        )}
        {loading ? "..." : action === "approved" ? "Approve" : "Request Changes"}
      </button>
      {error && <p role="alert" className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}

/* ── Mobile Outfit Progress ─────────────────────────────── */
export function MobileOutfitProgress({ status }: { status: string }) {
  const steps = ALL_OUTFIT_STATUSES;
  const currentIdx = steps.indexOf(status as any);

  return (
    <div className="px-4 py-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Outfit Journey
      </p>
      <div className="space-y-2">
        {steps.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isPending = idx > currentIdx;
          return (
            <div
              key={step}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${isCurrent
                ? "bg-primary/10 border border-primary/20"
                : isPending
                  ? "opacity-40"
                  : ""
                }`}
            >
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${isDone
                  ? "bg-green-100 text-green-700"
                  : isCurrent
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                  }`}
              >
                {isDone ? <Check className="h-3 w-3" /> : idx + 1}
              </div>
              <span
                className={`text-xs ${isCurrent
                  ? "font-semibold text-primary"
                  : "text-muted-foreground"
                  }`}
              >
                {formatStatus(step)}
              </span>
              {isCurrent && (
                <span className="ml-auto text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                  Current
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Mobile Order Detail (outfit thumb tabs + list) ─────── */
export function MobileOrderDetail({
  order,
  outfits,
  token,
  onBack,
  onOutfitTap,
}: {
  order: any;
  outfits: any[];
  token: string;
  onBack: () => void;
  onOutfitTap: (id: string) => void;
}) {
  const { displayTotal, paid, balance } = orderTotals(order);

  return (
    <div className="pb-8">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-background border-b px-4 py-2.5 flex items-start gap-3">
        <button onClick={onBack} className="p-1 -ml-1 rounded-lg hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Order #{order.orderNumber}</p>
          <p className="text-[11px] text-muted-foreground">
            Placed on {formatDate(order.orderDate ?? order.createdAt)}
          </p>
          <div className="grid grid-cols-4 items-end gap-2 mt-2">
            <div>
              <p className="text-[9px] text-muted-foreground">Total</p>
              <p className="text-[11px] font-semibold tabular-nums">{fmtPrice(displayTotal)}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">Paid</p>
              <p className="text-[11px] font-semibold tabular-nums text-green-600">{fmtPrice(paid)}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">Balance</p>
              <p className="text-[11px] font-semibold tabular-nums text-destructive">{fmtPrice(balance)}</p>
            </div>
            <PaymentHistoryDialog order={order} />
          </div>
        </div>
      </div>

      {/* Outfit tabs */}
      <div className="flex gap-3 px-4 py-3 overflow-x-auto no-scrollbar border-b">
        {outfits.map((outfit: any, idx: number) => {
          const coverRef = outfitThumbnail(outfit);
          return (
            <button
              key={outfit.id}
              onClick={() => onOutfitTap(outfit.id)}
              className="flex flex-col items-center gap-1.5 shrink-0 group"
            >
              <div className="h-20 w-20 rounded-xl overflow-hidden border-2 border-transparent group-hover:border-primary bg-muted flex items-center justify-center transition-all">
                {coverRef ? (
                  <img
                    src={coverRef.url}
                    alt={outfit.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Shirt className="h-7 w-7 text-muted-foreground/40" />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground text-center leading-tight max-w-[80px] line-clamp-1">
                {idx + 1}. {outfit.name}
              </p>
            </button>
          );
        })}
      </div>

      {/* Outfit list */}
      <div className="px-4 pt-4 space-y-3">
        {outfits.map((outfit: any) => {
          const coverRef = outfitThumbnail(outfit);
          const { total } = outfitTotals(outfit);
          return (
            <div
              key={outfit.id}
              className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3 cursor-pointer active:bg-muted/50"
              onClick={() => onOutfitTap(outfit.id)}
            >
              <div className="h-16 w-16 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                {coverRef ? (
                  <img
                    src={coverRef.url}
                    alt={outfit.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Shirt className="h-6 w-6 text-muted-foreground/30" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold truncate">{outfit.name}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
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
                <OutfitStatusBadge status={outfit.status} responsive={true} />
                {total > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Total Amount{" "}
                    <span className="font-semibold text-foreground">{fmtPrice(total)}</span>
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Mobile Outfit Detail (Overview / References / Uploads / Progress tabs) ── */
export function MobileOutfitDetail({
  order,
  outfit,
  token,
  onBack,
  onOutfitSwitch,
}: {
  order: any;
  outfit: any;
  token: string;
  onBack: () => void;
  onOutfitSwitch: (id: string) => void;
}) {
  const [tab, setTab] = useState<"overview" | "references" | "uploads" | "progress">("overview");
  const outfits: any[] = order.outfits || [];
  const { displayTotal, paid, balance } = orderTotals(order);

  const canApprove = APPROVAL_ALLOWED_STATUSES.includes(outfit.status as any);
  const designRefs = (outfit.references || []).filter(
    (r: any) => r.type !== "FABRIC" && r.type !== "COMPLETION"
  );
  const fabricRefs = (outfit.references || []).filter((r: any) => r.type === "FABRIC");
  const completionRefs = (outfit.references || []).filter((r: any) => r.type === "COMPLETION");
  const showCompletion =
    completionRefs.length > 0 && isCompletionVisible(outfit.status);

  const { price, total } = outfitTotals(outfit);
  const coverRef = outfitThumbnail(outfit);

  const TABS = [
    { key: "overview" as const, label: "Overview" },
    { key: "references" as const, label: "References" },
    { key: "uploads" as const, label: "Uploads" },
    // { key: "progress" as const, label: "Progress" },
  ];

  return (
    <div className="pb-8">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-background border-b px-4 py-2.5 flex items-start gap-3">
        <button onClick={onBack} className="p-1 -ml-1 rounded-lg hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Order #{order.orderNumber}</p>
          <p className="text-[11px] text-muted-foreground">
            Placed on {formatDate(order.orderDate ?? order.createdAt)}
          </p>
          <div className="grid grid-cols-4 items-end gap-2 mt-2">
            <div>
              <p className="text-[9px] text-muted-foreground">Total</p>
              <p className="text-[11px] font-semibold tabular-nums">{fmtPrice(displayTotal)}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">Paid</p>
              <p className="text-[11px] font-semibold tabular-nums text-green-600">{fmtPrice(paid)}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">Balance</p>
              <p className="text-[11px] font-semibold tabular-nums text-destructive">{fmtPrice(balance)}</p>
            </div>
            <PaymentHistoryDialog order={order} />
          </div>
        </div>
      </div>

      {/* Outfit switcher */}
      <div className="flex gap-2.5 px-4 py-3 overflow-x-auto no-scrollbar border-b">
        {outfits.map((o: any, idx: number) => {
          const cRef = outfitThumbnail(o);
          const isActive = o.id === outfit.id;
          return (
            <button
              key={o.id}
              onClick={() => onOutfitSwitch(o.id)}
              className="flex flex-col items-center gap-1 shrink-0"
            >
              <div
                className={`h-20 w-20 rounded-xl overflow-hidden border-2 transition-all bg-muted flex items-center justify-center ${isActive ? "border-primary" : "border-transparent"
                  }`}
              >
                {cRef ? (
                  <img src={cRef.url} alt={o.name} className="h-full w-full object-cover" />
                ) : (
                  <Shirt className="h-6 w-6 text-muted-foreground/30" />
                )}
              </div>
              <p
                className={`text-[10px] text-center leading-tight max-w-[80px] line-clamp-1 ${isActive ? "text-primary font-semibold" : "text-muted-foreground"
                  }`}
              >
                {idx + 1}. {o.name}
              </p>
            </button>
          );
        })}
      </div>

      {/* Current outfit header */}
      <div className="px-4 py-4 flex items-start gap-3 border-b">
        <div className="h-16 w-16 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
          {coverRef ? (
            <img src={coverRef.url} alt={outfit.name} className="h-full w-full object-cover" />
          ) : (
            <Shirt className="h-6 w-6 text-muted-foreground/30" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-base font-bold">{outfit.name}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
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
          <OutfitStatusBadge status={outfit.status} responsive={true} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${tab === t.key
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div className="px-4 py-4 space-y-4">
          {/* Price Summary */}
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-primary text-xs font-bold">₹</span>
                </div>
                <p className="text-sm font-semibold">Price Summary</p>
              </div>
              <Button variant="outline" size="sm" className="text-xs h-7 rounded-lg">
                View Quote <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <div className="px-4 py-3 space-y-2 text-sm">
              {price > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Outfit / Design</span>
                  <span className="font-medium tabular-nums">{fmtPrice(price)}</span>
                </div>
              )}
              {(outfit.addOns || []).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{a.name}</span>
                  <span className="font-medium tabular-nums">{fmtPrice(Number(a.price) || 0)}</span>
                </div>
              ))}
              {!price && !(outfit.addOns?.length) && (
                <p className="text-xs text-muted-foreground italic">Quotation pending</p>
              )}
            </div>
            {total > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-primary/[0.04]">
                <div>
                  <p className="text-sm font-bold">Total Amount</p>
                  <p className="text-[10px] text-muted-foreground">Including add-ons</p>
                </div>
                <span className="text-base font-bold tabular-nums">{fmtPrice(total)}</span>
              </div>
            )}
          </div>

          {/* Design References */}
          {designRefs.length > 0 && (
            <MobileSection
              icon={<span className="text-sm">🎨</span>}
              title="Design References"
              badge={
                canApprove ? (
                  <span className="text-[10px] text-amber-600 font-medium">(Requires Approval)</span>
                ) : undefined
              }
              onChevron={() => setTab("references")}
            >
              <MobilePhotoStrip
                references={designRefs}
                token={token}
                outfitId={outfit.id}
                canApprove={canApprove}
              />
              {canApprove && designRefs.some((r: any) => !r.customerFeedback) && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <ApproveAllButton
                    references={designRefs}
                    token={token}
                    outfitId={outfit.id}
                    action="approved"
                  />
                  <ApproveAllButton
                    references={designRefs}
                    token={token}
                    outfitId={outfit.id}
                    action="rejected"
                  />
                </div>
              )}
            </MobileSection>
          )}

          {/* Customer Material */}
          <MobileSection
            icon={<span className="text-sm">🧵</span>}
            title="Customer Fabric"
            onChevron={() => setTab("references")}
          >
            {fabricRefs.length > 0 ? (
              <MobilePhotoStrip
                references={fabricRefs}
                token={token}
                outfitId={outfit.id}
                canApprove={false}
              />
            ) : (
              <p className="text-xs text-muted-foreground">No customer fabric photos available.</p>
            )}
          </MobileSection>

          {/* Upload */}
          {canApprove && (
            <MobileSection
              icon={<span className="text-sm">📷</span>}
              title="Upload New Reference"
              subtitle="Share your ideas, photos or inspiration"
            >
              <PortalUpload
                outfitId={outfit.id}
                token={token}
                maggamRequired={outfit.maggamRequired}
              />
            </MobileSection>
          )}

          {/* Finished Outfit */}
          {showCompletion && (
            <MobileSection
              icon={<span className="text-sm">✅</span>}
              title="Finished Outfit"
              badge={
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                  <Check className="h-2.5 w-2.5" /> READY
                </span>
              }
              onChevron={() => setTab("references")}
            >
              <MobilePhotoStrip
                references={completionRefs}
                token={token}
                outfitId={outfit.id}
                canApprove={false}
              />
            </MobileSection>
          )}
        </div>
      )}

      {/* ── References ── */}
      {tab === "references" && (
        <div className="px-4 py-4 space-y-5">
          {designRefs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Design References{" "}
                {canApprove && (
                  <span className="text-amber-600 normal-case">(Requires Approval)</span>
                )}
              </p>
              <PortalReferences
                references={designRefs}
                token={token}
                outfitId={outfit.id}
                canApprove={canApprove}
              />
            </div>
          )}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Customer Fabric
            </p>
            {fabricRefs.length > 0 ? (
              <PortalReferences
                references={fabricRefs}
                token={token}
                outfitId={outfit.id}
                canApprove={false}
              />
            ) : (
              <p className="text-xs text-muted-foreground">No customer fabric photos available.</p>
            )}
          </div>
          {showCompletion && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                Finished Outfit
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 normal-case">
                  <Check className="h-2.5 w-2.5" /> READY
                </span>
              </p>
              <PortalReferences
                references={completionRefs}
                token={token}
                outfitId={outfit.id}
                canApprove={false}
              />
            </div>
          )}
          {designRefs.length === 0 && fabricRefs.length === 0 && completionRefs.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <p>No references uploaded yet.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Uploads ── */}
      {tab === "uploads" && (
        <div className="px-4 py-4">
          {canApprove ? (
            <PortalUpload
              outfitId={outfit.id}
              token={token}
              maggamRequired={outfit.maggamRequired}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
              <Lock className="h-7 w-7 text-muted-foreground/30" />
              <p>Uploads are locked once the outfit enters production.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Progress ── */}
      {tab === "progress" && <MobileOutfitProgress status={outfit.status} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MOBILE PORTAL — root component
══════════════════════════════════════════════════════════ */
export function MobilePortal({
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
  screen,
  setScreen,
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
  screen: MobileScreen;
  setScreen: (s: MobileScreen) => void;
  token: string;
}) {
  /* ── Orders / Measurements home ── */
  if (screen.view === "orders" || screen.view === "measurements") {
    return (
      <div className="pb-8">
        {/* Hero */}
        <div className="bg-gradient-to-br from-primary/10 via-card to-card px-4 pt-5 pb-4">
          <h1 className="text-xl font-bold">Welcome{data.customer?.name ? `, ${data.customer.name}` : ""}!</h1>
          <p className="text-sm text-foreground/80 mt-0.5">
            Here&apos;s your custom outfit journey with us.
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 italic">
            &ldquo;Custom outfits, crafted with care&rdquo;
          </p>
          <p className="text-[10px] font-semibold text-primary mt-0.5">— Urumi by Mounika</p>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <MobileStatCard
              icon={<ShoppingBag className="h-4 w-4 text-primary" />}
              value={data.orders.length}
              label="Orders"
            />
            <MobileStatCard
              icon={<Shirt className="h-4 w-4 text-blue-600" />}
              value={totalOutfits}
              label="Outfits"
            />
            <MobileStatCard
              icon={<Clock className="h-4 w-4 text-amber-600" />}
              value={inProd}
              label="In Production"
            />
            <MobileStatCard
              icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
              value={delivered}
              label="Delivered"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 border-b">
          <button
            onClick={() => setScreen({ view: "orders" })}
            className={`flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${screen.view !== "measurements"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
              }`}
          >
            <ShoppingBag className="h-4 w-4" /> Orders
          </button>
          <button
            onClick={() => setScreen({ view: "measurements" })}
            className={`flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${screen.view === "measurements"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
              }`}
          >
            <Ruler className="h-4 w-4" /> My Measurements
          </button>
        </div>

        {/* Measurements */}
        {screen.view === "measurements" && (
          <div className="px-4 py-5">
            <ProfileMeasurements measurements={data.measurements} />
          </div>
        )}

        {/* Orders list */}
        {screen.view === "orders" && (
          <div className="px-4 pt-4 space-y-4">
            <div className="flex gap-2 items-center">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search outfits..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 text-sm bg-background rounded-xl w-full"
                />
              </div>
              <div className="shrink-0">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 bg-background rounded-xl text-xs w-[120px]">
                    <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="all">All Statuses</SelectItem>
                    {allOutfitStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {formatStatus(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredOrders.length === 0 && (
              <div className="rounded-2xl border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
                <Shirt className="h-7 w-7 mx-auto mb-2 text-muted-foreground/40" />
                <p className="font-medium">No matching outfits</p>
              </div>
            )}

            {filteredOrders.map((order: any) => {
              const { displayTotal, paid, balance } = orderTotals(order);
              return (
                <div
                  key={order.id}
                  className="rounded-2xl border bg-card shadow-sm overflow-hidden cursor-pointer active:bg-muted/50"
                  onClick={() =>
                    order.outfits.length > 0
                      ? setScreen({
                        view: "outfit-detail",
                        orderId: order.id,
                        outfitId: order.outfits[0].id,
                      })
                      : setScreen({ view: "order-detail", orderId: order.id })
                  }
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold">Order #{order.orderNumber}</p>
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-semibold px-1.5">
                            {order.outfits.length} Outfit{order.outfits.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Placed on {formatDate(order.orderDate ?? order.createdAt)}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                  {displayTotal > 0 && (
                    <div className="px-4 pb-3 flex items-center justify-end gap-5 text-xs">
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">Total Amount</p>
                        <p className="font-semibold tabular-nums">{fmtPrice(displayTotal)}</p>
                      </div>
                      {paid > 0 && (
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">Paid Amount</p>
                          <p className="font-semibold tabular-nums text-green-600">{fmtPrice(paid)}</p>
                        </div>
                      )}
                      {balance > 0 && (
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">Balance</p>
                          <p className="font-semibold tabular-nums text-destructive">
                            {fmtPrice(balance)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground px-4">
          Thank you for choosing Urumi by Mounika ❤️
        </p>
      </div>
    );
  }

  /* ── Order detail screen ── */
  if (screen.view === "order-detail") {
    const order = data.orders.find((o: any) => o.id === screen.orderId);
    if (!order) return null;
    return (
      <MobileOrderDetail
        order={order}
        outfits={order.outfits || []}
        token={token}
        onBack={() => setScreen({ view: "orders" })}
        onOutfitTap={(outfitId) =>
          setScreen({ view: "outfit-detail", orderId: order.id, outfitId })
        }
      />
    );
  }

  /* ── Outfit detail screen ── */
  if (screen.view === "outfit-detail") {
    const order = data.orders.find((o: any) => o.id === screen.orderId);
    const outfit = (order?.outfits || []).find((f: any) => f.id === screen.outfitId);
    if (!order || !outfit) return null;
    return (
      <MobileOutfitDetail
        order={order}
        outfit={outfit}
        token={token}
        onBack={() => setScreen({ view: "orders" })}
        onOutfitSwitch={(outfitId) =>
          setScreen({ view: "outfit-detail", orderId: order.id, outfitId })
        }
      />
    );
  }

  return null;
}
