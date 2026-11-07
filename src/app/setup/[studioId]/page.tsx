import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { masterDb, studios, dnsRecords } from "@/lib/db/master";
import { SetupWizard } from "./setup-wizard";

/**
 * Setup wizard page.
 * Shows DNS instructions, branding upload, and final steps.
 * Server component — fetches studio data, passes to client wizard.
 */
export default async function SetupPage({
  params,
}: {
  params: Promise<{ studioId: string }>;
}) {
  const { studioId } = await params;

  // Get studio from master DB
  const [studio] = await masterDb
    .select()
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);

  if (!studio) {
    redirect("/signup");
  }

  // Get DNS records for this studio
  const records = await masterDb
    .select()
    .from(dnsRecords)
    .where(eq(dnsRecords.studioId, studioId));

  // Build DNS instructions from the studio's actual domain
  // e.g. "studio.urumibymounika.com" → subdomain: "studio", rootDomain: "urumibymounika.com"
  const domainParts = studio.domain.split(".");
  const subdomain = domainParts.length > 2 ? domainParts[0] : "@";
  const rootDomain = domainParts.length > 2
    ? domainParts.slice(1).join(".")
    : studio.domain;

  // CNAME target — use the actual Vercel deployment URL
  // This is what customers point their CNAME to
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL    // auto-set by Vercel
    || process.env.NEXT_PUBLIC_APP_URL                            // manually set
    || process.env.PROXY_HOST                                     // fallback
    || "cname.vercel-dns.com";

  // Strip https:// if present
  const cnameTarget = vercelUrl.replace(/^https?:\/\//, "");

  const verificationToken =
    records.find((r) => r.recordType === "TXT")?.recordValue || "";

  return (
    <SetupWizard
      studio={{
        id: studio.id,
        domain: studio.domain,
        brandName: studio.brandName,
        businessEmail: studio.businessEmail,
        dnsVerified: studio.dnsVerified,
        planType: studio.planType,
        status: studio.status,
      }}
      dns={{
        proxyHost: cnameTarget,
        subdomain,
        rootDomain,
        verificationToken,
      }}
    />
  );
}
