import { redirect } from "next/navigation";
import { isOwnerAuthenticated } from "@/lib/tenant-registry/owner-auth";
import { StudiosManager } from "./studios-manager";

export const runtime = "nodejs";

export default async function OwnerStudiosPage() {
  if (!(await isOwnerAuthenticated())) {
    redirect("/owner/login");
  }

  return <StudiosManager />;
}
