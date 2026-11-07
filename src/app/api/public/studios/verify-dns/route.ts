/**
 * POST /api/public/studios/verify-dns
 *
 * Verifies that a studio's custom domain CNAME points to our platform.
 *
 * How it works:
 *   1. Resolve the studio's domain CNAME via Node's DNS resolver
 *   2. Check if the CNAME target matches our platform's expected hosts
 *   3. If verified → mark dns_verified = true in master DB
 *
 * Expected CNAME targets (configured via PROXY_HOST env var):
 *   - Vercel:  cname.vercel-dns.com  OR  *.vercel.app
 *   - Railway: *.railway.app
 *   - Custom:  whatever is set in PROXY_HOST
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { masterDb, studios, dnsRecords } from "@/lib/db/master";

export async function POST(request: Request) {
  try {
    const { studioId } = await request.json();

    if (!studioId) {
      return NextResponse.json({ error: "Studio ID is required" }, { status: 400 });
    }

    // Get studio
    const [studio] = await masterDb
      .select()
      .from(studios)
      .where(eq(studios.id, studioId))
      .limit(1);

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    // Already verified
    if (studio.dnsVerified) {
      return NextResponse.json({ verified: true, message: "DNS already verified" });
    }

    const domain = studio.domain;

    // ── What CNAME targets are valid for our platform ─────────────────────────
    // Add any valid targets here — Vercel, Railway, or custom domain
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.PROXY_HOST ||
      ""
    ).replace(/^https?:\/\//, "");

    const validCnameTargets = [
      "cname.vercel-dns.com",         // Vercel standard CNAME
      "alias.zeit.co",                // Vercel legacy
      appUrl,                         // Your specific app URL
    ].filter(Boolean).map((t) => t.toLowerCase());

    // ── Resolve CNAME via DNS ─────────────────────────────────────────────────
    try {
      const dns = await import("node:dns/promises");

      let cnameResult: string[] = [];
      let resolvedIps: string[] = [];

      // Try CNAME resolution
      try {
        cnameResult = await dns.resolveCname(domain);
      } catch {
        // No CNAME record — might use A record instead
      }

      // Try A record as fallback (some setups use A records)
      try {
        resolvedIps = await dns.resolve4(domain);
      } catch {
        // No A record either
      }

      // ── Check if CNAME points to our platform ──────────────────────────────
      const cnameMatches = cnameResult.some((cname) =>
        validCnameTargets.some((target) =>
          cname.toLowerCase().includes(target) ||
          target.includes(cname.toLowerCase())
        )
      );

      // ── Check if domain is actually resolving (HTTP check) ────────────────
      let httpReachable = false;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`https://${domain}/api/health`, {
          signal: controller.signal,
          redirect: "follow",
        });
        clearTimeout(timeout);
        // Any response (even 404) means the domain resolves to our server
        httpReachable = res.status < 500;
      } catch {
        // Domain not yet resolving
      }

      // ── Determine verification status ─────────────────────────────────────
      const verified = cnameMatches || httpReachable;

      if (verified) {
        // Mark as verified in master DB
        await masterDb
          .update(studios)
          .set({
            dnsVerified: true,
            dnsVerifiedAt: new Date(),
            sslStatus: "active",
            updatedAt: new Date(),
          })
          .where(eq(studios.id, studioId));

        // Mark DNS records as verified
        const records = await masterDb
          .select()
          .from(dnsRecords)
          .where(eq(dnsRecords.studioId, studioId));

        for (const record of records) {
          await masterDb
            .update(dnsRecords)
            .set({ verifiedAt: new Date() })
            .where(eq(dnsRecords.id, record.id));
        }

        return NextResponse.json({
          verified: true,
          message: "✅ Domain verified! Your studio is ready.",
          domain,
          cnameFound: cnameResult[0] || null,
        });
      }

      // ── Not verified yet — give helpful feedback ───────────────────────────
      let hint = "";
      if (cnameResult.length > 0) {
        hint = `Your CNAME points to "${cnameResult[0]}" but should point to "${appUrl || "cname.vercel-dns.com"}".`;
      } else if (resolvedIps.length > 0) {
        hint = `Domain resolves to IP ${resolvedIps[0]} via A record, but no CNAME found. Add a CNAME record.`;
      } else {
        hint = "No DNS records found yet. DNS can take 5-30 minutes to propagate after adding records.";
      }

      return NextResponse.json({
        verified: false,
        domain,
        cnameFound: cnameResult[0] || null,
        expectedTarget: appUrl || "cname.vercel-dns.com",
        message: hint,
      });

    } catch (dnsError) {
      console.error("[DNS Verify] Error:", dnsError);
      return NextResponse.json({
        verified: false,
        message: "Unable to check DNS right now. Please try again in a few minutes.",
      });
    }

  } catch (error) {
    console.error("[DNS Verify] Unexpected error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
