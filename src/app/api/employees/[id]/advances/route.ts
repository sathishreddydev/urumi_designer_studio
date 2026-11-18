import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { employeeAdvances } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { z } from "zod";

const advanceSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

const recoverSchema = z.object({
  recoveredAmount: z.number().min(0),
});

export const GET = withPermission(
  { resource: "employee", action: "read" },
  async (_request, { params }) => {
    const { id } = await params;
    const rows = await db
      .select()
      .from(employeeAdvances)
      .where(eq(employeeAdvances.employeeId, id))
      .orderBy(desc(employeeAdvances.issuedAt));
    return NextResponse.json(rows.map((advance) => ({
      ...advance,
      status: Number(advance.recoveredAmount) >= Number(advance.amount)
        ? "RECOVERED"
        : Number(advance.recoveredAmount) > 0
        ? "PARTIALLY_RECOVERED"
        : "OUTSTANDING",
    })));
  }
);

export const POST = withPermission(
  { resource: "employee", action: "update" },
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = advanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const [record] = await db
      .insert(employeeAdvances)
      .values({
        employeeId: id,
        amount: String(parsed.data.amount),
        reason: parsed.data.reason ?? null,
        issuedBy: session.id,
        notes: parsed.data.notes ?? null,
      })
      .returning();

    return NextResponse.json(record, { status: 201 });
  }
);

// PATCH /:id/advances — update recovery on a specific advance (body includes advanceId)
export const PATCH = withPermission(
  { resource: "employee", action: "update" },
  async (request, { params }) => {
    const { id } = await params;
    const parsed = z.object({
      advanceId: z.string().min(1),
    }).and(recoverSchema).safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      const [advance] = await tx
        .select()
        .from(employeeAdvances)
        .where(and(
          eq(employeeAdvances.id, parsed.data.advanceId),
          eq(employeeAdvances.employeeId, id)
        ))
        .for("update")
        .limit(1);
      if (!advance) return { error: "Advance not found.", status: 404 as const };
      if (parsed.data.recoveredAmount > Number(advance.amount)) {
        return { error: "Recovered amount cannot exceed the advance amount.", status: 400 as const };
      }

      const status = parsed.data.recoveredAmount >= Number(advance.amount)
        ? "RECOVERED"
        : parsed.data.recoveredAmount > 0
        ? "PARTIALLY_RECOVERED"
        : "OUTSTANDING";
      const [updated] = await tx
        .update(employeeAdvances)
        .set({ recoveredAmount: String(parsed.data.recoveredAmount), status })
        .where(eq(employeeAdvances.id, advance.id))
        .returning();
      return { advance: updated };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.advance);
  }
);

export const DELETE = withPermission(
  { resource: "employee", action: "update" },
  async (request, { params }) => {
    const { id } = await params;
    const parsed = z.object({
      advanceId: z.string().min(1),
    }).safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      const [advance] = await tx
        .select()
        .from(employeeAdvances)
        .where(and(
          eq(employeeAdvances.id, parsed.data.advanceId),
          eq(employeeAdvances.employeeId, id)
        ))
        .for("update")
        .limit(1);
      if (!advance) return { error: "Advance not found.", status: 404 as const };
      if (Number(advance.recoveredAmount) > 0) {
        return { error: "An advance cannot be deleted after any amount has been recovered.", status: 400 as const };
      }

      await tx
        .delete(employeeAdvances)
        .where(eq(employeeAdvances.id, advance.id));
      return { success: true };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  }
);
