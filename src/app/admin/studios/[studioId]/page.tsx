import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/admin-auth";
import { masterDb, studios, dnsRecords } from "@/lib/db/master";
import { StudioDetailClient } from "./studio-detail-client";

export default async function StudioDetailPage({
  params,
}: {
  params: Promise<{ studioId: string }>;
}) {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  const { studioId } = await params;

  const [studio] = await masterDb
    .select()
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);

  if (!studio) {
    redirect("/admin/studios");
  }

  // Get DNS records
  const records = await masterDb
    .select()
    .from(dnsRecords)
    .where(eq(dnsRecords.studioId, studioId));

  return <StudioDetailClient studio={studio} dnsRecords={records} />;
}
