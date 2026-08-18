import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

const envFile = process.env.ENV_FILE || ".env.local";
dotenv.config({ path: envFile });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(`❌ DATABASE_URL not found in ${envFile}`);
  process.exit(1);
}

const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");

async function runMigrations() {
  const client = new Client({ connectionString: DATABASE_URL });

  console.log(`\n🔌 Connecting to database (${envFile})...`);
  await client.connect();

  // Create migrations tracking table if it doesn't exist
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);

  // Get already-applied migrations
  const { rows: applied } = await client.query(
    "SELECT filename FROM _migrations ORDER BY filename"
  );
  const appliedSet = new Set(applied.map((r: { filename: string }) => r.filename));

  // Get all SQL migration files, sorted
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`\n📂 Found ${files.length} migration file(s)`);

  let ran = 0;
  let skipped = 0;

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  ⏭️  Skipping (already applied): ${file}`);
      skipped++;
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, "utf-8");

    console.log(`\n  ▶️  Applying: ${file}`);
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO _migrations (filename) VALUES ($1)",
        [file]
      );
      console.log(`  ✅ Done: ${file}`);
      ran++;
    } catch (err: unknown) {
      console.error(`  ❌ Failed: ${file}`);
      console.error(err instanceof Error ? err.message : String(err));
      await client.end();
      process.exit(1);
    }
  }

  console.log(`\n✅ Migrations complete. Applied: ${ran}, Skipped: ${skipped}\n`);
  await client.end();
}

runMigrations().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
