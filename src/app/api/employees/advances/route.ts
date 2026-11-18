import { NextResponse } from "next/server";
import { desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { employeeAdvances } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";

const employeeIdsSchema = z.array(z.string().min(1).max(20)).min(1).max(500);

export const GET = withPermission(
  { resource: "employee", action: "read" },
  async (request) => {
    const { searchParams } = new URL(request.url);
    const employeeIdsParam = searchParams.get("employeeIds");
    let employeeIds: string[] | undefined;
    if (employeeIdsParam !== null) {
      const parsed = employeeIdsSchema.safeParse(employeeIdsParam.split(","));
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid employee IDs." }, { status: 400 });
      }
      employeeIds = parsed.data;
    }

    const rows = employeeIds
      ? await db
          .select()
          .from(employeeAdvances)
          .where(inArray(employeeAdvances.employeeId, employeeIds))
          .orderBy(desc(employeeAdvances.issuedAt))
      : await db
          .select()
          .from(employeeAdvances)
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
