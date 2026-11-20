import { headers } from "next/headers";
import { normalizeDomain } from "@/lib/tenant-registry/domain";
import { getStudioBranding, type StudioBranding } from "@/lib/tenant-registry/branding";
import { InactiveStudioPage } from "@/components/inactive-studio-page";
import LoginForm from "./login-form";

export const runtime = "nodejs";

export default async function LoginPage() {
  const host = (await headers()).get("host");
  let domain: string | null = null;

  if (host) {
    try {
      domain = normalizeDomain(host);
    } catch {
      domain = null;
    }
  }

  const branding: StudioBranding | null = domain ? await getStudioBranding(domain) : null;

  if (branding && !branding.active) {
    return <InactiveStudioPage branding={branding} />;
  }

  return <LoginForm branding={branding} />;
}
