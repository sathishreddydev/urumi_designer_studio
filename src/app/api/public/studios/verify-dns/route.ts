/**
 * POST /api/public/studios/verify-dns
 *
 * Verifies DNS records for a studio domain.
 * Checks if the CNAME record points to the platform proxy
 * and if the TXT verification record matches.
 *
 * Public endpoint — called from the setup wizard.
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

    if (studio.dnsVerified) {
      return NextResponse.json({
        verified: true,
        message: "DNS already verified",
      });
    }

    // Get DNS records for this studio
    const records = await masterDb
      .select()
      .from(dnsRecords)
      .where(eq(dnsRecords.studioId, studioId));

    if (records.length === 0) {
      return NextResponse.json({
        verified: false,
        error: "No DNS records found for this studio",
      });
    }

    // Try DNS resolution
    // Note: In production, use a proper DNS resolver library (dns2 or node-dns)
    // For now we do a simple HTTP check to see if the domain resolves
    const proxyHost = process.env.PROXY_HOST || "proxy.yourplatform.com";

    try {
      // Simple check: resolve the domain via DNS
      const domain = studio.domain;

      // Use Node's built-in DNS resolver
      const dns = await import("node:dns/promises");

      let cnameResult = null;
      try {
        cnameResult = await dns.resolveCname(domain);
      } catch {
        // CNAME might not exist yet
      }

      let txtResult = null;
      try {
        // Check TXT record for verification
        const txtName = records.find((r) => r.recordType === "TXT")?.recordName;
        if (txtName) {
          txtResult = await dns.resolveTxt(txtName);
        }
      } catch {
        // TXT might not exist yet
      }

      // Check if CNAME points to our proxy
      const cnameValid =
        cnameResult &&
        cnameResult.some((c) => c.includes(proxyHost) || c.includes("yourplatform"));

      // Check if TXT record matches
      const txtRecord = records.find((r) => r.recordType === "TXT");
      const txtValid =
        txtResult &&
        txtRecord &&
        txtResult.some((records: string[]) =>
          records.some((r) => r.includes(txtRecord.recordValue))
        );

      if (cnameValid && txtValid) {
        // DNS verified! Update studio
        await masterDb
          .update(studios)
          .set({
            dnsVerified: true,
            dnsVerifiedAt: new Date(),
            sslStatus: "pending", // Caddy will auto-provision SSL
          })
          .where(eq(studios.id, studioId));

        // Mark DNS records as verified
        for (const record of records) {
          await masterDb
            .update(dnsRecords)
            .set({ verifiedAt: new Date() })
            .where(eq(dnsRecords.id, record.id));
        }

        return NextResponse.json({
          verified: true,
          message: "DNS verified successfully! SSL certificate will be provisioned automatically.",
        });
      }

      // Not verified yet — return what's missing
      return NextResponse.json({
        verified: false,
        cnameValid: !!cnameValid,
        txtValid: !!txtValid,
        message: "DNS records not found yet. Please allow 5-10 minutes after adding records.",
      });
    } catch (dnsError) {
      return NextResponse.json({
        verified: false,
        error: "Unable to verify DNS at this time. Please try again in a few minutes.",
      });
    }
  } catch (error) {
    console.error("DNS verify error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
