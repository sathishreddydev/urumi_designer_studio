
"use client";

import Image from "next/image";
import Link from "next/link";
import {
    AlertTriangle,
    CalendarDays,
    ImageOff,
    Shirt,
    UserRound,
    Scissors,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getPriorityOption } from "@/components/outfit-form-fields";
import { OutfitStatusBadge } from "@/components/outfit-status-badge";
import { OutfitStatusUpdater } from "./outfit-status-updater";
import {
    isDeliveryUrgent,
    type OutfitListItem,
} from "./outfit-list-types";

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
                const priority =
                    outfit.priority > 0 ? getPriorityOption(outfit.priority) : null;

                return (
                    <article
                        key={outfit.id}
                        className="overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/20"
                    >
                        {/* Outfit Header */}
                        <div className="flex items-start gap-2.5 p-3.5">
                            <Link
                                href={getOutfitHref(outfit)}
                                className="flex min-w-0 flex-1 items-start gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <div
                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${outfit.maggamRequired
                                        ? "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300"
                                        : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                                        }`}
                                >
                                    {outfit.maggamRequired ? "M" : "S"}
                                </div>

                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                        <h2 className="truncate text-sm font-semibold">
                                            {outfit.name}
                                        </h2>

                                        {priority && (
                                            <span
                                                className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold leading-none ${priority.className}`}
                                            >
                                                {priority.label}
                                            </span>
                                        )}
                                    </div>

                                    <p className="truncate text-xs text-muted-foreground">
                                        {outfit.customerName}
                                    </p>

                                    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[10px] text-muted-foreground">
                                        {outfit.orderNumber && (
                                            <span>#{outfit.orderNumber}</span>
                                        )}

                                        {outfit.type && (
                                            <>
                                                {outfit.orderNumber && <span>·</span>}
                                                <span className="truncate">{outfit.type}</span>
                                            </>
                                        )}


                                    </div>
                                </div>
                            </Link>

                            {/* Status */}
                            <div className="flex max-w-[38%] shrink-0 flex-col items-end gap-1.5">
                                <OutfitStatusBadge
                                    status={outfit.status}
                                    className="max-w-full truncate text-[9px]"
                                />

                                {blocked && (
                                    <Badge
                                        variant="destructive"
                                        className="h-5 px-1.5 text-[9px]"
                                    >
                                        Blocked
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Outfit Details */}
                        <div className="mx-3.5 border-t" />

                        <div className="flex items-center gap-3 px-3.5 py-3">
                            {/* Material Image */}
                            <div className="shrink-0">
                                {outfit.customerMaterialImageUrl ? (
                                    <button
                                        type="button"
                                        aria-label={`View material images for ${outfit.name}`}
                                        onClick={() =>
                                            onOpenMaterial(outfit.customerMaterialImages)
                                        }
                                        className="relative block h-12 w-12 overflow-hidden rounded-lg border bg-muted transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <Image
                                            src={outfit.customerMaterialImageUrl}
                                            alt="Customer material"
                                            fill
                                            sizes="48px"
                                            className="object-cover"
                                        />

                                        {outfit.customerMaterialImages.length > 1 && (
                                            <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                                                +{outfit.customerMaterialImages.length - 1}
                                            </span>
                                        )}
                                    </button>
                                ) : (
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed bg-muted/40">
                                        <ImageOff className="h-4 w-4 text-muted-foreground/50" />
                                    </div>
                                )}
                            </div>

                            {/* Delivery & Assignment */}
                            <div className="min-w-0 flex-1 space-y-1.5">
                                {outfit.deliveryDate ? (
                                    <div
                                        className={`flex min-w-0 items-center gap-1.5 text-xs font-medium ${urgent
                                            ? "text-red-600 dark:text-red-400"
                                            : "text-muted-foreground"
                                            }`}
                                    >
                                        {urgent ? (
                                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                        ) : (
                                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                        )}

                                        <span className="truncate">
                                            Delivery: {formatDate(outfit.deliveryDate)}
                                        </span>

                                        {urgent && (
                                            <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold dark:bg-red-950/40">
                                                Urgent
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                        No delivery date
                                    </p>
                                )}

                                {(outfit.masterName || outfit.designerName) && (
                                    <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                                        {outfit.masterName ? (
                                            <>
                                                <Scissors className="h-3 w-3 shrink-0" />
                                                <span className="truncate">
                                                    Master: {outfit.masterName}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <UserRound className="h-3 w-3 shrink-0" />
                                                <span className="truncate">
                                                    Designer: {outfit.designerName}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Updater */}
                        {!isMaster && (
                            <>
                                <div className="mx-3.5 border-t" />

                                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                                        Update Status
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <OutfitStatusUpdater
                                            outfitId={outfit.id}
                                            listQueryKey={listQueryKey}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </article>
                );
            })}
        </div>
    );
}
