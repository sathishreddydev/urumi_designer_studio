import { redirect } from "next/navigation";
import { isOwnerAuthenticated } from "@/lib/tenant-registry/owner-auth";
import { OwnerAccountForm } from "./owner-account-form";

export const runtime = "nodejs";

export default async function OwnerAccountPage() {
  if (!(await isOwnerAuthenticated())) {
    redirect("/owner/login");
  }

  return <OwnerAccountForm />;
}
