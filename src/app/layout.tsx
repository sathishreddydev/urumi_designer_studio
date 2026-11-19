import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";
import { normalizeDomain } from "@/lib/tenant-registry/domain";
import { getStudioFaviconUrl, getStudioLogoUrl } from "@/lib/tenant-registry/logo";
import { queryMaster } from "@/lib/tenant-registry/db";

const inter = Inter({ subsets: ["latin"] });
const defaultStudioName = "urumi by mounika";

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host");
  if (!host) {
    return { title: defaultStudioName };
  }

  let domain: string;
  try {
    domain = normalizeDomain(host);
  } catch {
    return { title: defaultStudioName };
  }

  const { rows } = await queryMaster<{
    name: string;
    logo_url: string;
    logo_data: Buffer | null;
    favicon_data: Buffer | null;
  }>(
    `SELECT name, logo_url, logo_data, favicon_data
     FROM tenant_registry_studios
     WHERE domain = $1
     LIMIT 1`,
    [domain]
  );
  const studioName = rows[0]?.name || defaultStudioName;
  const studioLogo = rows[0]
    ? getStudioLogoUrl(rows[0].logo_url, rows[0].logo_data)
    : null;
  const studioFavicon = getStudioFaviconUrl(rows[0]?.favicon_data);

  return {
    title: studioName,
    description: `${studioName} - Custom Outfit Design & Production Workflow`,
    icons: {
      icon: studioFavicon || studioLogo || "/favicon.png",
      apple: studioLogo || "/favicon.png",
    },
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
