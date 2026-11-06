/**
 * Seed First Studio
 *
 * Registers the existing "Urumi by Mounika" studio into the master database.
 * Run this after setup-master-db.ts
 *
 * Usage: npx tsx scripts/seed-first-studio.ts
 */

import * as dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: ".env.local" });

async function main() {
  const masterUrl = process.env.MASTER_DATABASE_URL;
  const existingDbUrl = process.env.DATABASE_URL;

  if (!masterUrl) {
    console.error("❌  MASTER_DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  if (!existingDbUrl) {
    console.error("❌  DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  console.log("🔌  Connecting to master database...");
  const pool = new Pool({ connectionString: masterUrl });

  try {
    await pool.query("SELECT 1");
    console.log("✅  Connected");

    // Extract existing database name from DATABASE_URL
    const dbUrl = new URL(existingDbUrl);
    const existingDatabaseName = dbUrl.pathname.replace("/", "");

    // Studio details for Urumi by Mounika
    const studioId = `stu_urumi001`;
    const domain = process.env.URUMI_DOMAIN || "localhost";

    // Check if already seeded
    const existing = await pool.query(
      "SELECT id FROM studios WHERE id = $1",
      [studioId]
    );

    if (existing.rows.length > 0) {
      console.log("ℹ️   Urumi studio already exists in master database. Skipping.");
      return;
    }

    await pool.query(
      `INSERT INTO studios (
        id, domain, database_name, status,
        brand_name, business_name, business_email,
        timezone, currency, plan_type,
        cloudinary_cloud_name, cloudinary_api_key,
        cloudinary_account_type, dns_verified, ssl_status,
        features
      ) VALUES (
        $1, $2, $3, 'active',
        'urumi by mounika', 'urumi by mounika', $4,
        'Asia/Kolkata', 'INR', 'premium',
        $5, $6,
        'own', TRUE, 'active',
        '{"whatsappIntegration": false, "instagramFeed": false, "customerPortal": true, "aiMeasurements": true, "customReports": false}'
      )`,
      [
        studioId,
        domain,
        existingDatabaseName,
        process.env.URUMI_EMAIL || "admin@urumi.com",
        process.env.CLOUDINARY_CLOUD_NAME || null,
        process.env.CLOUDINARY_API_KEY || null,
      ]
    );

    console.log(`✅  Urumi studio registered in master database`);
    console.log(`    Studio ID:     ${studioId}`);
    console.log(`    Domain:        ${domain}`);
    console.log(`    Database:      ${existingDatabaseName}`);
    console.log("\n✅  Done! The existing Urumi studio is now managed by the master database.");

  } catch (error) {
    console.error("❌  Error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
