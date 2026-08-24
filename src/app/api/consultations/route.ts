import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consultations, customers, users } from "@/lib/db/schema";
import { eq, desc, and, ilike, or } from "drizzle-orm";
import { withPermission } from "@/lib/api-guard";

export const GET = withPermission(
  { resource: "order", action: "read" },
  async (request) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "draft";
    const search = searchParams.get("search") || "";

    const conditions: any[] = [];
    if (status && status !== "all") conditions.push(eq(consultations.status, status));

    const list = await db
      .select()
      .from(consultations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(consultations.createdAt))
      .limit(100);

    // Enrich with customer names
    const enriched = await Promise.all(
      list.map(async (c) => {
        const [cust] = await db
          .select({ name: customers.name, mobile: customers.mobile })
          .from(customers)
          .where(eq(customers.id, c.customerId))
          .limit(1);
        const [creator] = c.createdBy
          ? await db.select({ name: users.name }).from(users).where(eq(users.id, c.createdBy)).limit(1)
          : [null];
        return {
          ...c,
          customerName: cust?.name || "",
          customerMobile: cust?.mobile || "",
          createdByName: creator?.name || "",
        };
      })
    );

    // Client-side search filter on customer name
    const filtered = search
      ? enriched.filter((c) =>
          c.customerName.toLowerCase().includes(search.toLowerCase()) ||
          (c.notes || "").toLowerCase().includes(search.toLowerCase())
        )
      : enriched;

    return NextResponse.json(filtered);
  }
);

export const POST = withPermission(
  { resource: "order", action: "create" },
  async (request, { session }) => {
    const body = await request.json();
    const { customerId, notes, outfitIdeas, estimatedAmount, consultationDate, expectedDeliveryDate, expectedTrialDate } = body;

    if (!customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    const [consultation] = await db
      .insert(consultations)
      .values({
        customerId,
        createdBy: session.id,
        notes: notes || null,
        estimatedAmount: estimatedAmount ? String(estimatedAmount) : null,
        outfitIdeas: outfitIdeas || [],
        status: "draft",
        consultationDate: consultationDate ? new Date(consultationDate) : null,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        expectedTrialDate: expectedTrialDate ? new Date(expectedTrialDate) : null,
      })
      .returning();

    return NextResponse.json(consultation, { status: 201 });
  }
);
