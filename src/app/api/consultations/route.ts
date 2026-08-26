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
    if (search) {
      conditions.push(
        or(
          ilike(customers.name, `%${search}%`),
          ilike(customers.mobile, `%${search}%`),
          ilike(consultations.notes, `%${search}%`)
        )
      );
    }

    const list = await db
      .select({ consultation: consultations, customerName: customers.name, customerMobile: customers.mobile })
      .from(consultations)
      .innerJoin(customers, eq(consultations.customerId, customers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(consultations.createdAt))
      .limit(100);

    // Enrich with creator name
    const enriched = await Promise.all(
      list.map(async ({ consultation: c, customerName, customerMobile }) => {
        const [creator] = c.createdBy
          ? await db.select({ name: users.name }).from(users).where(eq(users.id, c.createdBy)).limit(1)
          : [null];
        return {
          ...c,
          customerName: customerName || "",
          customerMobile: customerMobile || "",
          createdByName: creator?.name || "",
        };
      })
    );

    return NextResponse.json(enriched);
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
