/**
 * POST /api/admin/auth/login
 * Admin login — separate from studio user login.
 */

import { NextResponse } from "next/server";
import { signInAdmin } from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const result = await signInAdmin(email, password);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Login failed" },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
