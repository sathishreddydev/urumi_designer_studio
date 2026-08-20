import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, orders, outfits, referenceImages, payments, customerMeasurements } from "@/lib/db/schema";
import { portalLimiter, getClientIp } from "@/lib/rate-limit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    // Rate limiting
    const ip = getClientIp(_request);
    const { allowed, resetMs } = portalLimiter.check(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(resetMs / 1000)) } }
      );
    }

    const { token } = await params;

    // Find customer by portal token
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.portalToken, token))
      .limit(1);

    if (!customer) {
      return NextResponse.json({ error: "Invalid portal link" }, { status: 404 });
    }

    // Get latest measurements
    const [latestMeasurement] = await db
      .select()
      .from(customerMeasurements)
      .where(eq(customerMeasurements.customerId, customer.id))
      .orderBy(desc(customerMeasurements.version))
      .limit(1);

    // Get all orders for this customer
    const customerOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customer.id));

    // Get outfits + locked references + payments per order
    const ordersWithDetails = await Promise.all(
      customerOrders.map(async (order) => {
        const orderOutfits = await db
          .select()
          .from(outfits)
          .where(eq(outfits.orderId, order.id));

        const outfitsForPortal = await Promise.all(
          orderOutfits.map(async (outfit) => {
            const refs = await db
              .select()
              .from(referenceImages)
              .where(eq(referenceImages.outfitId, outfit.id));
            // Show locked refs always; show all refs if outfit is still in design/approval phase
            const DESIGN_STATUSES = ["DRAFT", "DESIGN_IN_PROGRESS", "WAITING_FOR_REFERENCES", "WAITING_FOR_DEPENDENCIES"];
            const visibleRefs = DESIGN_STATUSES.includes(outfit.status)
              ? refs // Show all references during design phase for customer review
              : refs.filter((r) => r.status === "LOCKED" || r.isWorkPhoto === true); // After production: locked refs + completion photos

            return {
              id: outfit.id,
              name: outfit.name,
              type: outfit.type,
              status: outfit.status,
              price: outfit.price,
              deliveryDate: outfit.deliveryDate,
              trialDate: outfit.trialDate,
              maggamRequired: outfit.maggamRequired,
              // Garment-specific measurements — shown read-only so customer can verify
              // dimensions before production is locked in.
              garmentMeasurements: outfit.garmentMeasurements || null,
              references: visibleRefs.map((r) => ({
                id: r.id,
                type: r.type,
                url: r.url,
                filename: r.filename,
                // Any LOCKED ref shows as "approved" in the portal — whether locked by
                // admin, designer, or the customer themselves. The customer doesn't need
                // to know who locked it, just that it's confirmed for production.
                // DRAFT with a rejection note shows as "rejected" so the customer knows
                // the designer saw their feedback and reset it for re-review.
                customerFeedback: r.status === "LOCKED"
                  ? "approved"
                  : r.status === "DRAFT" && r.notes?.includes("Customer rejected")
                  ? "rejected"
                  : null,
              })),
            };
          })
        );

        const orderPayments = await db
          .select({ amount: payments.amount, method: payments.method, createdAt: payments.createdAt })
          .from(payments)
          .where(eq(payments.orderId, order.id));

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          orderDate: order.orderDate,
          deliveryDate: order.deliveryDate,
          trialDate: order.trialDate,
          estimatedAmount: order.estimatedAmount,
          advanceAmount: order.advanceAmount,
          status: order.status,
          outfits: outfitsForPortal,
          payments: orderPayments,
          totalPaid: orderPayments.reduce((sum, p) => sum + Number(p.amount), 0),
        };
      })
    );

    return NextResponse.json({
      customer: { name: customer.name },
      measurements: latestMeasurement ? latestMeasurement.values : null,
      orders: ordersWithDetails,
    });
  } catch (error) {
    console.error("Portal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
