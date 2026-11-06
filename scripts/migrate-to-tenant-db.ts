/**
 * Migration Script: Replace `import { db } from "@/lib/db"` with `getStudioDb()`
 *
 * This script automatically migrates all API route files to use the
 * multi-tenant database resolver instead of the hardcoded DATABASE_URL.
 *
 * For each file:
 *   1. Replaces `import { db } from "@/lib/db";` with `import { getStudioDb } from "@/lib/multi-tenant/studio";`
 *   2. Adds `const db = await getStudioDb();` after the first `try {` or `async function` line
 *   3. Removes the now-unused `db` import
 *
 * Usage: npx tsx scripts/migrate-to-tenant-db.ts
 * Usage (dry-run): npx tsx scripts/migrate-to-tenant-db.ts --dry-run
 */

import * as fs from "fs";
import * as path from "path";

const SRC_DIR = path.join(process.cwd(), "src", "app", "api");
const DRY_RUN = process.argv.includes("--dry-run");

const OLD_IMPORT = `import { db } from "@/lib/db";`;
const NEW_IMPORT = `import { getStudioDb } from "@/lib/multi-tenant/studio";`;

/**
 * Recursively find all route.ts files in a directory.
 */
function findRouteFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(fullPath));
    } else if (entry.name === "route.ts") {
      results.push(fullPath);
    }
  }
  return results;
}

// Pattern to find `const db = await getStudioDb();` insertion point
// We insert after the first occurrence of `try {` in each exported async function
// OR after the `async function NAME(` line if there's no try block

interface MigrationResult {
  file: string;
  changed: boolean;
  reason?: string;
}

function migrateFile(filePath: string): MigrationResult {
  let content = fs.readFileSync(filePath, "utf-8");

  // Skip if already migrated
  if (content.includes("getStudioDb") && !content.includes(OLD_IMPORT)) {
    return { file: filePath, changed: false, reason: "Already migrated" };
  }

  // Skip if no `import { db } from "@/lib/db"` found
  if (!content.includes(OLD_IMPORT)) {
    return { file: filePath, changed: false, reason: "No db import found" };
  }

  // Replace the import line
  content = content.replace(OLD_IMPORT, NEW_IMPORT);

  // Now we need to add `const db = await getStudioDb();` inside each handler function.
  // Strategy: find all `export async function GET/POST/PUT/PATCH/DELETE` and insert
  // the line after the first `{` in that function body.

  const handlerPattern =
    /export async function (GET|POST|PUT|PATCH|DELETE)\s*\([^)]*\)\s*\{/g;

  let match;
  let modified = false;

  while ((match = handlerPattern.exec(content)) !== null) {
    const insertPos = match.index! + match[0].length;

    // Check if there's already a getStudioDb call nearby (skip if so)
    const next200 = content.substring(insertPos, insertPos + 200);
    if (next200.includes("getStudioDb()")) {
      continue;
    }

    // Insert after the opening brace
    content =
      content.substring(0, insertPos) +
      "\n    const db = await getStudioDb();" +
      content.substring(insertPos);

    modified = true;
    // Move the pattern forward to avoid infinite loop
    handlerPattern.lastIndex = insertPos + 50;
  }

  // Also handle withPermission wrapper pattern:
  // `export const DELETE = withPermission(...async (_request, { params }) => {`
  const withPermissionPattern =
    /async \((?:_?request|_?req),\s*\{[^}]*\}\)\s*=>\s*\{/g;

  while ((match = withPermissionPattern.exec(content)) !== null) {
    const insertPos = match.index! + match[0].length;

    const next200 = content.substring(insertPos, insertPos + 200);
    if (next200.includes("getStudioDb()")) {
      continue;
    }

    content =
      content.substring(0, insertPos) +
      "\n    const db = await getStudioDb();" +
      content.substring(insertPos);

    modified = true;
    handlerPattern.lastIndex = insertPos + 50;
  }

  if (modified && !DRY_RUN) {
    fs.writeFileSync(filePath, content, "utf-8");
  }

  return {
    file: filePath,
    changed: modified,
    reason: modified ? undefined : "No handler functions found",
  };
}

async function main() {
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Migrating API routes to use getStudioDb()...\n`);

  // Find all route.ts files
  const files = findRouteFiles(SRC_DIR);

  console.log(`Found ${files.length} route files\n`);

  let migrated = 0;
  let skipped = 0;

  for (const file of files.sort()) {
    const result = migrateFile(file);
    const relPath = path.relative(process.cwd(), file);

    if (result.changed) {
      migrated++;
      console.log(`✅ ${relPath}`);
    } else {
      skipped++;
      console.log(`⏭️  ${relPath} — ${result.reason}`);
    }
  }

  console.log(`\n${DRY_RUN ? "[DRY RUN] " : ""}Migration complete!`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped:   ${skipped}`);

  if (!DRY_RUN && migrated > 0) {
    console.log(`\n⚠️  Run TypeScript check to verify:`);
    console.log(`  node node_modules/typescript/bin/tsc --noEmit --skipLibCheck`);
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
