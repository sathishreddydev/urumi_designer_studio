import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { measurements } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { withPermission } from "@/lib/api-guard";
import { measurementSchema } from "@/lib/validations";

export const POST = withPermission(
  { resource: "measurement", action: "create" },
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = measurementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Get the latest version
    const [latest] = await db
      .select({ version: measurements.version })
      .from(measurements)
      .where(eq(measurements.outfitId, id))
      .orderBy(desc(measurements.version))
      .limit(1);

    const [measurement] = await db
      .insert(measurements)
      .values({
        outfitId: id,
        template: parsed.data.template,
        values: parsed.data.values,
        notes: parsed.data.notes,
        version: (latest?.version || 0) + 1,
      })
      .returning();

    // Auto-trigger: first measurement → WAITING_FOR_REFERENCES
    const { onMeasurementSaved } = await import("@/lib/auto-triggers");
    await onMeasurementSaved(id, session.id);

    // Emit event
    const { eventBus } = await import("@/lib/events");
    eventBus.emit({ type: "outfit_updated", outfitId: id, userId: session.id, timestamp: Date.now() });

    return NextResponse.json(measurement, { status: 201 });
  }
);
