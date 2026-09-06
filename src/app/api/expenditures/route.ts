import { NextResponse } from "next/server";
import { desc, count, sum, gte, lte, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { storeExpenditures } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { z } from "zod";

const expenditureSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  category: z.enum([
    "RENT", "MATERIAL", "ELECTRICITY", "WATER", "EQUIPMENT",
    "MAINTENANCE", "TRANSPORT", "MARKETING", "MISCELLANEOUS",
  ]),
  customCategory: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  amount: z.number().positive("Amount must be positive"),
  method: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER"]).default("CASH"),
  vendor: z.string().optional(),
  notes: z.string().optional(),
});

export const GET = withPermission(
  { resource: "expenditure", action: "read" },
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    const month    = searchParams.get("month");   // "YYYY-MM"  — filter by month
    const from     = searchParams.get("from");    // "YYYY-MM-DD"
    const to       = searchParams.get("to");      // "YYYY-MM-DD"
    const category = searchParams.get("category");
    const page     = parseInt(searchParams.get("page")  || "1");
    const limit    = parseInt(searchParams.get("limit") || "50");
    const offset   = (page - 1) * limit;

    const conditions: any[] = [];
    if (month) {
      conditions.push(gte(storeExpenditures.date, `${month}-01`));
      // last day of month
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      conditions.push(lte(storeExpenditures.date, `${month}-${String(lastDay).padStart(2, "0")}`));
    }
    if (from) conditions.push(gte(storeExpenditures.date, from));
    if (to)   conditions.push(lte(storeExpenditures.date, to));
    if (category) conditions.push(eq(storeExpenditures.category, category as any));

    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(storeExpenditures)
      .where(where)
      .orderBy(desc(storeExpenditures.date), desc(storeExpenditures.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }]    = await db.select({ total: count() }).from(storeExpenditures).where(where);
    const [{ totalAmt }] = await db
      .select({ totalAmt: sum(storeExpenditures.amount) })
      .from(storeExpenditures)
      .where(where);

    // Category breakdown
    const breakdown = await db
      .select({ category: storeExpenditures.category, total: sum(storeExpenditures.amount) })
      .from(storeExpenditures)
      .where(where)
      .groupBy(storeExpenditures.category);

    return NextResponse.json({
      expenditures: rows,
      total,
      totalAmount: totalAmt ?? "0",
      breakdown,
      page,
      limit,
    });
  }
);

export const POST = withPermission(
  { resource: "expenditure", action: "create" },
  async (request, { session }) => {
    const body = await request.json();
    const parsed = expenditureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const [row] = await db
      .insert(storeExpenditures)
      .values({
        date:           parsed.data.date,
        category:       parsed.data.category,
        customCategory: parsed.data.customCategory ?? null,
        description:    parsed.data.description,
        amount:         String(parsed.data.amount),
        method:         parsed.data.method,
        vendor:         parsed.data.vendor ?? null,
        notes:          parsed.data.notes ?? null,
        recordedBy:     session.id,
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  }
);
