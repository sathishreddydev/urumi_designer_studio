import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { storeExpenditures } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { z } from "zod";

const updateSchema = z.object({
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category:       z.enum(["RENT","MATERIAL","ELECTRICITY","WATER","EQUIPMENT","MAINTENANCE","TRANSPORT","MARKETING","MISCELLANEOUS"]).optional(),
  customCategory: z.string().nullable().optional(),
  description:    z.string().min(1).optional(),
  amount:         z.number().positive().optional(),
  method:         z.enum(["CASH","CARD","UPI","BANK_TRANSFER"]).optional(),
  vendor:         z.string().nullable().optional(),
  notes:          z.string().nullable().optional(),
});

export const PATCH = withPermission(
  { resource: "expenditure", action: "update" },
  async (request, { params }) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data: Record<string, any> = { updatedAt: new Date() };
    if (parsed.data.date           !== undefined) data.date           = parsed.data.date;
    if (parsed.data.category       !== undefined) data.category       = parsed.data.category;
    if (parsed.data.customCategory !== undefined) data.customCategory = parsed.data.customCategory;
    if (parsed.data.description    !== undefined) data.description    = parsed.data.description;
    if (parsed.data.amount         !== undefined) data.amount         = String(parsed.data.amount);
    if (parsed.data.method         !== undefined) data.method         = parsed.data.method;
    if (parsed.data.vendor         !== undefined) data.vendor         = parsed.data.vendor;
    if (parsed.data.notes          !== undefined) data.notes          = parsed.data.notes;

    const [updated] = await db
      .update(storeExpenditures)
      .set(data)
      .where(eq(storeExpenditures.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  }
);

export const DELETE = withPermission(
  { resource: "expenditure", action: "delete" },
  async (_request, { params }) => {
    const { id } = await params;
    await db.delete(storeExpenditures).where(eq(storeExpenditures.id, id));
    return NextResponse.json({ success: true });
  }
);
