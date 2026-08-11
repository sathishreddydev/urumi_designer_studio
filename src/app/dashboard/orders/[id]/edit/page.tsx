"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingButton } from "@/components/ui/loading-button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function EditOrderPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: order } = useQuery({
    queryKey: ["order", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const [trialDate, setTrialDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (order) {
      setTrialDate(order.trialDate ? new Date(order.trialDate).toISOString().split("T")[0] : "");
      setDeliveryDate(order.deliveryDate ? new Date(order.deliveryDate).toISOString().split("T")[0] : "");
      setEstimatedAmount(order.estimatedAmount ? String(Number(order.estimatedAmount)) : "");
      setAdvanceAmount(order.advanceAmount ? String(Number(order.advanceAmount)) : "");
      setNotes(order.notes || "");
    }
  }, [order]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trialDate: trialDate || undefined,
          deliveryDate: deliveryDate || undefined,
          estimatedAmount: estimatedAmount ? Number(estimatedAmount) : undefined,
          advanceAmount: advanceAmount ? Number(advanceAmount) : undefined,
          notes,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", params.id] });
      router.push(`/dashboard/orders/${params.id}`);
    },
  });

  if (!order) {
    return <div className="h-8 w-48 animate-pulse rounded bg-muted" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/orders/${params.id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold lg:text-3xl">Edit Order</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Trial Date</Label>
              <Input type="date" value={trialDate} onChange={(e) => setTrialDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Delivery Date</Label>
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Estimated Amount (₹)</Label>
              <Input type="number" value={estimatedAmount} onChange={(e) => setEstimatedAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Advance Amount (₹)</Label>
              <Input type="number" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <Link href={`/dashboard/orders/${params.id}`}>
              <Button variant="outline" className="w-full">Cancel</Button>
            </Link>
            <LoadingButton onClick={() => updateMutation.mutate()} loading={updateMutation.isPending} loadingText="Saving...">
              Save Changes
            </LoadingButton>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
