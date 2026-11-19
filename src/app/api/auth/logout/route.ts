import { NextResponse } from "next/server";
import { revokeCurrentSession } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-registry/runtime";

export const POST = withTenant(async (_request: Request) => {
  await revokeCurrentSession();
  const response = NextResponse.json({ success: true });
  response.cookies.set("session-token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
});
