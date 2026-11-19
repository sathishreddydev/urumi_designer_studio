import { redirect } from "next/navigation";
import { isOwnerAuthenticated } from "@/lib/tenant-registry/owner-auth";
import { StudiosList } from "./studios/studios-list";

export const runtime = "nodejs";

export default async function OwnerPage() {
  if (!(await isOwnerAuthenticated())) {
    redirect("/owner/login");
  }

  return <StudiosList />;
}
