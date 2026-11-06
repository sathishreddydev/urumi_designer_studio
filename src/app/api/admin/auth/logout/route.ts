/**
 * POST /api/admin/auth/logout
 * Clears the admin session cookie.
 */

import { NextResponse } from "next/server";
import { signOutAdmin } from "@/lib/admin-auth";

export async function POST() {
  await signOutAdmin();
  return NextResponse.json({ success: true });
}
