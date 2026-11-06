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

  // Build the DNS instructions
  const proxyHost = process.env.PROXY_HOST || "proxy.yourplatform.com";
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
        proxyHost,
        verificationToken,
      }}
    />
  );
}
