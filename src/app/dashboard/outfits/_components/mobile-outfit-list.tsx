"use client";

import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, CalendarDays, ImageOff, Shirt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getPriorityOption } from "@/components/outfit-form-fields";
import { OutfitStatusBadge } from "@/components/outfit-status-badge";
import { OutfitStatusUpdater } from "./outfit-status-updater";
import { isDeliveryUrgent, type OutfitListItem } from "./outfit-list-types";

interface MobileOutfitListProps {
  outfits: OutfitListItem[];
  isMaster: boolean;
  listQueryKey: unknown[];
  getOutfitHref: (outfit: OutfitListItem) => string;
  onOpenMaterial: (images: OutfitListItem["customerMaterialImages"]) => void;
}

export function MobileOutfitList({
  outfits,
  isMaster,
  listQueryKey,
  getOutfitHref,
  onOpenMaterial,
}: MobileOutfitListProps) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {outfits.map((outfit) => {
        const blocked = outfit.status === "WAITING_FOR_DEPENDENCIES";
        const urgent = isDeliveryUrgent(outfit.deliveryDate);

        return (
          <article
            key={outfit.id}
            className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <Link href={getOutfitHref(outfit)} className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex items-center gap-2">
                  <Shirt className="h-4 w-4 shrink-0 text-primary" />
                  <h2 className="truncate text-sm font-semibold">{outfit.name}</h2>
                  {outfit.priority > 0 && (() => {
                    const priority = getPriorityOption(outfit.priority);
                    return (
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priority.className}`}>
                        {priority.label}
                      </span>
                    );
                  })()}
                </div>
                <p className="mt-1 truncate pl-6 text-xs text-muted-foreground">
                  {[outfit.customerName, outfit.type, outfit.maggamRequired ? "Maggam" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {outfit.orderNumber && (
                  <p className="mt-1 pl-6 text-[11px] text-muted-foreground">Order {outfit.orderNumber}</p>
                )}
              </Link>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <OutfitStatusBadge status={outfit.status} className="max-w-[120px] truncate text-[10px]" />
                {blocked && <Badge variant="destructive" className="text-[10px]">Blocked</Badge>}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 border-t pt-3">
              <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
                {outfit.customerMaterialImageUrl ? (
                  <button
                    type="button"
                    aria-label={`View material images for ${outfit.name}`}
                    onClick={() => onOpenMaterial(outfit.customerMaterialImages)}
                    className="relative block h-11 w-11 overflow-hidden rounded-md border bg-muted transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Image
                      src={outfit.customerMaterialImageUrl}
                      alt="Customer material"
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                    {outfit.customerMaterialImages.length > 1 && (
                      <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 text-[9px] font-bold leading-4 text-white">
                        {outfit.customerMaterialImages.length}
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-md border border-dashed bg-muted/40">
                    <ImageOff className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                {outfit.deliveryDate && (
                  <p className={`flex items-center gap-1 text-xs ${urgent ? "font-medium text-red-600" : "text-muted-foreground"}`}>
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    {formatDate(outfit.deliveryDate)}
                    {urgent && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                  </p>
                )}
                {(outfit.masterName || outfit.designerName) && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {outfit.masterName ? `Master: ${outfit.masterName}` : `Designer: ${outfit.designerName}`}
                  </p>
                )}
              </div>
            </div>

            {!isMaster && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <span className="shrink-0 text-xs font-medium text-muted-foreground">Move to</span>
                <OutfitStatusUpdater outfitId={outfit.id} listQueryKey={listQueryKey} />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
