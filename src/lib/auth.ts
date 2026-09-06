import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { and, eq, isNull, gt } from "drizzle-orm";
import { db } from "./db";
import { customers, sessions } from "./db/schema";
import { generatePrefixedId } from "./id";

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
  sessionId?: string; // current session token ID
}

export async function createToken(user: SessionUser, sessionId: string): Promise<string> {
  return new SignJWT({ user, sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const sessionId = (payload as { sessionId?: string }).sessionId;
    const user = (payload as { user?: SessionUser }).user;
    if (!user) return null;

    // Keep tokens issued before persisted sessions were introduced valid until they expire.
    // New logins always include a session ID and can be revoked by an administrator.
    if (!sessionId) return user;

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

export async function createSession(user: SessionUser, request: Request) {
  const sessionId = generatePrefixedId("ses");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const userAgent = request.headers.get("user-agent") || "Unknown browser";
  const forwardedFor = request.headers.get("x-forwarded-for");
  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    deviceName: getDeviceName(userAgent),
    userAgent,
    ipAddress: forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip"),
    expiresAt,
  });
  return { sessionId, expiresAt };
}

export async function revokeCurrentSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session-token")?.value;
    if (!token) return;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const sessionId = (payload as { sessionId?: string }).sessionId;
    if (sessionId) await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
  } catch {
    // The cookie is cleared even when its token is already invalid.
  }
}

function getDeviceName(userAgent: string) {
  const browser = userAgent.match(/(Edg|Chrome|Firefox|Safari)\/?[\d.]*/)?.[1] || "Browser";
  const platform = userAgent.match(/(Windows|Mac OS X|Android|iPhone|Linux)/)?.[1] || "Device";
  return `${browser} on ${platform}`;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

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

export async function validatePortalToken(token: string) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.portalToken, token))
    .limit(1);

  return customer || null;
}
