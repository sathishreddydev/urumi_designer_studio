// Shared types and pure helpers for the customer portal

export type MobileScreen =
  | { view: "orders" }
  | { view: "measurements" }
  | { view: "order-detail"; orderId: string }
  | { view: "outfit-detail"; orderId: string; outfitId: string };

export const fmtPrice = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function outfitTotals(outfit: any) {
  const price = Number(outfit.price) || 0;
  const addOns: any[] = outfit.addOns || [];
  const addOnsTotal = addOns.reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
  return { price, addOnsTotal, total: price + addOnsTotal };
}

export function orderTotals(order: any) {
  const liveTotal = (order.outfits || []).reduce((s: number, o: any) => {
    const { total } = outfitTotals(o);
    return s + total;
  }, 0);
  const displayTotal = liveTotal > 0 ? liveTotal : Number(order.estimatedAmount) || 0;
  const balance = displayTotal > 0 ? Math.max(0, displayTotal - (order.totalPaid || 0)) : 0;
  return { displayTotal, paid: order.totalPaid || 0, balance };
}

export function inProductionCount(orders: any[]) {
  return orders.reduce(
    (s: number, o: any) =>
      s +
      (o.outfits || []).filter((f: any) =>
        [
          "PATTERN_DRAFTING",
          "MAGGAM_WORK",
          "MAGGAM_REVIEW",
          "MAGGAM_REVIEWED",
          "FABRIC_CUTTING",
          "STITCHING",
          "PRODUCTION_COMPLETED",
        ].includes(f.status)
      ).length,
    0
  );
}

export function deliveredCount(orders: any[]) {
  return orders.reduce(
    (s: number, o: any) =>
      s + (o.outfits || []).filter((f: any) => f.status === "DELIVERED").length,
    0
  );
}

/** Reference types that trigger the completion-photo section */
export const COMPLETION_VISIBLE_STATUSES = [
  "PRODUCTION_COMPLETED",
  "TRIAL",
  "ALTERATION",
  "QC",
  "READY_FOR_DELIVERY",
  "DELIVERED",
] as const;

export type CompletionVisibleStatus = (typeof COMPLETION_VISIBLE_STATUSES)[number];

export function isCompletionVisible(status: string): boolean {
  return (COMPLETION_VISIBLE_STATUSES as readonly string[]).includes(status);
}

/** Prefer a visible finished-product photo, then the customer's material photo. */
export function outfitThumbnail(outfit: any) {
  const references: any[] = outfit.references || [];
  if (isCompletionVisible(outfit.status)) {
    const finishedPhoto = references.find((reference) => reference.type === "COMPLETION");
    if (finishedPhoto) return finishedPhoto;
  }
  return references.find((reference) => reference.type === "FABRIC") || null;
}
