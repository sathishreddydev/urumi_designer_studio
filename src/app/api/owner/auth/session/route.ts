import { NextResponse } from "next/server";
import { getOwnerSessionExpiresAt } from "@/lib/tenant-registry/owner-auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const expiresAt = await getOwnerSessionExpiresAt();
    if (expiresAt === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ expiresAt });
  } catch (error) {
    console.error("Could not check owner session expiry:", error);
    return NextResponse.json({ error: "Could not check owner session" }, { status: 500 });
  }
}
