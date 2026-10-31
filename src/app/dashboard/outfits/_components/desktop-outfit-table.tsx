"use client";

import Image from "next/image";
import { AlertTriangle, ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getPriorityOption } from "@/components/outfit-form-fields";
import { OutfitStatusBadge } from "@/components/outfit-status-badge";
import { OutfitStatusUpdater } from "./outfit-status-updater";
import { isDeliveryUrgent, type OutfitListItem } from "./outfit-list-types";

interface DesktopOutfitTableProps {
  outfits: OutfitListItem[];
  isMaster: boolean;
  listQueryKey: unknown[];
  onSelectOutfit: (outfit: OutfitListItem) => void;
  onOpenMaterial: (images: OutfitListItem["customerMaterialImages"]) => void;
}

export function DesktopOutfitTable({
  outfits,
  isMaster,
  listQueryKey,
  onSelectOutfit,
  onOpenMaterial,
}: DesktopOutfitTableProps) {
  return (
    <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Outfit</th>
            <th className="px-4 py-3 text-left font-semibold">Customer</th>
            <th className="px-4 py-3 text-left font-semibold">Status</th>
            <th className="px-4 py-3 text-left font-semibold">Material</th>
            <th className="px-4 py-3 text-left font-semibold">Designer</th>
            <th className="px-4 py-3 text-left font-semibold">Master</th>
            <th className="px-4 py-3 text-left font-semibold">Delivery</th>
            {!isMaster && <th className="px-4 py-3 text-left font-semibold">Update Status</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {outfits.map((outfit) => {
            const blocked = outfit.status === "WAITING_FOR_DEPENDENCIES";
            const urgent = isDeliveryUrgent(outfit.deliveryDate);

            return (
              <tr
                key={outfit.id}
                role="link"
                tabIndex={0}
                className="cursor-pointer transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => onSelectOutfit(outfit)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectOutfit(outfit);
                  }
                }}
              >
                <td className="max-w-[200px] px-4 py-3">
                  <p className="truncate font-medium">{outfit.name}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="truncate text-xs text-muted-foreground">
                      {outfit.type}{outfit.maggamRequired && " · Maggam"}
                    </span>
                    {outfit.priority > 0 && (() => {
                      const priority = getPriorityOption(outfit.priority);
                      return (
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priority.className}`}>
                          {priority.label}
                        </span>
                      );
                    })()}
                  </div>
                </td>
                <td className="max-w-[160px] truncate px-4 py-3 text-muted-foreground">
                  {outfit.customerName || "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <OutfitStatusBadge status={outfit.status} className="text-[10px]" />
                    {blocked && <Badge variant="destructive" className="text-[10px]">Blocked</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
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
                </td>
                <td className="max-w-[140px] truncate px-4 py-3 text-muted-foreground">
                  {outfit.designerName || "—"}
                </td>
                <td className="max-w-[140px] truncate px-4 py-3 text-muted-foreground">
                  {outfit.masterName || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={urgent ? "font-medium text-red-600" : "text-muted-foreground"}>
                    {formatDate(outfit.deliveryDate)}
                    {urgent && <AlertTriangle className="ml-1 inline h-3.5 w-3.5" />}
                  </span>
                </td>
                {!isMaster && (
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <OutfitStatusUpdater outfitId={outfit.id} listQueryKey={listQueryKey} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
