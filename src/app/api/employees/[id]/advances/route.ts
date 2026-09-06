import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
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
  status: z.enum(["OUTSTANDING", "PARTIALLY_RECOVERED", "RECOVERED"]),
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
    return NextResponse.json(rows);
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
    const body = await request.json();
    const { advanceId, ...rest } = body;
    if (!advanceId) {
      return NextResponse.json({ error: "advanceId required" }, { status: 400 });
    }
    const parsed = recoverSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const [updated] = await db
      .update(employeeAdvances)
      .set({
        recoveredAmount: String(parsed.data.recoveredAmount),
        status: parsed.data.status,
      })
      .where(eq(employeeAdvances.id, advanceId))
      .returning();

    return NextResponse.json(updated);
  }
);
