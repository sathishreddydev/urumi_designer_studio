import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { measurementTemplates } from "@/lib/db/schema";
import { withAuth, withPermission } from "@/lib/api-guard";
import { eq } from "drizzle-orm";

export const GET = withAuth(async () => {
  const templates = await db
    .select()
    .from(measurementTemplates)
    .orderBy(measurementTemplates.name);

  return NextResponse.json(templates);
});

export const POST = withPermission(
  { resource: "user", action: "create" }, // admin-only
  async (request) => {
    const body = await request.json();
    const { name, type, fields } = body;

    if (!name || !type || !Array.isArray(fields)) {
      return NextResponse.json(
        { error: "name, type, and fields (array) are required" },
        { status: 400 }
      );
    }

    const [template] = await db
      .insert(measurementTemplates)
      .values({ name: name.trim(), type: type.trim(), fields })
      .returning();

    return NextResponse.json(template, { status: 201 });
  }
);
