"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Shirt, ExternalLink, CalendarCheck, Package, Clock, AlertTriangle } from "lucide-react";
import { formatDate, getStatusColor } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

function dateLabel(date: string | Date | null | undefined): string {
  if (!date) return "No date set";
  const d = new Date(date);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isPast(d)) return `${Math.ceil((Date.now() - d.getTime()) / 86400000)}d overdue`;
  return format(d, "dd MMM yyyy");
}

function dateColor(date: string | Date | null | undefined): string {
  if (!date) return "text-muted-foreground";
  const d = new Date(date);
  if (isPast(d) && !isToday(d)) return "text-red-600 font-semibold";
  if (isToday(d)) return "text-amber-600 font-semibold";
  return "text-foreground";
}

// ─── Inline date setter ──────────────────────────────────────────────────────
function SetDateButton({
  outfitId,
  currentDate,
  field,
  label,
}: {
  outfitId: string;
  currentDate: string | null | undefined;
  field: "trialDate" | "deliveryDate";
  label: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(
    currentDate ? new Date(currentDate) : undefined
  );

  const mutation = useMutation({
    mutationFn: async (newDate: Date | undefined) => {
      const res = await fetch(`/api/outfits/${outfitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newDate?.toISOString() ?? null }),
      });
      if (!res.ok) throw new Error("Failed to update date");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments-trials"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-deliveries"] });
      toast({ title: `${label} updated` });
      setOpen(false);
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to update date" });
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
          <CalendarCheck className="h-3 w-3" />
          {date ? format(date, "dd MMM") : `Set ${label}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <CalendarPicker
          mode="single"
          selected={date}
          onSelect={(d) => setDate(d)}
          initialFocus
        />
        <div className="flex gap-2 p-3 border-t">
          <Button
            size="sm"
            className="flex-1 text-xs"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(date)}
          >
            {mutation.isPending ? "Saving..." : "Confirm"}
          </Button>
          {date && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={() => { setDate(undefined); mutation.mutate(undefined); }}
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Outfit appointment card ──────────────────────────────────────────────────
function AppointmentCard({
  outfit,
  dateField,
  dateLabel: dateLabelText,
}: {
  outfit: any;
  dateField: "trialDate" | "deliveryDate";
  dateLabel: string;
}) {
  const date = outfit[dateField];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Shirt className="h-3.5 w-3.5 text-primary shrink-0" />
              <p className="font-semibold text-sm truncate">{outfit.name}</p>
            </div>
            <p className="text-xs text-muted-foreground ml-5 truncate">
              {outfit.customerName}
              {outfit.orderNumber && ` · ${outfit.orderNumber}`}
            </p>
          </div>
          <Badge className={`${getStatusColor(outfit.status)} text-[10px] shrink-0`}>
            {outfit.status === "TRIAL" ? "Trial" : "Ready"}
          </Badge>
        </div>

        {/* Date row */}
        <div className="flex items-center justify-between gap-2 ml-5">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className={`text-xs ${dateColor(date)}`}>
              {date ? dateLabel(date) : (
                <span className="text-muted-foreground italic text-[11px]">No {dateLabelText} set</span>
              )}
            </span>
            {date && isPast(new Date(date)) && !isToday(new Date(date)) && (
              <AlertTriangle className="h-3 w-3 text-red-500" />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <SetDateButton
              outfitId={outfit.id}
              currentDate={date}
              field={dateField}
              label={dateLabelText}
            />
            <Link href={`/dashboard/outfits/${outfit.id}`}>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function AppointmentsPage() {
  const { data: trials, isLoading: trialsLoading } = useQuery({
    queryKey: ["appointments-trials"],
    queryFn: async () => {
      const res = await fetch("/api/outfits?status=TRIAL&limit=100");
      if (!res.ok) throw new Error("Failed to fetch");
      const d = await res.json();
      return d.outfits || [];
    },
  });

  const { data: deliveries, isLoading: deliveriesLoading } = useQuery({
    queryKey: ["appointments-deliveries"],
    queryFn: async () => {
      const res = await fetch("/api/outfits?status=READY_FOR_DELIVERY&limit=100");
      if (!res.ok) throw new Error("Failed to fetch");
      const d = await res.json();
      return d.outfits || [];
    },
  });

  const trialsCount = trials?.length ?? 0;
  const deliveriesCount = deliveries?.length ?? 0;

  // Sort: overdue first, then by date asc, then undated last
  function sortByDate(list: any[], field: string) {
    return [...(list ?? [])].sort((a, b) => {
      if (!a[field] && !b[field]) return 0;
      if (!a[field]) return 1;
      if (!b[field]) return -1;
      return new Date(a[field]).getTime() - new Date(b[field]).getTime();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Appointments</h1>
        <p className="text-xs text-muted-foreground">
          Schedule trials and deliveries · {trialsCount + deliveriesCount} pending
        </p>
      </div>

      <Tabs defaultValue="trials">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="trials" className="flex-1 sm:flex-none gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Trials
            {trialsCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{trialsCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="deliveries" className="flex-1 sm:flex-none gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Deliveries
            {deliveriesCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{deliveriesCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Trials tab */}
        <TabsContent value="trials" className="mt-4">
          {trialsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : trialsCount === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No outfits in trial stage
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {/* Summary: no date set */}
              {trials.filter((o: any) => !o.trialDate).length > 0 && (
                <div className="text-xs text-amber-600 flex items-center gap-1 mb-1">
                  <AlertTriangle className="h-3 w-3" />
                  {trials.filter((o: any) => !o.trialDate).length} trial(s) have no date set — tap "Set Trial Date" to schedule.
                </div>
              )}
              {sortByDate(trials, "trialDate").map((outfit: any) => (
                <AppointmentCard
                  key={outfit.id}
                  outfit={outfit}
                  dateField="trialDate"
                  dateLabel="Trial Date"
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Deliveries tab */}
        <TabsContent value="deliveries" className="mt-4">
          {deliveriesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : deliveriesCount === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No outfits ready for delivery
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {trials && deliveries.filter((o: any) => !o.deliveryDate).length > 0 && (
                <div className="text-xs text-amber-600 flex items-center gap-1 mb-1">
                  <AlertTriangle className="h-3 w-3" />
                  {deliveries.filter((o: any) => !o.deliveryDate).length} outfit(s) have no delivery date.
                </div>
              )}
              {sortByDate(deliveries, "deliveryDate").map((outfit: any) => (
                <AppointmentCard
                  key={outfit.id}
                  outfit={outfit}
                  dateField="deliveryDate"
                  dateLabel="Delivery Date"
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
