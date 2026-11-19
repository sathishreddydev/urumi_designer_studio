import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { queryMaster } from "@/lib/tenant-registry/db";

export const OWNER_COOKIE_NAME = "owner-token";
const OWNER_SESSION_SECONDS = 8 * 60 * 60;

interface OwnerRow {
  email: string;
  password_hash: string;
}

function getJwtSecret(): Uint8Array {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

export async function getOwnerAccount(email: string) {
  const { rows } = await queryMaster<OwnerRow>(
    `SELECT email, password_hash
     FROM tenant_registry_owners
     WHERE email = $1
     LIMIT 1`,
    [email]
  );
  const owner = rows[0];
  return owner ? { email: owner.email, passwordHash: owner.password_hash } : null;
}

export async function createOwnerToken(email: string): Promise<string> {
  return new SignJWT({ purpose: "owner-session" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(`${OWNER_SESSION_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function isOwnerAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(OWNER_COOKIE_NAME)?.value;
  if (!token) return false;

  let email: string;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.purpose !== "owner-session" || typeof payload.sub !== "string") {
      return false;
    }
    email = payload.sub;
  } catch {
    return false;
  }

  return (await getOwnerAccount(email)) !== null;
}

export function ownerCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: OWNER_SESSION_SECONDS,
    path: "/",
  };
}
