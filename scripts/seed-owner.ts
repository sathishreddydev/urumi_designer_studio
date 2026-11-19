import { Client } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: process.env.ENV_FILE || ".env.local" });

const connectionString = process.env.MASTER_DATABASE_URL;
const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
const passwordHash = process.env.OWNER_PASSWORD_HASH;

if (!connectionString) {
  throw new Error("MASTER_DATABASE_URL is not configured");
}
if (!email) {
  throw new Error("OWNER_EMAIL is not configured");
}
if (
  !passwordHash ||
  !/^[$]2[aby][$]\d{2}[$][./A-Za-z0-9]{53}$/.test(passwordHash)
) {
  throw new Error("OWNER_PASSWORD_HASH must be a complete bcrypt password hash");
}

async function seedOwner() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const { rows } = await client.query<{ email: string }>(
      `INSERT INTO tenant_registry_owners (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING email`,
      [email, passwordHash]
    );

    if (!rows.length) {
      throw new Error("An owner account already exists for this email; no changes were made");
    }

    console.log("Owner account created in the master database.");
  } finally {
    await client.end();
  }
}

seedOwner().catch((error: unknown) => {
  console.error("Could not seed owner account:", error);
  process.exitCode = 1;
});
