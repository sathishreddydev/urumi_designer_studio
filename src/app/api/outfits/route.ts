import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outfits, orders, customers, users, customerMeasurements, referenceImages } from "@/lib/db/schema";
import { eq, count, desc, asc, inArray, ilike, or, and as drizzleAnd, gte, lt, isNotNull } from "drizzle-orm";
import { withPermission } from "@/lib/api-guard";
import { outfitSchema } from "@/lib/validations";
import { eventBus } from "@/lib/events";

export const GET = withPermission(
  { resource: "outfit", action: "read" },
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId") || "";
    const status = searchParams.get("status") || "";
    const search = searchParams.get("search") || "";
    const deadline = searchParams.get("deadline") || ""; // "overdue" | "today" | "tomorrow" | "week"
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // ── Deadline range helpers ──────────────────────────────────────────────
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const startOfDayAfter = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000);
    const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    const conditions: any[] = [];

    // Role-based scoping
    if (session.role === "DESIGNER") {
      conditions.push(eq(outfits.designerId, session.id));
    } else if (session.role === "MASTER") {
      conditions.push(eq(outfits.masterId, session.id));
    }

    // Filters
    if (orderId) {
      conditions.push(eq(outfits.orderId, orderId));
    } else if (status === "production") {
      conditions.push(inArray(outfits.status, [
        "WAITING_FOR_DEPENDENCIES",
        "PRODUCTION_READY",
        "PATTERN_DRAFTING",
        "MAGGAM_WORK",
        "MAGGAM_REVIEW",
        "MAGGAM_REVIEWED",
        "FABRIC_CUTTING",
        "STITCHING",
        "PRODUCTION_COMPLETED",
      ] as any));
    } else if (status && status !== "all") {
      conditions.push(eq(outfits.status, status as any));
    }

    if (search) {
      conditions.push(
        or(
          ilike(outfits.name, `%${search}%`),
          // Search by customer name — requires the join added below
          ilike(customers.name, `%${search}%`)
        )
      );
    }

    // Deadline filter — applied on deliveryDate
    if (deadline === "overdue") {
      conditions.push(isNotNull(outfits.deliveryDate));
      conditions.push(lt(outfits.deliveryDate, startOfToday));
      // Exclude already-completed outfits
      conditions.push(
        inArray(outfits.status, [
          "DRAFT", "DESIGN_IN_PROGRESS", "WAITING_FOR_REFERENCES", "WAITING_FOR_DEPENDENCIES",
          "PRODUCTION_READY", "PATTERN_DRAFTING", "MAGGAM_WORK", "MAGGAM_REVIEW", "MAGGAM_REVIEWED",
          "FABRIC_CUTTING", "STITCHING", "PRODUCTION_COMPLETED", "TRIAL", "ALTERATION", "QC",
        ] as any)
      );
    } else if (deadline === "today") {
      conditions.push(isNotNull(outfits.deliveryDate));
      conditions.push(gte(outfits.deliveryDate, startOfToday));
      conditions.push(lt(outfits.deliveryDate, startOfTomorrow));
    } else if (deadline === "tomorrow") {
      conditions.push(isNotNull(outfits.deliveryDate));
      conditions.push(gte(outfits.deliveryDate, startOfTomorrow));
      conditions.push(lt(outfits.deliveryDate, startOfDayAfter));
    } else if (deadline === "week") {
      conditions.push(isNotNull(outfits.deliveryDate));
      conditions.push(gte(outfits.deliveryDate, startOfToday));
      conditions.push(lt(outfits.deliveryDate, endOfWeek));
    } else if (deadline === "custom") {
      const rawDate = searchParams.get("deadlineDate");
      if (rawDate) {
        const picked = new Date(rawDate);
        const startOfPicked = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate());
        const startOfNext = new Date(startOfPicked.getTime() + 24 * 60 * 60 * 1000);
        conditions.push(isNotNull(outfits.deliveryDate));
        conditions.push(gte(outfits.deliveryDate, startOfPicked));
        conditions.push(lt(outfits.deliveryDate, startOfNext));
      }
    }

    const condition = conditions.length > 0 ? drizzleAnd(...conditions) : undefined;

    // When deadline filter is active, sort by deliveryDate ASC (most urgent first)
    const ordering = (deadline && deadline !== "")
      ? [asc(outfits.deliveryDate), desc(outfits.priority)]
      : [desc(outfits.priority), desc(outfits.createdAt)];

    const outfitsList = await db
      .select({ outfit: outfits })
      .from(outfits)
      .innerJoin(orders, eq(outfits.orderId, orders.id))
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(condition)
      .orderBy(...ordering)
      .limit(limit)
      .offset(offset)
      .then((rows) => rows.map((r) => r.outfit));

    // Enrich with customer name, order number, designer/master names
    const enriched = await Promise.all(
      outfitsList.map(async (outfit) => {
        const [order] = await db
          .select({ id: orders.id, orderNumber: orders.orderNumber, customerId: orders.customerId })
          .from(orders)
          .where(eq(orders.id, outfit.orderId))
          .limit(1);

        let customerName = "";
        if (order) {
          const [cust] = await db
            .select({ name: customers.name })
            .from(customers)
            .where(eq(customers.id, order.customerId))
            .limit(1);
          customerName = cust?.name || "";
        }

        let designerName = "";
        if (outfit.designerId) {
          const [d] = await db.select({ name: users.name }).from(users).where(eq(users.id, outfit.designerId)).limit(1);
          designerName = d?.name || "";
        }

        let masterName = "";
        if (outfit.masterId) {
          const [m] = await db.select({ name: users.name }).from(users).where(eq(users.id, outfit.masterId)).limit(1);
          masterName = m?.name || "";
        }

        // Fetch all customer material images (FABRIC type, not a work photo)
        const materialRefs = await db
          .select({ id: referenceImages.id, url: referenceImages.url })
          .from(referenceImages)
          .where(
            drizzleAnd(
              eq(referenceImages.outfitId, outfit.id),
              eq(referenceImages.type, "FABRIC"),
              eq(referenceImages.isWorkPhoto, false)
            )
          )
          .orderBy(asc(referenceImages.createdAt));
        const customerMaterialImageUrl = materialRefs[0]?.url ?? null;
        const customerMaterialImages = materialRefs;

        return {
          ...outfit,
          customerName,
          orderNumber: order?.orderNumber || "",
          designerName,
          masterName,
          customerMaterialImageUrl,
          customerMaterialImages,
        };
      })
    );

    const [totalResult] = await db
      .select({ count: count() })
      .from(outfits)
      .innerJoin(orders, eq(outfits.orderId, orders.id))
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(condition);

    return NextResponse.json({ outfits: enriched, total: totalResult.count, page, limit });
  }
);

// Garment-specific measurement fields keyed by outfit type.
// These are pre-seeded as empty strings when an outfit is created, so the
// outfit detail page always has a form to fill in — no extra steps needed.
const GARMENT_MEASUREMENT_FIELDS: Record<string, string[]> = {
  "Bridal Blouse":     ["Front Length", "Back Length", "Armhole", "Sleeve Round", "Neck Front", "Neck Back"],
  "Reception Blouse":  ["Front Length", "Back Length", "Armhole", "Sleeve Round", "Neck Front", "Neck Back"],
  "Saree Blouse":      ["Front Length", "Back Length", "Armhole", "Sleeve Round", "Neck Front", "Neck Back"],
  "Lehenga":           ["Waist", "Hip", "Lehenga Length", "Flare / Gher"],
  "Gown":              ["Full Length", "Yoke Length", "Waist", "Hip", "Flare / Gher"],
  "Kurta":             ["Kurti Length", "Yoke Length", "Neck Front", "Neck Back", "Side Slit Start"],
  "Anarkali":          ["Anarkali Length", "Yoke Length", "Neck Front", "Neck Back", "Flare / Gher"],
  "Sharara":           ["Waist", "Hip", "Sharara Length", "Top Length", "Neck Front"],
  "Other":             [],
};

function seedGarmentMeasurements(type: string): Record<string, string> {
  const fields = GARMENT_MEASUREMENT_FIELDS[type] ?? [];
  return Object.fromEntries(fields.map((f) => [f, ""]));
}

export const POST = withPermission(
  { resource: "outfit", action: "create" },
  async (request) => {
    const body = await request.json();
    const parsed = outfitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (!body.orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    // Snapshot the customer's current body measurements at outfit-creation time
    let measurementSnapshotId: string | null = null;
    try {
      const [order] = await db
        .select({ customerId: orders.customerId })
        .from(orders)
        .where(eq(orders.id, body.orderId))
        .limit(1);

      if (order?.customerId) {
        const [latestMeasurement] = await db
          .select({ id: customerMeasurements.id })
          .from(customerMeasurements)
          .where(eq(customerMeasurements.customerId, order.customerId))
          .orderBy(desc(customerMeasurements.version))
          .limit(1);
        measurementSnapshotId = latestMeasurement?.id ?? null;
      }
    } catch {
      // Non-fatal — outfit creation should not fail just because measurements are missing
      measurementSnapshotId = null;
    }

    // Seed empty garment-specific fields based on outfit type
    const garmentMeasurements = seedGarmentMeasurements(parsed.data.type);

    const [outfit] = await db
      .insert(outfits)
      .values({
        orderId: body.orderId,
        name: parsed.data.name,
        type: parsed.data.type,
        occasion: parsed.data.occasion,
        priority: parsed.data.priority,
        deliveryDate: parsed.data.deliveryDate ? new Date(parsed.data.deliveryDate) : null,
        trialDate: parsed.data.trialDate ? new Date(parsed.data.trialDate) : null,
        maggamRequired: parsed.data.maggamRequired,
        price: parsed.data.price != null ? String(parsed.data.price) : null,
        designerId: parsed.data.designerId || null,
        measurementSnapshotId,
        garmentMeasurements: Object.keys(garmentMeasurements).length > 0 ? garmentMeasurements : null,
      })
      .returning();

    // Emit event
    eventBus.emit({ type: "outfit_updated", outfitId: outfit.id, orderId: body.orderId, timestamp: Date.now() });

    return NextResponse.json(outfit, { status: 201 });
  }
);
