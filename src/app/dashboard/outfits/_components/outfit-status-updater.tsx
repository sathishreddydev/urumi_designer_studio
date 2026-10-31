"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
  OutfitTransitionButtons,
  type OutfitTransition,
} from "@/components/outfit-transition-buttons";

interface OutfitStatusUpdaterProps {
  outfitId: string;
  listQueryKey: unknown[];
}

export function OutfitStatusUpdater({ outfitId, listQueryKey }: OutfitStatusUpdaterProps) {
  const queryClient = useQueryClient();
  const { data: transitions } = useQuery({
    queryKey: ["outfit-transitions", outfitId],
    queryFn: async () => {
      const response = await fetch(`/api/outfits/${outfitId}/transition`);
      if (!response.ok) return { availableTransitions: [] };
      return response.json();
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const response = await fetch(`/api/outfits/${outfitId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Transition failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outfit-transitions", outfitId] });
      queryClient.invalidateQueries({ queryKey: listQueryKey });
      toast({ title: "Status updated" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed", description: error.message });
    },
  });

  const available: OutfitTransition[] = transitions?.availableTransitions ?? [];

  return (
    <OutfitTransitionButtons
      transitions={available}
      onTransition={(status) => transitionMutation.mutate(status)}
      pendingStatus={transitionMutation.isPending ? transitionMutation.variables ?? null : null}
      responsive
      emptyPlaceholder={<span className="text-[11px] text-muted-foreground">—</span>}
    />
  );
}
