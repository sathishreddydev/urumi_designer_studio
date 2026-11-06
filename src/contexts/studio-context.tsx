"use client";

/**
 * Studio Context
 *
 * Provides studio branding & settings to all client components.
 * The context is populated in the root layout from headers set by middleware.
 *
 * Usage in any client component:
 *   const { studio } = useStudio();
 *   <img src={studio.logoUrl} alt={studio.brandName} />
 */

import { createContext, useContext } from "react";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface StudioFeatures {
  whatsappIntegration?: boolean;
  instagramFeed?: boolean;
  customerPortal?: boolean;
  aiMeasurements?: boolean;
  customReports?: boolean;
}

export interface StudioBranding {
  id: string;
  domain: string;
  databaseName: string;
  status: "trial" | "active" | "suspended" | "cancelled";

  // Branding
  brandName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  customCss: string | null;

  // Business info
  businessName: string | null;
  businessEmail: string | null;
  businessPhone: string | null;
  businessAddress: string | null;

  // Locale
  timezone: string;
  currency: string;

  // Subscription
  planType: "trial" | "basic" | "premium" | "enterprise";

  // Features
  features: StudioFeatures;

  // Cloudinary
  cloudinaryAccountType: "shared" | "own";
  cloudinaryCloudName: string | null;
  cloudinaryApiKey: string | null;
}

// ─── DEFAULT (SINGLE TENANT FALLBACK) ────────────────────────────────────────
// Used when MASTER_DATABASE_URL is not set (single-tenant / development mode)

export const DEFAULT_STUDIO: StudioBranding = {
  id: "stu_default",
  domain: "localhost",
  databaseName: process.env.NEXT_PUBLIC_DEFAULT_DB_NAME || "default",
  status: "active",

  brandName: "urumi by mounika",
  logoUrl: null,
  faviconUrl: "/favicon.png",
  primaryColor: null,
  secondaryColor: null,
  customCss: null,

  businessName: "urumi by mounika",
  businessEmail: null,
  businessPhone: null,
  businessAddress: null,

  timezone: "Asia/Kolkata",
  currency: "INR",
  planType: "premium",

  features: {
    whatsappIntegration: false,
    instagramFeed: false,
    customerPortal: true,
    aiMeasurements: true,
    customReports: false,
  },

  cloudinaryAccountType: "own",
  cloudinaryCloudName: null,
  cloudinaryApiKey: null,
};

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

interface StudioContextValue {
  studio: StudioBranding;
}

const StudioContext = createContext<StudioContextValue>({
  studio: DEFAULT_STUDIO,
});

// ─── PROVIDER ─────────────────────────────────────────────────────────────────

export function StudioProvider({
  studio,
  children,
}: {
  studio: StudioBranding;
  children: React.ReactNode;
}) {
  return (
    <StudioContext.Provider value={{ studio }}>
      {children}
    </StudioContext.Provider>
  );
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export function useStudio(): StudioBranding {
  return useContext(StudioContext).studio;
}

/**
 * Returns true if a specific feature is enabled for the current studio.
 * Usage: const hasWhatsApp = useFeature("whatsappIntegration");
 */
export function useFeature(feature: keyof StudioFeatures): boolean {
  const studio = useStudio();
  return studio.features[feature] === true;
}
