import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { runWithTenantHost, TenantResolutionError } from "@/lib/tenant-registry/runtime";

export default async function Home() {
  const host = (await headers()).get("host");
  try {
    await runWithTenantHost(host, async () => {
      const session = await getSession();
      if (session) {
        redirect("/dashboard");
      }
      redirect("/login");
    });
  } catch (error) {
    if (error instanceof TenantResolutionError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
