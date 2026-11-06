import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { and, eq, isNull, gt } from "drizzle-orm";
import { db } from "./db";
import { customers, sessions, users } from "./db/schema";
import { generatePrefixedId } from "./id";
import { getTenantDb } from "./multi-tenant/database-manager";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export type Role = "ADMIN" | "STORE_MANAGER" | "RECEPTION" | "DESIGNER" | "MASTER";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  sessionId?: string;
  // ── Multi-tenant fields (present when MASTER_DATABASE_URL is set) ────────
  studioId?: string;
  databaseName?: string;
}

/**
 * Create a JWT token for a studio user.
 * In multi-tenant mode, the token carries studioId + databaseName
 * so every subsequent request knows which tenant DB to use.
 */
export async function createToken(user: SessionUser, sessionId: string): Promise<string> {
  return new SignJWT({ user, sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

/**
 * Verify a JWT token and check that the session is still active.
 *
 * In multi-tenant mode:
 *   - The token carries databaseName → we validate the session
 *     against the correct tenant database.
 *   - If the studio is suspended, the session is treated as invalid.
 *
 * In single-tenant mode (no studioId in token):
 *   - Validates against the default db (existing behavior).
 */
export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const sessionId = (payload as { sessionId?: string }).sessionId;
    const user = (payload as { user?: SessionUser }).user;
    if (!user) return null;

    // ── Backward compat: tokens issued before multi-tenancy ────────────────
    // Keep tokens issued before persisted sessions were introduced valid
    // until they expire.
    if (!sessionId) return user;

    // ── Choose the right database ──────────────────────────────────────────
    // If the token has a databaseName, use the tenant DB.
    // Otherwise, use the default db (single-tenant mode).
    const isMultiTenant = !!user.databaseName && !!process.env.MASTER_DATABASE_URL;

    if (isMultiTenant) {
      const tenantDb = getTenantDb(user.databaseName!);

      // Check that the session is still active in the tenant DB
      const [activeSession] = await tenantDb
        .select({ userId: sessions.userId })
        .from(sessions)
        .where(and(
          eq(sessions.id, sessionId),
          eq(sessions.userId, user.id),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ))
        .limit(1);

      if (!activeSession) return null;

      // Update last active timestamp
      await tenantDb
        .update(sessions)
        .set({ lastActiveAt: new Date() })
        .where(eq(sessions.id, sessionId));

      return { ...user, sessionId };
    }

    // ── Single-tenant mode (original behavior) ──────────────────────────────
    const [activeSession] = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, user.id),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ))
      .limit(1);

    if (!activeSession) return null;
    await db.update(sessions).set({ lastActiveAt: new Date() }).where(eq(sessions.id, sessionId));
    return { ...user, sessionId };
  } catch {
    return null;
  }
}

/**
 * Create a new session record.
 *
 * In multi-tenant mode (databaseName provided):
 *   - Inserts into the tenant database.
 *
 * In single-tenant mode:
 *   - Inserts into the default db.
 */
export async function createSession(
  user: SessionUser,
  request: Request
) {
  const sessionId = generatePrefixedId("ses");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const userAgent = request.headers.get("user-agent") || "Unknown browser";
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") || null;

  const sessionValues = {
    id: sessionId,
    userId: user.id,
    deviceName: getDeviceName(userAgent),
    userAgent,
    ipAddress,
    expiresAt,
  };

  // ── Multi-tenant: insert into tenant DB ──────────────────────────────────
  if (user.databaseName && process.env.MASTER_DATABASE_URL) {
    const tenantDb = getTenantDb(user.databaseName);
    await tenantDb.insert(sessions).values(sessionValues);
  } else {
    // ── Single-tenant: insert into default DB ───────────────────────────────
    await db.insert(sessions).values(sessionValues);
  }

  return { sessionId, expiresAt };
}

/**
 * Revoke the current session (logout).
 * Works in both single-tenant and multi-tenant modes.
 */
export async function revokeCurrentSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session-token")?.value;
    if (!token) return;

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const sessionId = (payload as { sessionId?: string }).sessionId;
    const user = (payload as { user?: SessionUser }).user;
    if (!sessionId) return;

    // Use tenant DB if multi-tenant, otherwise default DB
    if (user?.databaseName && process.env.MASTER_DATABASE_URL) {
      const tenantDb = getTenantDb(user.databaseName);
      await tenantDb
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.id, sessionId));
    } else {
      await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.id, sessionId));
    }
  } catch {
    // The cookie is cleared even when its token is already invalid.
  }
}

function getDeviceName(userAgent: string) {
  const browser = userAgent.match(/(Edg|Chrome|Firefox|Safari)\/?[\d.]*/)?.[1] || "Browser";
  const platform = userAgent.match(/(Windows|Mac OS X|Android|iPhone|Linux)/)?.[1] || "Device";
  return `${browser} on ${platform}`;
}

/**
 * Get the current session from the cookie.
 * Works in both single-tenant and multi-tenant modes.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Require authentication. Throws if not logged in.
 * Optionally restrict to specific roles.
 */
export async function requireAuth(allowedRoles?: Role[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    throw new Error("Forbidden");
  }
  return session;
}

/**
 * Validate a customer portal token.
 * In multi-tenant mode, uses the tenant DB from the current session context.
 * In single-tenant mode, uses the default DB.
 *
 * NOTE: Portal routes run without a session cookie (they're public),
 * so in multi-tenant mode the portal API reads the studio from
 * middleware headers instead.
 */
export async function validatePortalToken(token: string, databaseName?: string) {
  const queryDb =
    databaseName && process.env.MASTER_DATABASE_URL
      ? getTenantDb(databaseName)
      : db;

  const [customer] = await queryDb
    .select()
    .from(customers)
    .where(eq(customers.portalToken, token))
    .limit(1);

  return customer || null;
}
