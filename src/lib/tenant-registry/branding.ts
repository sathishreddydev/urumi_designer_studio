import { getStudioLogoUrl } from "@/lib/tenant-registry/logo-data";
import { queryMaster } from "@/lib/tenant-registry/db";

interface BrandingRow {
  name: string;
  logo_url: string;
  logo_data: Buffer | null;
  active: boolean;
}

export interface StudioBranding {
  name: string;
  logoUrl: string;
  active: boolean;
}

export async function getStudioBranding(domain: string): Promise<StudioBranding | null> {
  const { rows } = await queryMaster<BrandingRow>(
    "SELECT name, logo_url, logo_data, active FROM tenant_registry_studios WHERE domain = $1 LIMIT 1",
    [domain]
  );
  const studio = rows[0];
  if (!studio) return null;

  return {
    name: studio.name,
    logoUrl: getStudioLogoUrl(studio.logo_url, studio.logo_data),
    active: studio.active,
  };
}
