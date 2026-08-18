import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const publicPaths = ["/login", "/portal", "/api/auth/login", "/api/portal"];

// Fail fast at startup if JWT_SECRET is not configured
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required but not set");
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Allowed origins for CORS (configure via env or hardcode for your deployment)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

function setCorsHeaders(response: NextResponse, origin: string | null) {
  // If no origins configured, skip CORS (same-origin only)
  if (ALLOWED_ORIGINS.length === 0) return response;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");

  // Handle CORS preflight (OPTIONS)
  if (request.method === "OPTIONS" && pathname.startsWith("/api")) {
    const response = new NextResponse(null, { status: 204 });
    return setCorsHeaders(response, origin);
  }

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    const response = NextResponse.next();
    if (pathname.startsWith("/api")) setCorsHeaders(response, origin);
    return response;
  }

  // Allow static files and uploads
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/favicon") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Check for session token
  const token = request.cookies.get("session-token")?.value;

  if (!token && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!token && pathname.startsWith("/api") && !pathname.startsWith("/api/auth")) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    setCorsHeaders(response, origin);
    return response;
  }

  // Validate token if present (for dashboard and API routes)
  if (token && (pathname.startsWith("/dashboard") || pathname.startsWith("/api"))) {
    try {
      await jwtVerify(token, JWT_SECRET);
    } catch {
      // Token is invalid or expired
      if (pathname.startsWith("/dashboard")) {
        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.delete("session-token");
        return response;
      }
      const response = NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
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
