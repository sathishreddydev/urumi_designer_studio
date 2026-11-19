import { NextResponse } from "next/server";
import { OWNER_COOKIE_NAME, ownerCookieOptions } from "@/lib/tenant-registry/owner-auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(OWNER_COOKIE_NAME, "", {
    ...ownerCookieOptions(),
    maxAge: 0,
  });
  return response;
}
