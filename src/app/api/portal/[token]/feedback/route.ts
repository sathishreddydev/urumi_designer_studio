import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers, referenceImages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Verify the token belongs to a customer
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.portalToken, token))
    .limit(1);

  if (!customer) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const body = await request.json();
  const { referenceId, feedback } = body;

  if (!referenceId || !["approved", "rejected"].includes(feedback)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Update the reference image with customer feedback
  await db
    .update(referenceImages)
    .set({
      notes: feedback === "approved" ? "✓ Customer approved" : "✗ Customer rejected",
      updatedAt: new Date(),
    })
    .where(eq(referenceImages.id, referenceId));

  return NextResponse.json({ success: true });
}
