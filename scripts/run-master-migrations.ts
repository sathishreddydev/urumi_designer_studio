import { Client } from "pg";
import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";

dotenv.config({ path: process.env.ENV_FILE || ".env.local" });

const connectionString = process.env.MASTER_DATABASE_URL;
if (!connectionString) {
  console.error("MASTER_DATABASE_URL is not configured");
  process.exit(1);
}

async function runMasterMigrations() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _master_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ filename: string }>(
      "SELECT filename FROM _master_migrations"
    );
    const applied = new Set(rows.map((row) => row.filename));
    const migrationsDir = path.join(process.cwd(), "migrations", "master");
    const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();

    for (const filename of files) {
      if (applied.has(filename)) {
        console.log(`Skipping already-applied master migration: ${filename}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO _master_migrations (filename) VALUES ($1)",
          [filename]
        );
        await client.query("COMMIT");
        console.log(`Applied master migration: ${filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("Master database migrations are up to date.");
  } finally {
    await client.end();
  }
}

runMasterMigrations().catch((error: unknown) => {
  console.error("Master database migration failed:", error);
  process.exitCode = 1;
});
