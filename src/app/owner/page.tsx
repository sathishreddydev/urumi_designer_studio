import { redirect } from "next/navigation";
import { isOwnerAuthenticated } from "@/lib/tenant-registry/owner-auth";
import { StudiosManager } from "./studios/studios-manager";

export const runtime = "nodejs";

export default async function OwnerPage() {
  if (!(await isOwnerAuthenticated())) {
    redirect("/owner/login");
  }

  return <StudiosManager />;
}
