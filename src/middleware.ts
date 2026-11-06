import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const publicPaths = [
  "/login",
  "/portal",
  "/signup",
  "/setup",
  "/suspended",
  "/admin/login",
  "/api/auth/login",
  "/api/portal",
  "/api/public",
  "/api/admin/auth/login",
  "/api/admin/auth/logout",
];

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required but not set");
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

// ─── MULTI-TENANT: BYPASS DOMAINS ────────────────────────────────────────────

/**
 * Domains that do NOT go through tenant resolution.
 * - localhost / 127.0.0.1 → development
 * - your own platform domain → landing page, signup, admin
 */
const PLATFORM_DOMAINS = (process.env.PLATFORM_DOMAINS || "localhost,127.0.0.1")
  .split(",")
  .map((d) => d.trim());

function isPlatformDomain(hostname: string): boolean {
  const clean = hostname.split(":")[0].toLowerCase();
  return PLATFORM_DOMAINS.some(
    (d) => clean === d || clean.endsWith(`.${d}`)
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function setCorsHeaders(response: NextResponse, origin: string | null) {
  if (ALLOWED_ORIGINS.length === 0) return response;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Max-Age", "86400");
  }
  return response;
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");
  const hostname = request.headers.get("host") || "";

  // ── CORS preflight ──────────────────────────────────────────────────────────
  if (request.method === "OPTIONS" && pathname.startsWith("/api")) {
    const response = new NextResponse(null, { status: 204 });
    return setCorsHeaders(response, origin);
  }

  // ── Static files / Next internals ──────────────────────────────────────────
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/favicon") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // ── MULTI-TENANT: Resolve studio from domain ────────────────────────────────
  // Skip resolution for the platform's own domain (admin panel, signup, etc.)
  if (!isPlatformDomain(hostname) && process.env.MASTER_DATABASE_URL) {
    try {
      // Dynamic import so middleware only pulls this in when multi-tenant is enabled
      const { resolveStudioByDomain } = await import(
        "@/lib/multi-tenant/domain-resolver"
      );

      const studio = await resolveStudioByDomain(hostname);

      if (!studio) {
        // Domain not registered → show a friendly error
        return new NextResponse(
          JSON.stringify({ error: "Studio not found for this domain" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // Studio is suspended
      if (studio.status === "suspended" && !pathname.startsWith("/suspended")) {
        return NextResponse.redirect(new URL("/suspended", request.url));
      }

      // Studio trial expired
      if (studio.status === "cancelled" && !pathname.startsWith("/suspended")) {
        return NextResponse.redirect(new URL("/suspended?reason=cancelled", request.url));
      }

      // Attach studio context to request headers so API routes & server
      // components can read it without re-querying the master DB.
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-studio-id", studio.id);
      requestHeaders.set("x-studio-db", studio.databaseName);
      // Strip secrets before forwarding - only pass what UI needs
      requestHeaders.set(
        "x-studio-data",
        JSON.stringify({
          id: studio.id,
          domain: studio.domain,
          databaseName: studio.databaseName,
          status: studio.status,
          brandName: studio.brandName,
          logoUrl: studio.logoUrl,
          faviconUrl: studio.faviconUrl,
          primaryColor: studio.primaryColor,
          secondaryColor: studio.secondaryColor,
          customCss: studio.customCss,
          businessName: studio.businessName,
          businessEmail: studio.businessEmail,
          businessPhone: studio.businessPhone,
          businessAddress: studio.businessAddress,
          timezone: studio.timezone,
          currency: studio.currency,
          planType: studio.planType,
          features: studio.features,
          cloudinaryAccountType: studio.cloudinaryAccountType,
          cloudinaryCloudName: studio.cloudinaryCloudName,
          cloudinaryApiKey: studio.cloudinaryApiKey,
          // ⚠️ Never forward cloudinaryApiSecret to client-side headers
        })
      );

      // Continue with the modified request
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      if (pathname.startsWith("/api")) setCorsHeaders(response, origin);
      return response;

    } catch (err) {
      console.error("[Middleware] Studio resolution error:", err);
      // Fall through to normal processing if master DB is unavailable
    }
  }

  // ── Public paths (no auth needed) ──────────────────────────────────────────
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    const response = NextResponse.next();
    if (pathname.startsWith("/api")) setCorsHeaders(response, origin);
    return response;
  }

  // ── Admin routes (use their own auth, not studio session) ────────────────
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const response = NextResponse.next();
    if (pathname.startsWith("/api")) setCorsHeaders(response, origin);
    return response;
  }

  // ── Auth check ─────────────────────────────────────────────────────────────
  const token = request.cookies.get("session-token")?.value;

  if (!token && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (
    !token &&
    pathname.startsWith("/api") &&
    !pathname.startsWith("/api/auth")
  ) {
    const response = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
    setCorsHeaders(response, origin);
    return response;
  }

  if (
    token &&
    (pathname.startsWith("/dashboard") || pathname.startsWith("/api"))
  ) {
    try {
      await jwtVerify(token, JWT_SECRET);
    } catch {
      if (pathname.startsWith("/dashboard")) {
        const response = NextResponse.redirect(
          new URL("/login", request.url)
        );
        response.cookies.delete("session-token");
        return response;
      }
      const response = NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
      setCorsHeaders(response, origin);
      return response;
    }
  }

  const response = NextResponse.next();
  if (pathname.startsWith("/api")) setCorsHeaders(response, origin);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
