"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { InvoicePDFData } from "@/components/invoice-pdf";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fmtPrice, orderTotals } from "@/components/portal/portal-utils";
import { formatDate } from "@/lib/utils";

export function PaymentHistoryDialog({ order }: { order: any }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const payments = [...(order.payments || [])].sort(
    (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  async function handleDownloadInvoice() {
    setIsDownloading(true);
    setDownloadError("");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { InvoicePDFDocument } = await import("@/components/invoice-pdf");
      const { displayTotal, balance } = orderTotals(order);
      const data: InvoicePDFData = {
        invoiceNumber: order.invoice?.invoiceNumber || `INV-${order.orderNumber}`,
        issuedAt: order.invoice?.issuedAt || new Date().toISOString(),
        order: {
          orderNumber: order.orderNumber,
          orderDate: order.orderDate || order.createdAt,
          trialDate: order.trialDate,
          deliveryDate: order.deliveryDate,
          notes: order.notes,
          customerName: order.customerName || "Customer",
          customerMobile: order.customerMobile || "No phone",
          customerEmail: order.customerEmail,
          customerAddress: order.customerAddress,
        },
        outfits: (order.outfits || []).map((outfit: any) => ({
          id: outfit.id,
          name: outfit.name,
          type: outfit.type,
          price: outfit.price,
          addOns: outfit.addOns || [],
        })),
        payments: payments.map((payment: any) => ({
          id: payment.id,
          method: payment.method,
          amount: payment.amount,
          createdAt: payment.createdAt,
          transactionRef: payment.transactionRef,
        })),
        totalPaid: Number(order.totalPaid) || 0,
        outfitTotal: displayTotal,
        balance,
      };

      const blob = await pdf(<InvoicePDFDocument data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${data.invoiceNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Could not download invoice.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="mt-1 text-[10px] font-semibold text-primary underline underline-offset-2">
          Payment History
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Payment History</DialogTitle>
          <DialogDescription>Payments recorded for Order #{order.orderNumber}</DialogDescription>
        </DialogHeader>
        {payments.length > 0 ? (
          <div className="space-y-2">
            {payments.map((payment: any) => (
              <div
                key={payment.id}
                className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
              >
                <div>
                  <p className="text-xs font-semibold">{String(payment.method).replaceAll("_", " ")}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(payment.createdAt)}</p>
                </div>
                <p className="text-sm font-bold tabular-nums text-green-600">
                  {fmtPrice(Number(payment.amount) || 0)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">
            No payments recorded yet.
          </p>
        )}
        <Button className="w-full" onClick={handleDownloadInvoice} disabled={isDownloading}>
          {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {isDownloading ? "Preparing invoice…" : "Download Invoice"}
        </Button>
        {downloadError && <p role="alert" className="text-xs text-destructive">{downloadError}</p>}
      </DialogContent>
    </Dialog>
  );
}
