/**
 * Setup Master Database
 *
 * Run this ONCE to create the master database schema.
 * Usage:  npx tsx scripts/setup-master-db.ts
 *
 * Prerequisites:
 *   - MASTER_DATABASE_URL set in .env.local
 *   - PostgreSQL running
 */

import * as dotenv from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

dotenv.config({ path: ".env.local" });

async function main() {
  const masterUrl = process.env.MASTER_DATABASE_URL;
  if (!masterUrl) {
    console.error("❌  MASTER_DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  console.log("🔌  Connecting to master database...");
  const pool = new Pool({
    connectionString: masterUrl,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  try {
    // Test connection
    await pool.query("SELECT 1");
    console.log("✅  Connected to master database");

    // Read the migration SQL
    const sqlPath = join(process.cwd(), "migrations", "master", "0001_create_master_schema.sql");
    const sql = readFileSync(sqlPath, "utf-8");

    console.log("🚀  Running master schema migration...");
    await pool.query(sql);
    console.log("✅  Master schema created successfully!");

    // Seed a default super admin
    const adminEmail = process.env.ADMIN_EMAIL || "admin@yourplatform.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123"; // Change in production!

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Check if admin already exists
    const existing = await pool.query(
      "SELECT id FROM admin_users WHERE email = $1",
      [adminEmail]
    );

    if (existing.rows.length === 0) {
      const id = `adm_${Math.random().toString(36).substring(2, 10)}`;
      await pool.query(
        `INSERT INTO admin_users (id, email, password, name, role)
         VALUES ($1, $2, $3, 'Super Admin', 'super_admin')`,
        [id, adminEmail, hashedPassword]
      );
      console.log(`✅  Super admin created: ${adminEmail}`);
      console.log(`    Password: ${adminPassword}`);
      console.log(`    ⚠️  Change this password in production!`);
    } else {
      console.log(`ℹ️   Super admin already exists: ${adminEmail}`);
    }

    console.log("\n✅  Master database setup complete!");
    console.log("\nNext step: Seed your first studio (existing Urumi studio)");
    console.log("Run: npx tsx scripts/seed-first-studio.ts");

  } catch (error) {
    console.error("❌  Error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
