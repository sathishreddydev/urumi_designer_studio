import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { StudioProvider } from "@/contexts/studio-context";
import { getStudio } from "@/lib/multi-tenant/studio";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

// ─── DYNAMIC METADATA ─────────────────────────────────────────────────────────
// Next.js calls this on every request (server-side), so each studio
// gets its own title, description and favicon in the browser tab.

export async function generateMetadata(): Promise<Metadata> {
  const studio = await getStudio();

  return {
    title: studio.brandName,
    description: `${studio.brandName} — Custom Outfit Design & Production Workflow`,
    icons: {
      icon: studio.faviconUrl || "/favicon.png",
      apple: studio.faviconUrl || "/favicon.png",
    },
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// ─── ROOT LAYOUT ──────────────────────────────────────────────────────────────

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const studio = await getStudio();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* CSS variables — available as var(--studio-primary) everywhere */}
        <style>{`
          :root {
            --studio-primary: ${studio.primaryColor ?? "hsl(var(--primary))"};
            --studio-secondary: ${studio.secondaryColor ?? "hsl(var(--muted-foreground))"};
          }
        `}</style>

        {/* Per-studio custom CSS (premium plan only) */}
        {studio.customCss && (
          <style
            dangerouslySetInnerHTML={{ __html: studio.customCss }}
          />
        )}
      </head>
      <body className={inter.className}>
        {/* StudioProvider makes branding available to all client components */}
        <StudioProvider studio={studio}>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </StudioProvider>
      </body>
    </html>
  );
}
