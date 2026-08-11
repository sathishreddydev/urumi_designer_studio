import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import { users, measurementTemplates } from "../src/lib/db/schema";
import { generatePrefixedId } from "../src/lib/id";

dotenv.config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function main() {
  console.log("🌱 Seeding Designer Studio database...\n");

  // Create default users
  const adminPassword = await bcrypt.hash("admin123", 10);
  const receptionPassword = await bcrypt.hash("reception123", 10);
  const designerPassword = await bcrypt.hash("designer123", 10);
  const masterPassword = await bcrypt.hash("master123", 10);

  await db
    .insert(users)
    .values([
      { name: "Admin", email: "admin@studio.com", password: adminPassword, role: "ADMIN" },
      { name: "Reception", email: "reception@studio.com", password: receptionPassword, role: "RECEPTION" },
      { name: "Priya Designer", email: "designer@studio.com", password: designerPassword, role: "DESIGNER" },
      { name: "Raju Master", email: "master@studio.com", password: masterPassword, role: "MASTER" },
    ])
    .onConflictDoNothing();

  console.log("✅ Users created");

  // Create measurement templates
  await db
    .insert(measurementTemplates)
    .values([
      {
        name: "Blouse",
        type: "Blouse",
        fields: ["Bust", "Waist", "Hip", "Shoulder", "Arm Length", "Arm Circumference", "Neck Front", "Neck Back", "Front Length", "Back Length", "Cross Front", "Cross Back"],
      },
      {
        name: "Lehenga",
        type: "Lehenga",
        fields: ["Waist", "Hip", "Length", "Flare", "Cancan Required"],
      },
      {
        name: "Gown",
        type: "Gown",
        fields: ["Bust", "Waist", "Hip", "Shoulder", "Full Length", "Arm Length", "Neck Style", "Train Length"],
      },
      {
        name: "Kurta",
        type: "Kurta",
        fields: ["Bust", "Waist", "Hip", "Shoulder", "Length", "Arm Length", "Neck Depth"],
      },
    ])
    .onConflictDoNothing();

  console.log("✅ Measurement templates created");

  console.log("\n🎉 Seeding complete!");
  console.log("\n📋 Default credentials:");
  console.log("  Admin:     admin@studio.com / admin123");
  console.log("  Reception: reception@studio.com / reception123");
  console.log("  Designer:  designer@studio.com / designer123");
  console.log("  Master:    master@studio.com / master123");
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    pool.end();
    process.exit(1);
  });
