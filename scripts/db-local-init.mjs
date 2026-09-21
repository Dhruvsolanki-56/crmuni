// Creates/resets the LOCAL Cloudflare D1 database used by `npm run dev` and
// applies every migration in drizzle/ to it, in order.
//
// This never touches the real Cloudflare account. It opens a Miniflare D1
// binding entirely emulated on local disk under .wrangler/ - the exact same
// mechanism @cloudflare/vite-plugin uses for `npm run dev` - using a fixed,
// obviously-fake local database id (see scripts/local-cloudflare-config.mjs)
// that can never collide with or resolve to the production database. There
// is no network call anywhere in this script.
//
// Usage:
//   node scripts/db-local-init.mjs          create if missing, otherwise
//                                            leave existing local data alone
//   node scripts/db-local-init.mjs --reset   wipe the local database first,
//                                            then reapply every migration
import { readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Miniflare } from 'miniflare';
import {
  D1_BINDING,
  LOCAL_D1_DATABASE_ID,
  LOCAL_PERSIST_PATH,
  assertLocalOnly,
} from './local-cloudflare-config.mjs';

assertLocalOnly();

const root = resolve(import.meta.dirname, '..');
const reset = process.argv.includes('--reset');
const d1PersistDir = resolve(root, LOCAL_PERSIST_PATH, 'd1');

if (reset && existsSync(d1PersistDir)) {
  console.log(`--reset: removing ${LOCAL_PERSIST_PATH}/d1 (local only)`);
  rmSync(d1PersistDir, { recursive: true, force: true });
}

const migrationFiles = readdirSync(resolve(root, 'drizzle'))
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort();
if (!migrationFiles.length) throw new Error('No migrations found in drizzle/.');

const mf = new Miniflare({
  modules: true,
  script: 'export default { fetch: () => new Response("ok") };',
  d1Databases: { [D1_BINDING]: LOCAL_D1_DATABASE_ID },
  d1Persist: resolve(root, LOCAL_PERSIST_PATH, 'd1'),
});

try {
  const db = await mf.getD1Database(D1_BINDING);

  const existing = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table'",
    )
    .first();
  if (existing.count > 0 && !reset) {
    console.log(
      `Local D1 database already has ${existing.count} tables. Leaving it ` +
        'as-is (pass --reset to wipe and reapply every migration).',
    );
  } else {
    console.log(`Applying ${migrationFiles.length} migrations to the local D1 database...`);
    for (const file of migrationFiles) {
      const sql = readFileSync(resolve(root, 'drizzle', file), 'utf8');
      const statements = sql
        .split('--> statement-breakpoint')
        .map((part) => part.trim())
        .filter(Boolean);
      for (const statement of statements) {
        try {
          // D1's .exec() treats each newline as a statement boundary, which
          // breaks on any multi-line CREATE TABLE. .prepare().run() runs
          // one real SQL statement regardless of internal formatting.
          await db.prepare(statement).run();
        } catch (error) {
          throw new Error(`Migration ${file} failed: ${error.message}`, {
            cause: error,
          });
        }
      }
    }
  }

  const tables = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table'",
    )
    .first();
  const rows = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('workspaces','memberships','leads','events')",
    )
    .all();
  const requiredTables = ['workspaces', 'memberships', 'leads', 'events'];
  const foundTables = new Set(rows.results.map((row) => row.name));
  const missing = requiredTables.filter((name) => !foundTables.has(name));
  if (missing.length)
    throw new Error(
      `Schema verification failed: missing table(s) ${missing.join(', ')}.`,
    );

  const dataCheck = await db
    .prepare('SELECT COUNT(*) AS count FROM leads')
    .first();

  console.log(
    `Local D1 ready: ${tables.count} tables, core tables verified present, ` +
      `${dataCheck.count} lead row(s) currently stored.`,
  );
  console.log(
    'This database only exists on this machine, under .wrangler/state/ ' +
      '(gitignored). It is never the production crmuni-db.',
  );
} finally {
  await mf.dispose();
}
