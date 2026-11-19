import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isOwnerAuthenticated, getOwnerAccount, OWNER_COOKIE_NAME, ownerCookieOptions, createOwnerToken } from "@/lib/tenant-registry/owner-auth";
import { queryMaster } from "@/lib/tenant-registry/db";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    // Must be authenticated
    if (!(await isOwnerAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("currentPassword" in body) ||
      !("newPassword" in body) ||
      typeof body.currentPassword !== "string" ||
      typeof body.newPassword !== "string"
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { currentPassword, newPassword } = body;

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }
    if (newPassword.length > 128) {
      return NextResponse.json(
        { error: "New password must be 128 characters or fewer" },
        { status: 400 }
      );
    }

    // Get current owner email from cookie
    const cookieStore = await cookies();
    const { jwtVerify } = await import("jose");
    const token = cookieStore.get(OWNER_COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const jwtSecret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, jwtSecret);
    const email = payload.sub as string;

    // Verify current password
    const owner = await getOwnerAccount(email);
    if (!owner || !(await bcrypt.compare(currentPassword, owner.passwordHash))) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    // Hash and store new password
    const newHash = await bcrypt.hash(newPassword, 12);
    await queryMaster(
      `UPDATE tenant_registry_owners SET password_hash = $1, updated_at = now() WHERE email = $2`,
      [newHash, email]
    );

    // Issue a fresh token so the session remains valid
    const newToken = await createOwnerToken(email);
    const response = NextResponse.json({ success: true });
    response.cookies.set(OWNER_COOKIE_NAME, newToken, ownerCookieOptions());
    return response;
  } catch (error) {
    console.error("Could not change owner password:", error);
    return NextResponse.json({ error: "Could not change password" }, { status: 500 });
  }
}
