import { redirect } from "next/navigation";
import { isOwnerAuthenticated } from "@/lib/tenant-registry/owner-auth";
import { StudioForm } from "../studio-form";

export const runtime = "nodejs";

export default async function NewStudioPage() {
  if (!(await isOwnerAuthenticated())) {
    redirect("/owner/login");
  }

  return <StudioForm />;
}
