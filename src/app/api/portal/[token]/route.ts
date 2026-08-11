import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, orders, outfits, referenceImages, payments } from "@/lib/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
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
            const locked = refs.filter((r) => r.status === "LOCKED");

            return {
              id: outfit.id,
              name: outfit.name,
              type: outfit.type,
              status: outfit.status,
              deliveryDate: outfit.deliveryDate,
              trialDate: outfit.trialDate,
              maggamRequired: outfit.maggamRequired,
              references: locked.map((r) => ({ id: r.id, type: r.type, url: r.url })),
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
          status: order.status,
          outfits: outfitsForPortal,
          payments: orderPayments,
          totalPaid: orderPayments.reduce((sum, p) => sum + Number(p.amount), 0),
        };
      })
    );

    return NextResponse.json({
      customer: { name: customer.name },
      orders: ordersWithDetails,
    });
  } catch (error) {
    console.error("Portal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
