"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Download, Printer } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default function InvoicePage() {
  const params = useParams();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["invoice", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${params.id}/invoice`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const createInvoice = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orders/${params.id}/invoice`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to create invoice");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoice", params.id] }),
  });

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted" />;
  }

  if (!data) return <p>Invoice not found</p>;

  const { order, outfits, payments, totalPaid, balance, invoice } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/orders/${params.id}`}>
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold">Invoice</h1>
        </div>
        <div className="flex gap-2">
          {!invoice && (
            <Button variant="secondary" size="sm" onClick={() => createInvoice.mutate()} disabled={createInvoice.isPending}>
              Generate Invoice
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {/* Invoice Card — printable area */}
      <div id="invoice-content" className="print:m-0 print:p-0">
        <Card className="max-w-2xl mx-auto print:shadow-none print:border-none">
          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold">urumi by mounika</h2>
                <p className="text-xs text-muted-foreground">Custom Outfit Design & Production</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">INVOICE</p>
                <p className="text-sm text-muted-foreground">{order.orderNumber}</p>
                <p className="text-xs text-muted-foreground">{formatDate(order.orderDate)}</p>
              </div>
            </div>

            <hr />

            {/* Customer Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Bill To</p>
                <p className="font-semibold">{order.customerName}</p>
                <p className="text-sm text-muted-foreground">{order.customerMobile}</p>
                {order.customerEmail && (
                  <p className="text-sm text-muted-foreground">{order.customerEmail}</p>
                )}
                {order.customerAddress && (
                  <p className="text-sm text-muted-foreground">{order.customerAddress}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground font-medium">Dates</p>
                {order.trialDate && (
                  <p className="text-sm">Trial: {formatDate(order.trialDate)}</p>
                )}
                {order.deliveryDate && (
                  <p className="text-sm">Delivery: {formatDate(order.deliveryDate)}</p>
                )}
              </div>
            </div>

            {/* Outfits Table */}
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">#</th>
                    <th className="text-left py-2 font-medium">Outfit</th>
                    <th className="text-left py-2 font-medium">Type</th>
                    <th className="text-right py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {outfits.map((outfit: any, i: number) => (
                    <tr key={outfit.id} className="border-b">
                      <td className="py-2">{i + 1}</td>
                      <td className="py-2 font-medium">{outfit.name}</td>
                      <td className="py-2 text-muted-foreground">{outfit.type}</td>
                      <td className="py-2 text-right text-xs">{outfit.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Payment Summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Estimated Amount</span>
                <span className="font-medium">
                  {order.estimatedAmount ? `₹${Number(order.estimatedAmount).toLocaleString()}` : "—"}
                </span>
              </div>
              {order.advanceAmount && (
                <div className="flex justify-between text-sm">
                  <span>Advance Paid</span>
                  <span>₹{Number(order.advanceAmount).toLocaleString()}</span>
                </div>
              )}
              <hr />
              {payments.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground">Payments</p>
                  {payments.map((p: any) => (
                    <div key={p.id} className="flex justify-between text-sm text-muted-foreground">
                      <span>{p.method} — {formatDate(p.createdAt)}</span>
                      <span>₹{Number(p.amount).toLocaleString()}</span>
                    </div>
                  ))}
                  <hr />
                </>
              )}
              <div className="flex justify-between text-sm font-semibold">
                <span>Total Paid</span>
                <span className="text-green-600">₹{totalPaid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>Balance Due</span>
                <span className={balance > 0 ? "text-red-600" : "text-green-600"}>
                  ₹{balance.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t text-center">
              <p className="text-xs text-muted-foreground">
                Thank you for choosing urumi by mounika!
              </p>
              {order.notes && (
                <p className="text-xs text-muted-foreground mt-1 italic">Note: {order.notes}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-content, #invoice-content * { visibility: visible; }
          #invoice-content { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
