"use client";

/**
 * InvoicePDF — React-PDF document for generating downloadable invoice PDFs.
 * Uses @react-pdf/renderer which renders entirely in the browser (no server needed).
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InvoicePDFData {
  invoiceNumber: string;
  issuedAt: string;
  order: {
    orderNumber: string;
    orderDate: string;
    trialDate?: string | null;
    deliveryDate?: string | null;
    notes?: string | null;
    customerName: string;
    customerMobile: string;
    customerEmail?: string | null;
    customerAddress?: string | null;
  };
  outfits: Array<{
    id: string;
    name: string;
    type: string;
    price?: string | number | null;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amount: string | number;
    createdAt: string;
    transactionRef?: string | null;
  }>;
  totalPaid: number;
  outfitTotal: number;
  balance: number;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    color: "#1a1a1a",
    backgroundColor: "#ffffff",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  brandName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: 8,
    color: "#888888",
    marginTop: 2,
  },
  invoiceMeta: {
    alignItems: "flex-end",
  },
  invoiceTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    letterSpacing: 1,
  },
  invoiceNumber: {
    fontSize: 9,
    color: "#555555",
    marginTop: 3,
  },
  invoiceDate: {
    fontSize: 9,
    color: "#888888",
    marginTop: 2,
  },

  // Divider
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    marginBottom: 20,
  },
  dividerDark: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#1a1a1a",
    marginBottom: 4,
  },

  // Bill To / Dates row
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  infoCol: {
    flex: 1,
  },
  infoColRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  label: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#888888",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  infoName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  infoText: {
    fontSize: 9,
    color: "#555555",
    marginTop: 2,
  },

  // Table
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e5e5",
    paddingVertical: 7,
    alignItems: "center",
  },
  tableRowLast: {
    flexDirection: "row",
    paddingVertical: 7,
    alignItems: "center",
  },
  colNo: { width: 28, fontSize: 9, color: "#888888" },
  colName: { flex: 1, fontSize: 9 },
  colType: { width: 110, fontSize: 9, color: "#555555" },
  colPrice: { width: 70, fontSize: 9, textAlign: "right" },
  colHeaderNo: { width: 28, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#555555" },
  colHeaderName: { flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#555555" },
  colHeaderType: { width: 110, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#555555" },
  colHeaderPrice: { width: 70, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#555555", textAlign: "right" },

  // Payments
  paymentSection: {
    marginTop: 16,
  },
  paymentSectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#888888",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f0f0f0",
  },
  paymentMethod: {
    fontSize: 9,
    color: "#555555",
  },
  paymentRef: {
    fontSize: 8,
    color: "#aaaaaa",
    marginTop: 1,
  },
  paymentAmount: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },

  // Totals
  totalsSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    paddingTop: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: 9,
    color: "#555555",
  },
  totalValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  totalPaidValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#16a34a",
  },
  balanceDue: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    backgroundColor: "#f9f9f9",
    padding: 8,
    borderRadius: 4,
  },
  balanceLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  balanceValueDue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#dc2626",
  },
  balanceValueClear: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#16a34a",
  },
  balanceValueOver: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#d97706",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: "#e5e5e5",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: "#aaaaaa",
  },
  footerNote: {
    fontSize: 7.5,
    color: "#aaaaaa",
    fontFamily: "Helvetica-Oblique",
    maxWidth: 240,
    textAlign: "right",
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtCurrency(val: string | number | null | undefined): string {
  if (!val && val !== 0) return "—";
  return `₹${Number(val).toLocaleString("en-IN")}`;
}

// ─── Document ────────────────────────────────────────────────────────────────

export function InvoicePDFDocument({ data }: { data: InvoicePDFData }) {
  const { invoiceNumber, issuedAt, order, outfits, payments, totalPaid, outfitTotal, balance } = data;

  const settledPayments = payments.filter((p: any) => !p.status || p.status === "SETTLED");

  return (
    <Document
      title={`Invoice ${invoiceNumber}`}
      author="urumi by mounika"
      subject={`Invoice for ${order.orderNumber}`}
    >
      <Page size="A4" style={S.page}>

        {/* ── Header ── */}
        <View style={S.header}>
          <View>
            <Text style={S.brandName}>urumi by mounika</Text>
            <Text style={S.brandTagline}>Custom Outfit Design &amp; Production</Text>
          </View>
          <View style={S.invoiceMeta}>
            <Text style={S.invoiceTitle}>INVOICE</Text>
            <Text style={S.invoiceNumber}>{invoiceNumber}</Text>
            <Text style={S.invoiceDate}>Issued: {fmt(issuedAt)}</Text>
          </View>
        </View>

        <View style={S.divider} />

        {/* ── Bill To / Dates ── */}
        <View style={S.infoRow}>
          <View style={S.infoCol}>
            <Text style={S.label}>Bill To</Text>
            <Text style={S.infoName}>{order.customerName}</Text>
            <Text style={S.infoText}>{order.customerMobile}</Text>
            {order.customerEmail ? <Text style={S.infoText}>{order.customerEmail}</Text> : null}
            {order.customerAddress ? <Text style={S.infoText}>{order.customerAddress}</Text> : null}
          </View>
          <View style={S.infoColRight}>
            <Text style={S.label}>Order Details</Text>
            <Text style={S.infoText}>Order: {order.orderNumber}</Text>
            <Text style={S.infoText}>Date: {fmt(order.orderDate)}</Text>
            {order.trialDate ? <Text style={S.infoText}>Trial: {fmt(order.trialDate)}</Text> : null}
            {order.deliveryDate ? <Text style={S.infoText}>Delivery: {fmt(order.deliveryDate)}</Text> : null}
          </View>
        </View>

        {/* ── Outfits Table ── */}
        <View style={S.tableHeader}>
          <Text style={S.colHeaderNo}>#</Text>
          <Text style={S.colHeaderName}>Item</Text>
          <Text style={S.colHeaderType}>Type</Text>
          <Text style={S.colHeaderPrice}>Price</Text>
        </View>
        {outfits.map((outfit, i) => (
          <View
            key={outfit.id}
            style={i === outfits.length - 1 ? S.tableRowLast : S.tableRow}
          >
            <Text style={S.colNo}>{i + 1}</Text>
            <Text style={S.colName}>{outfit.name}</Text>
            <Text style={S.colType}>{outfit.type}</Text>
            <Text style={S.colPrice}>{fmtCurrency(outfit.price)}</Text>
          </View>
        ))}

        {/* ── Payments ── */}
        {settledPayments.length > 0 && (
          <View style={S.paymentSection}>
            <Text style={S.paymentSectionTitle}>Payment History</Text>
            {settledPayments.map((p) => (
              <View key={p.id} style={S.paymentRow}>
                <View>
                  <Text style={S.paymentMethod}>{p.method} — {fmt(p.createdAt)}</Text>
                  {p.transactionRef ? (
                    <Text style={S.paymentRef}>Ref: {p.transactionRef}</Text>
                  ) : null}
                </View>
                <Text style={S.paymentAmount}>{fmtCurrency(p.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Totals ── */}
        <View style={S.totalsSection}>
          {outfitTotal > 0 && (
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>Subtotal</Text>
              <Text style={S.totalValue}>{fmtCurrency(outfitTotal)}</Text>
            </View>
          )}
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>Total Paid</Text>
            <Text style={S.totalPaidValue}>{fmtCurrency(totalPaid)}</Text>
          </View>
          <View style={S.balanceDue}>
            <Text style={S.balanceLabel}>
              {balance < 0 ? "Overpaid (Credit)" : "Balance Due"}
            </Text>
            <Text
              style={
                balance < 0
                  ? S.balanceValueOver
                  : balance === 0
                  ? S.balanceValueClear
                  : S.balanceValueDue
              }
            >
              {balance < 0
                ? `${fmtCurrency(Math.abs(balance))} credit`
                : fmtCurrency(balance)}
            </Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>urumi by mounika · Custom Outfit Studio</Text>
          {order.notes ? (
            <Text style={S.footerNote}>Note: {order.notes}</Text>
          ) : (
            <Text style={S.footerText}>Thank you for your order!</Text>
          )}
        </View>

      </Page>
    </Document>
  );
}
