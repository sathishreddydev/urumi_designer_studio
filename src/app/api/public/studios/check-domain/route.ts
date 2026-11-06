/**
 * GET /api/public/studios/check-domain?domain=elitestudio
 *
 * Checks if a desired subdomain is available.
 * Public endpoint — no auth required.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { masterDb, studios } from "@/lib/db/master";
import { checkDomainSchema } from "@/lib/validations-studio";

// Reserved words that cannot be used as subdomains
const RESERVED = [
  "admin", "api", "www", "mail", "ftp", "localhost",
  "support", "help", "blog", "app", "dashboard",
  "login", "signup", "portal", "staging", "test",
  "demo", "dev", "platform", "yourplatform",
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain") || "";

    const parsed = checkDomainSchema.safeParse({ domain });
    if (!parsed.success) {
      return NextResponse.json(
        { available: false, error: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const subdomain = parsed.data.domain.toLowerCase();

    // Check reserved words
    if (RESERVED.includes(subdomain)) {
      return NextResponse.json({
        available: false,
        reason: "This name is reserved and cannot be used",
      });
    }

    // Build full domain (e.g. designer.elitestudio.com)
    const baseDomain = process.env.PLATFORM_BASE_DOMAIN || "yourplatform.com";
    const fullDomain = `designer.${subdomain}.${baseDomain}`;

    // Check master database
    const existing = await masterDb
      .select({ id: studios.id })
      .from(studios)
      .where(eq(studios.domain, fullDomain))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({
        available: false,
        reason: "This domain is already taken",
      });
    }

    return NextResponse.json({
      available: true,
      domain: fullDomain,
    });
  } catch (error) {
    console.error("Check domain error:", error);
    return NextResponse.json(
      { available: false, error: "Unable to check domain" },
      { status: 500 }
    );
  }
}
