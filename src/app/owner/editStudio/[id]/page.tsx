import { redirect } from "next/navigation";
import { isOwnerAuthenticated } from "@/lib/tenant-registry/owner-auth";
import { StudioForm } from "../../studio-form";

export const runtime = "nodejs";

export default async function EditStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isOwnerAuthenticated())) {
    redirect("/owner/login");
  }

  const { id } = await params;
  return <StudioForm studioId={id} />;
}
