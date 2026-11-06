/**
 * POST /api/public/studios/register
 *
 * Creates a new studio (tenant):
 *  1. Validates input
 *  2. Checks domain availability
 *  3. Inserts studio record in master DB
 *  4. Creates a new PostgreSQL database for the tenant
 *  5. Runs all migrations on the new database
 *  6. Creates the admin user in the tenant DB
 *  7. Creates DNS verification record
 *  8. Returns setup URL
 *
 * Public endpoint — no auth required (this IS the signup).
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { masterDb, studios, dnsRecords, masterAuditLogs } from "@/lib/db/master";
import { studioRegisterSchema } from "@/lib/validations-studio";
import { generatePrefixedId } from "@/lib/id";
import {
  createTenantDatabase,
  runTenantMigrations,
  getTenantDb,
} from "@/lib/multi-tenant/database-manager";
import { users } from "@/lib/db/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = studioRegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Normalize
    const fullDomain = data.desiredDomain.toLowerCase().trim();
    const businessEmail = data.email.toLowerCase().trim();

    // Check domain AND business email are both unique (parallel)
    const [existingDomain, existingEmail] = await Promise.all([
      masterDb
        .select({ id: studios.id })
        .from(studios)
        .where(eq(studios.domain, fullDomain))
        .limit(1),
      masterDb
        .select({ id: studios.id })
        .from(studios)
        .where(eq(studios.businessEmail, businessEmail))
        .limit(1),
    ]);

    if (existingDomain.length > 0) {
      return NextResponse.json(
        { error: "This domain is already registered. Please use a different one." },
        { status: 409 }
      );
    }

    if (existingEmail.length > 0) {
      return NextResponse.json(
        { error: "A studio is already registered with this email address." },
        { status: 409 }
      );
    }

    // 3. Generate IDs
    const studioId = generatePrefixedId("stu");
    // Build a safe database name from domain (strip non-alphanumeric)
    const safeName = fullDomain.replace(/[^a-z0-9]/g, "_").slice(0, 30);
    const databaseName = `studio_${safeName}_${studioId.replace("stu_", "").toLowerCase()}`;

    // 5. Calculate trial end date
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    // 6. Insert studio record in master database
    await masterDb.insert(studios).values({
      id: studioId,
      domain: fullDomain,
      databaseName,
      status: data.planType === "trial" ? "trial" : "active",
      brandName: data.businessName,
      businessName: data.businessName,
      businessEmail: businessEmail,
      businessPhone: data.phone || null,
      timezone: "Asia/Kolkata",
      currency: "INR",
      planType: data.planType,
      trialEndsAt: data.planType === "trial" ? trialEndsAt : null,
      dnsVerified: false,
      sslStatus: "pending",
      cloudinaryAccountType: "shared", // Start with shared Cloudinary
    });

    // 7. Create the tenant database
    console.log(`[Register] Creating database: ${databaseName}`);
    await createTenantDatabase(databaseName);

    // 8. Run migrations on the new database
    console.log(`[Register] Running migrations on: ${databaseName}`);
    try {
      await runTenantMigrations(databaseName);
    } catch (migrationError) {
      console.error(`[Register] Migration failed for ${databaseName}:`, migrationError);
      // Don't fail the whole registration — studio can be migrated later
    }

    // 9. Create admin user in the tenant database
    console.log(`[Register] Creating admin user in: ${databaseName}`);
    try {
      const tenantDb = getTenantDb(databaseName);
      const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

      await tenantDb.insert(users).values({
        name: data.adminName,
        email: data.adminEmail.toLowerCase(),
        password: hashedPassword,
        role: "ADMIN",
        active: true,
      });
    } catch (userError) {
      console.error(`[Register] Failed to create admin user:`, userError);
      // Don't fail the whole registration — admin can be created later
    }

    // 10. Create DNS verification record
    const verificationToken = generateVerificationToken();
    await masterDb.insert(dnsRecords).values({
      studioId,
      domain: fullDomain,
      recordType: "TXT",
      recordName: `_studio-verify.${fullDomain}`,
      recordValue: verificationToken,
    });

    // 11. Log the registration in master audit logs (best-effort)
    try {
      const auditId = generatePrefixedId("mal");
      await masterDb.insert(masterAuditLogs).values({
        id: auditId,
        studioId,
        action: "studio.created",
        entityType: "studio",
        entityId: studioId,
        details: { domain: fullDomain, plan: data.planType },
      });
    } catch {
      // Audit log is best-effort — don't fail registration
    }

    console.log(`[Register] Studio created successfully: ${studioId} (${fullDomain})`);

    // 12. Return success with setup URL
    const setupUrl = `/setup/${studioId}`;

    return NextResponse.json({
      success: true,
      studioId,
      domain: fullDomain,
      databaseName,
      setupUrl,
      message: "Studio created successfully!",
    });
  } catch (error) {
    console.error("[Register] Error:", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}

function generateVerificationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
