import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dependencies } from "@/lib/db/schema";
import { eq, ne, count, and } from "drizzle-orm";
import { withPermission, withAuth } from "@/lib/api-guard";

// GET — viewable by all authenticated staff
export const GET = withAuth(async (_request, { params }) => {
  const { id } = await params;

  const deps = await db
    .select()
    .from(dependencies)
    .where(eq(dependencies.outfitId, id));

  return NextResponse.json(deps);
});

// POST — Master raises dependency (Admin/Master)
export const POST = withPermission(
  { resource: "dependency", action: "create" },
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await request.json();

    const [dependency] = await db
      .insert(dependencies)
      .values({
        outfitId: id,
        type: body.type,
        status: "PENDING",
        notes: body.notes,
        raisedBy: session.id,
      })
      .returning();

    // Auto-trigger: blocker raised
    const { onBlockerRaised } = await import("@/lib/auto-triggers");
    await onBlockerRaised(id, session.id);

    // Emit event
    const { eventBus } = await import("@/lib/events");
    eventBus.emit({ type: "dependency_updated", outfitId: id, userId: session.id, timestamp: Date.now() });

    return NextResponse.json(dependency, { status: 201 });
  }
);

// PATCH — resolve dependency (Admin/Designer)
export const PATCH = withPermission(
  { resource: "dependency", action: "update" },
  async (request, { params, session }) => {
    const body = await request.json();

    await db
      .update(dependencies)
      .set({ status: body.status, updatedAt: new Date() })
      .where(eq(dependencies.id, body.dependencyId));

    // Check if all dependencies are resolved
    const { id } = await params;
    const [pendingResult] = await db
      .select({ count: count() })
      .from(dependencies)
      .where(and(eq(dependencies.outfitId, id), ne(dependencies.status, "AVAILABLE")));

    if (pendingResult.count === 0) {
      // Auto-trigger: all resolved
      const { onAllBlockersResolved } = await import("@/lib/auto-triggers");
      await onAllBlockersResolved(id, session.id);
    }

    // Emit event
    const { eventBus } = await import("@/lib/events");
    eventBus.emit({ type: "dependency_updated", outfitId: id, userId: session.id, timestamp: Date.now() });

    return NextResponse.json({ success: true });
  }
);
