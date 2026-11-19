import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getClientIp, loginLimiter } from "@/lib/rate-limit";
import {
  createOwnerToken,
  getOwnerAccount,
  OWNER_COOKIE_NAME,
  ownerCookieOptions,
} from "@/lib/tenant-registry/owner-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, resetMs } = loginLimiter.check(`owner:${ip}`);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(resetMs / 1000)) },
      }
    );
  }

  try {
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("email" in body) ||
      !("password" in body) ||
      typeof body.email !== "string" ||
      typeof body.password !== "string"
    ) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const owner = await getOwnerAccount(email);
    if (!owner || !(await bcrypt.compare(body.password, owner.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await createOwnerToken(owner.email);
    const response = NextResponse.json({ success: true });
    response.cookies.set(OWNER_COOKIE_NAME, token, ownerCookieOptions());
    return response;
  } catch (error) {
    console.error("Owner login failed:", error);
    return NextResponse.json(
      { error: "Owner login is temporarily unavailable" },
      { status: 503 }
    );
  }
}
