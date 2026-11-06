import { z } from "zod";

/**
 * Validation schemas for studio registration & management.
 */

export const studioRegisterSchema = z.object({
  // Step 1: Business info
  businessName: z
    .string()
    .min(2, "Business name is required")
    .max(100, "Business name is too long"),

  ownerName: z
    .string()
    .min(2, "Owner name is required")
    .max(100, "Owner name is too long"),

  email: z.string().email("Valid business email is required"),

  phone: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 7, "Phone number is too short"),

  // Step 2: Domain (full domain — any provider)
  desiredDomain: z
    .string()
    .min(3, "Domain is required")
    .max(253, "Domain is too long"),

  // Step 3: Admin account
  adminName: z.string().min(2, "Admin name is required"),
  adminEmail: z.string().email("Valid admin email is required"),
  adminPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password is too long"),

  // Step 4: Plan
  planType: z.enum(["trial", "basic", "premium"]),
});

export type StudioRegisterInput = z.infer<typeof studioRegisterSchema>;

/**
 * Check if a subdomain is available (used by the check-domain endpoint).
 */
export const checkDomainSchema = z.object({
  domain: z
    .string()
    .min(2, "Domain is required")
    .max(63, "Domain is too long")
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/i, "Invalid domain format"),
});

/**
 * Update studio branding.
 */
export const updateBrandingSchema = z.object({
  brandName: z.string().min(2).max(100).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  faviconUrl: z.string().url().optional().or(z.literal("")),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "Invalid color format")
    .optional()
    .or(z.literal("")),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "Invalid color format")
    .optional()
    .or(z.literal("")),
  businessEmail: z.string().email().optional().or(z.literal("")),
  businessPhone: z.string().optional(),
  businessAddress: z.string().optional(),
});

/**
 * Save Cloudinary credentials for a studio.
 */
export const updateCloudinarySchema = z.object({
  cloudinaryCloudName: z.string().min(1, "Cloud name is required"),
  cloudinaryApiKey: z.string().min(1, "API key is required"),
  cloudinaryApiSecret: z.string().min(1, "API secret is required"),
});

/**
 * Update studio features (feature flags).
 */
export const updateFeaturesSchema = z.object({
  features: z.object({
    whatsappIntegration: z.boolean().optional(),
    instagramFeed: z.boolean().optional(),
    customerPortal: z.boolean().optional(),
    aiMeasurements: z.boolean().optional(),
    customReports: z.boolean().optional(),
  }),
});
