import { redirect } from "next/navigation";
import { isOwnerAuthenticated } from "@/lib/tenant-registry/owner-auth";
import OwnerLoginForm from "./login-form";

export const runtime = "nodejs";

export default async function OwnerLoginPage() {
  if (await isOwnerAuthenticated()) {
    redirect("/owner");
  }

  return <OwnerLoginForm />;
}
