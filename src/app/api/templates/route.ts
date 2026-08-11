import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { measurementTemplates } from "@/lib/db/schema";
import { withAuth } from "@/lib/api-guard";

export const GET = withAuth(async () => {
  const templates = await db
    .select()
    .from(measurementTemplates)
    .orderBy(measurementTemplates.name);

  return NextResponse.json(templates);
});
