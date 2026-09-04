import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customerMeasurements } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { withPermission } from "@/lib/api-guard";
import { measurementSchema } from "@/lib/validations";
import { eventBus } from "@/lib/events";

// GET all measurement versions for a customer
export const GET = withPermission(
  { resource: "measurement", action: "read" },
  async (_request, { params }) => {
    const { id } = await params;

    const allMeasurements = await db
      .select()
      .from(customerMeasurements)
      .where(eq(customerMeasurements.customerId, id))
      .orderBy(desc(customerMeasurements.version));

    return NextResponse.json(allMeasurements);
  }
);

// POST new measurement version for a customer
export const POST = withPermission(
  { resource: "measurement", action: "create" },
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = measurementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Get the latest version for this customer
    const [latest] = await db
      .select({ version: customerMeasurements.version })
      .from(customerMeasurements)
      .where(eq(customerMeasurements.customerId, id))
      .orderBy(desc(customerMeasurements.version))
      .limit(1);

    const [measurement] = await db
      .insert(customerMeasurements)
      .values({
        customerId: id,
        template: parsed.data.template,
        values: parsed.data.values,
        notes: parsed.data.notes,
        version: (latest?.version || 0) + 1,
        createdBy: session.id,
      })
      .returning();

    // Emit event so the portal reflects the updated measurements live
    eventBus.emit({ type: "customer_updated", customerId: id, userId: session.id, timestamp: Date.now() });

    return NextResponse.json(measurement, { status: 201 });
  }
);