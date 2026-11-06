/**
 * Super Admin Authentication
 *
 * Separate from studio user auth. Uses admin_users table in master DB.
 * JWT token is stored in a separate cookie ("admin-token") so studio
 * and admin sessions don't conflict.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { masterDb, adminUsers } from "@/lib/db/master";
import { generatePrefixedId } from "@/lib/id";

const ADMIN_COOKIE_NAME = "admin-token";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export type AdminRole = "super_admin" | "support" | "billing";

export interface AdminSession {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

/**
 * Sign in an admin user and set the cookie.
 */
export async function signInAdmin(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const [admin] = await masterDb
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email.toLowerCase()))
    .limit(1);

  if (!admin || !admin.active) {
    return { success: false, error: "Invalid credentials" };
  }

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) {
    return { success: false, error: "Invalid credentials" };
  }

  const token = await new SignJWT({
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    },
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .setIssuedAt()
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60, // 24 hours
    path: "/",
  });

  return { success: true };
}

/**
 * Sign out admin — clear the cookie.
 */
export async function signOutAdmin(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

/**
 * Get the current admin session from the cookie.
 * Returns null if not logged in or token is invalid.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const admin = (payload as { admin?: AdminSession }).admin;
    return admin || null;
  } catch {
    return null;
  }
}

/**
 * Require admin auth — throws if not authenticated.
 * Use in server components and API routes.
 */
export async function requireAdmin(allowedRoles?: AdminRole[]): Promise<AdminSession> {
  const admin = await getAdminSession();
  if (!admin) {
    throw new Error("Admin unauthorized");
  }
  if (allowedRoles && !allowedRoles.includes(admin.role)) {
    throw new Error("Admin forbidden");
  }
  return admin;
}

/**
 * Create a new admin user.
 */
export async function createAdminUser(
  email: string,
  password: string,
  name: string,
  role: AdminRole = "support"
): Promise<string> {
  const id = generatePrefixedId("adm");
  const hashed = await bcrypt.hash(password, 12);

  await masterDb.insert(adminUsers).values({
    id,
    email: email.toLowerCase(),
    password: hashed,
    name,
    role,
    active: true,
  });

  return id;
}
