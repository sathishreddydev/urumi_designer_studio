import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getStudioDb } from "@/lib/multi-tenant/studio";
import { users } from "@/lib/db/schema";
import { createSession, createToken, type SessionUser } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { loginLimiter, getClientIp } from "@/lib/rate-limit";
import { getTenantDb } from "@/lib/multi-tenant/database-manager";
import { resolveStudioFromHeaders } from "@/lib/multi-tenant/domain-resolver";
import { headers } from "next/headers";

export async function POST(request: Request) {
    const db = await getStudioDb();
  try {
    // ── Rate limiting ────────────────────────────────────────────────────────
    const ip = getClientIp(request);
    const { allowed, resetMs } = loginLimiter.check(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(resetMs / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // ── Validate input ────────────────────────────────────────────────────────
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
    }

    const { email, password } = parsed.data;

    // ── Multi-tenant: resolve studio from middleware headers ──────────────────
    // The middleware has already resolved the domain to a studio and set
    // x-studio-data header. We read it here to determine which tenant DB
    // to authenticate against.
    const isMultiTenant = !!process.env.MASTER_DATABASE_URL;

    let studioId: string | undefined;
    let databaseName: string | undefined;
    let studioStatus: string | undefined;

    if (isMultiTenant) {
      const headersList = await headers();
      const studio = resolveStudioFromHeaders(headersList);

      if (!studio) {
        return NextResponse.json(
          { error: "Studio not found for this domain" },
          { status: 404 }
        );
      }

      // Block login if studio is suspended or cancelled
      if (studio.status === "suspended") {
        return NextResponse.json(
          { error: "This account is suspended. Please contact support." },
          { status: 403 }
        );
      }
      if (studio.status === "cancelled") {
        return NextResponse.json(
          { error: "This account is no longer active." },
          { status: 403 }
        );
      }

      studioId = studio.id;
      databaseName = studio.databaseName;
      studioStatus = studio.status;
    }

    // ── Query the correct database ───────────────────────────────────────────
    // Multi-tenant → tenant DB; Single-tenant → default DB
    const queryDb =
      databaseName && isMultiTenant
        ? getTenantDb(databaseName)
        : db;

    const [user] = await queryDb
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user || !user.active) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // ── Verify password ───────────────────────────────────────────────────────
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // ── Build session user (includes tenant fields in multi-tenant mode) ─────
    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      // Multi-tenant fields — present only in multi-tenant mode
      ...(studioId ? { studioId } : {}),
      ...(databaseName ? { databaseName } : {}),
    };

    // ── Create session & token ───────────────────────────────────────────────
    const { sessionId, expiresAt } = await createSession(sessionUser, request);
    const token = await createToken(sessionUser, sessionId);

    // ── Set cookie ────────────────────────────────────────────────────────────
    const response = NextResponse.json({ success: true });
    response.cookies.set("session-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
