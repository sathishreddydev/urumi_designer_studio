import { Client } from "pg";
import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function run() {
  const connectionString = process.env.MASTER_DATABASE_URL;
  if (!connectionString) { console.error("MASTER_DATABASE_URL not set"); process.exit(1); }

  const client = new Client({
    connectionString: connectionString.replace("sslmode=require", "sslmode=verify-full"),
    ssl: { rejectUnauthorized: true },
  });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _master_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const { rows } = await client.query<{ filename: string }>("SELECT filename FROM _master_migrations");
    const applied = new Set(rows.map((r) => r.filename));
    const dir = path.join(process.cwd(), "migrations", "master");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

    for (const filename of files) {
      if (applied.has(filename)) { console.log(`Skip: ${filename}`); continue; }
      const sql = fs.readFileSync(path.join(dir, filename), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _master_migrations (filename) VALUES ($1)", [filename]);
        await client.query("COMMIT");
        console.log(`✓ Applied: ${filename}`);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
    console.log("Done.");
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e.message); process.exit(1); });
