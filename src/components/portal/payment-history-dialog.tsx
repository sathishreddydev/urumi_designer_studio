
"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { InvoicePDFData } from "@/components/invoice-pdf";
import { orderTotals } from "@/components/portal/portal-utils";

export function PaymentHistoryDialog({ order }: { order: any }) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState("");

    const payments = [...(order.payments || [])].sort(
        (a: any, b: any) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
    );

    async function handleDownloadInvoice() {
        if (isDownloading) return;

        setIsDownloading(true);
        setDownloadError("");

        let url: string | undefined;

        try {
            const { pdf } = await import("@react-pdf/renderer");
            const { InvoicePDFDocument } = await import(
                "@/components/invoice-pdf"
            );

            const { displayTotal, balance } = orderTotals(order);

            const data: InvoicePDFData = {
                invoiceNumber:
                    order.invoice?.invoiceNumber ||
                    `INV-${order.orderNumber}`,
                issuedAt:
                    order.invoice?.issuedAt ||
                    new Date().toISOString(),

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

            const blob = await pdf(
                <InvoicePDFDocument data={data} />
            ).toBlob();

            url = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.download = `${data.invoiceNumber}.pdf`;

            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Invoice download failed:", error);

            setDownloadError(
                error instanceof Error
                    ? error.message
                    : "Could not download invoice. Please try again."
            );
        } finally {
            if (url) {
                const objectUrl = url;
                window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            }

            setIsDownloading(false);
        }
    }

    return (
        <div className="space-y-2 text-right">
            <a
                href="#download-invoice"
                aria-disabled={isDownloading}
                onClick={(event) => {
                    event.preventDefault();
                    if (!isDownloading) void handleDownloadInvoice();
                }}
                className={`inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline ${isDownloading ? "pointer-events-none opacity-60" : ""}`}
            >
                {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Download className="h-4 w-4" />
                )}

                {isDownloading
                    ? "Preparing invoice..."
                    : "Invoice"}
            </a>

            {downloadError && (
                <p
                    role="alert"
                    className="text-sm text-destructive"
                >
                    {downloadError}
                </p>
            )}
        </div>
    );
}
