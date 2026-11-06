/**
 * Cloudinary Multi-Tenant Config Resolver
 *
 * Returns the correct Cloudinary credentials for the current studio:
 *
 *   - Multi-tenant mode: reads studio credentials from master DB
 *     (the API secret is encrypted at rest, decrypted here)
 *   - Single-tenant mode: reads from process.env (existing behavior)
 *
 * Usage in API routes:
 *   const config = await getCloudinaryConfig();
 *   if (config) {
 *     // upload using config.cloudName, config.apiKey, config.apiSecret
 *   }
 */

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { masterDb, studios } from "@/lib/db/master";
import { decrypt } from "@/lib/encryption";
import { resolveStudioFromHeaders } from "@/lib/multi-tenant/domain-resolver";

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
  accountType: "shared" | "own";
}

/**
 * Get the Cloudinary config for the current request's studio.
 *
 * Returns null if Cloudinary is not configured for this studio
 * (falls back to local storage in upload routes).
 */
export async function getCloudinaryConfig(): Promise<CloudinaryConfig | null> {
  // ── Single-tenant mode: use env vars ──────────────────────────────────────
  if (!process.env.MASTER_DATABASE_URL) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) return null;

    return {
      cloudName,
      apiKey,
      apiSecret,
      folder: "urumi-by-mounika",
      accountType: "own",
    };
  }

  // ── Multi-tenant mode: read studio from headers ────────────────────────────
  const headersList = await headers();
  const studio = resolveStudioFromHeaders(headersList);

  if (!studio) return null;

  // If studio uses shared account → use platform env vars
  if (studio.cloudinaryAccountType === "shared") {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) return null;

    return {
      cloudName,
      apiKey,
      apiSecret,
      // Use studio-specific folder within shared account
      folder: `studios/${studio.id}`,
      accountType: "shared",
    };
  }

  // If studio uses own account → read from master DB (need to decrypt secret)
  if (studio.cloudinaryAccountType === "own") {
    // The headers don't include the API secret for security.
    // Query master DB to get the encrypted secret.
    const [studioRow] = await masterDb
      .select({
        cloudName: studios.cloudinaryCloudName,
        apiKey: studios.cloudinaryApiKey,
        apiSecret: studios.cloudinaryApiSecret,
      })
      .from(studios)
      .where(eq(studios.id, studio.id))
      .limit(1);

    if (!studioRow || !studioRow.cloudName || !studioRow.apiKey || !studioRow.apiSecret) {
      return null;
    }

    // Decrypt the API secret
    let decryptedSecret: string;
    try {
      decryptedSecret = decrypt(studioRow.apiSecret);
    } catch {
      console.error(`[Cloudinary] Failed to decrypt API secret for studio ${studio.id}`);
      return null;
    }

    return {
      cloudName: studioRow.cloudName,
      apiKey: studioRow.apiKey,
      apiSecret: decryptedSecret,
      // For own accounts, use a simple folder (their account, their files)
      folder: "studio-uploads",
      accountType: "own",
    };
  }

  return null;
}

/**
 * Validates Cloudinary credentials by making a test API call.
 * Used in the admin panel when a studio saves their Cloudinary config.
 */
export async function validateCloudinaryCredentials(
  cloudName: string,
  apiKey: string,
  apiSecret: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/image?max_results=1`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    if (res.ok) {
      return { valid: true };
    } else if (res.status === 401) {
      return { valid: false, error: "Invalid API key or secret" };
    } else if (res.status === 404) {
      return { valid: false, error: "Cloud name not found" };
    } else {
      return { valid: false, error: "Unable to verify credentials" };
    }
  } catch {
    return { valid: false, error: "Connection failed — check your network" };
  }
}
