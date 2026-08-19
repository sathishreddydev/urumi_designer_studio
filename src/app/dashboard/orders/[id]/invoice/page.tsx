"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Download, Printer, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatDate, formatStatus, getStatusColor } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { InvoicePDFData } from "@/components/invoice-pdf";

// ─── PDF download helper ─────────────────────────────────────────────────────
// Loaded dynamically so @react-pdf/renderer never runs during SSR
async function downloadInvoicePDF(data: InvoicePDFData) {
  // Dynamic import to keep bundle lean and avoid SSR issues
  const { pdf } = await import("@react-pdf/renderer");
  const { InvoicePDFDocument } = await import("@/components/invoice-pdf");

  const blob = await pdf(<InvoicePDFDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.invoiceNumber}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ────────────────────────────────────────────────────────────────────

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

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orders/${params.id}/invoice`, { method: "POST" });
      if (res.status === 409) return null; // already exists — just refetch
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate invoice");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", params.id] });
      toast({ title: "Invoice generated", description: "Invoice has been created and saved." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Failed", description: err.message });
    },
  });

  const [isDownloading, setIsDownloading] = React.useState(false);

  async function handleDownload() {
    if (!data) return;
    setIsDownloading(true);
    try {
      const pdfData: InvoicePDFData = {
        invoiceNumber: data.invoice?.invoiceNumber ?? `INV-${data.order.orderNumber}`,
        issuedAt: data.invoice?.issuedAt ?? new Date().toISOString(),
        order: data.order,
        outfits: data.outfits,
        payments: data.payments,
        totalPaid: data.totalPaid,
        outfitTotal: data.outfitTotal,
        balance: data.balance,
      };
      await downloadInvoicePDF(pdfData);
    } catch (e) {
      toast({ variant: "destructive", title: "Download failed", description: (e as Error).message });
    } finally {
      setIsDownloading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-[600px] animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!data) return <p className="text-muted-foreground">Invoice not found</p>;

  const { order, outfits, payments, totalPaid, outfitTotal, balance, invoice } = data;
  const settledPayments = (payments || []).filter((p: any) => !p.status || p.status === "SETTLED");

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-12">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Link href={`/dashboard/orders/${params.id}`}>
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold flex items-center gap-2 truncate">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              Invoice
            </h1>
            {invoice && (
              <p className="text-xs text-muted-foreground truncate">
                {invoice.invoiceNumber} · Issued {formatDate(invoice.issuedAt)}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {!invoice ? (
            <Button
              size="sm"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="text-xs"
            >
              {generateMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Generate Invoice
            </Button>
          ) : (
            <Badge variant="outline" className="text-xs px-2 py-1 self-center">
              {invoice.status}
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
            className="text-xs"
          >
            {isDownloading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              : <Download className="h-3.5 w-3.5 mr-1" />}
            {isDownloading ? "Generating…" : "PDF"}
          </Button>

          <Button variant="outline" size="sm" onClick={() => window.print()} className="text-xs">
            <Printer className="h-3.5 w-3.5 mr-1" />
            Print
          </Button>
        </div>
      </div>

      {!invoice && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-400">
          This invoice hasn't been saved yet. Click <strong>Generate Invoice</strong> to lock it in — or use <strong>PDF</strong> / <strong>Print</strong> directly without saving.
        </div>
      )}

      {/* ── Printable Invoice ── */}
      <div id="invoice-content" className="print:m-0 print:p-0">
        <Card className="print:shadow-none print:border-none">
          <CardContent className="p-4 sm:p-8 lg:p-10 space-y-6 sm:space-y-8">

            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">urumi by mounika</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Custom Outfit Design &amp; Production</p>
              </div>
              <div className="sm:text-right">
                <p className="text-xl font-extrabold tracking-widest text-primary sm:text-2xl">INVOICE</p>
                {invoice ? (
                  <>
                    <p className="text-sm font-mono text-muted-foreground mt-1">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">Issued: {formatDate(invoice.issuedAt)}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">{order.orderNumber}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Bill To / Dates */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Bill To
                </p>
                <p className="font-semibold text-base">{order.customerName}</p>
                <p className="text-sm text-muted-foreground">{order.customerMobile}</p>
                {order.customerEmail && (
                  <p className="text-sm text-muted-foreground truncate">{order.customerEmail}</p>
                )}
                {order.customerAddress && (
                  <p className="text-sm text-muted-foreground">{order.customerAddress}</p>
                )}
              </div>
              <div className="sm:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Order Details
                </p>
                <p className="text-sm">Order: <span className="font-medium">{order.orderNumber}</span></p>
                <p className="text-sm text-muted-foreground">Date: {formatDate(order.orderDate)}</p>
                {order.trialDate && (
                  <p className="text-sm text-muted-foreground">Trial: {formatDate(order.trialDate)}</p>
                )}
                {order.deliveryDate && (
                  <p className="text-sm text-muted-foreground">Delivery: {formatDate(order.deliveryDate)}</p>
                )}
              </div>
            </div>

            {/* Outfits Table */}
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[320px]">
                <thead>
                  <tr className="border-b-2 border-foreground/20">
                    <th className="text-left py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground w-8">#</th>
                    <th className="text-left py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Item</th>
                    <th className="text-left py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Type</th>
                    <th className="text-left py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Status</th>
                    <th className="text-right py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {outfits.map((outfit: any, i: number) => (
                    <tr key={outfit.id} className="border-b border-border/50">
                      <td className="py-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-3 font-medium">
                        <p className="truncate max-w-[140px] sm:max-w-none">{outfit.name}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">{outfit.type}</p>
                      </td>
                      <td className="py-3 text-muted-foreground hidden sm:table-cell">{outfit.type}</td>
                      <td className="py-3 hidden sm:table-cell">
                        <Badge className={`text-[10px] ${getStatusColor(outfit.status)}`}>
                          {formatStatus(outfit.status)}
                        </Badge>
                      </td>
                      <td className="py-3 text-right font-medium whitespace-nowrap">
                        {outfit.price ? `₹${Number(outfit.price).toLocaleString()}` : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                  {/* Subtotal row */}
                  {outfitTotal > 0 && (
                    <tr className="border-t-2 border-foreground/20">
                      <td colSpan={4} className="pt-3 pb-1 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Subtotal
                      </td>
                      <td className="pt-3 pb-1 text-right font-bold whitespace-nowrap">
                        ₹{outfitTotal.toLocaleString()}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Payment History */}
            {settledPayments.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  Payment History
                </p>
                <div className="space-y-2">
                  {settledPayments.map((p: any) => (
                    <div key={p.id} className="flex items-start justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium">{p.method}</span>
                        <span className="text-muted-foreground"> — {formatDate(p.createdAt)}</span>
                        {p.transactionRef && (
                          <span className="text-xs text-muted-foreground ml-2 block sm:inline truncate">· Ref: {p.transactionRef}</span>
                        )}
                      </div>
                      <span className="font-semibold shrink-0">₹{Number(p.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="space-y-2">
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Paid</span>
                <span className="font-semibold text-green-600">₹{totalPaid.toLocaleString()}</span>
              </div>

              {/* Balance */}
              <div className={`flex justify-between items-center rounded-lg px-3 py-3 sm:px-4 gap-2 ${
                balance < 0
                  ? "bg-amber-50 dark:bg-amber-950/20"
                  : balance === 0
                  ? "bg-green-50 dark:bg-green-950/20"
                  : "bg-red-50 dark:bg-red-950/20"
              }`}>
                <span className="font-bold text-sm sm:text-base">
                  {balance < 0 ? "Overpaid (Credit Due)" : "Balance Due"}
                </span>
                <span className={`font-extrabold text-base sm:text-lg whitespace-nowrap ${
                  balance < 0
                    ? "text-amber-600"
                    : balance === 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}>
                  {balance < 0
                    ? `₹${Math.abs(balance).toLocaleString()}`
                    : `₹${balance.toLocaleString()}`}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t text-center space-y-1">
              <p className="text-sm font-medium">Thank you for choosing urumi by mounika!</p>
              {order.notes && (
                <p className="text-xs text-muted-foreground italic">Note: {order.notes}</p>
              )}
            </div>

          </CardContent>
        </Card>
      </div>

      {/* Print styles — only show the invoice card */}
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

// React import needed for JSX in downloadInvoicePDF
import React from "react";
