// One-command test-environment setup for local/Codespaces use.
//
// Only performs safe LOCAL actions:
//   1. verifies dependencies are installed and Node is a supported version
//   2. creates a local .env with a development test identity, if missing
//   3. initializes the local D1 database (create-if-missing, never resets
//      existing local data - use `npm run db:local:reset` for that)
//   4. fills an empty database with demo data, so a fresh Codespace opens on
//      a populated app instead of an empty workspace. Skipped entirely if the
//      database already holds a workspace, and with CRMUNI_SKIP_SEED=1.
//
// Never touches the network, never touches a real Cloudflare resource.
import { existsSync, copyFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const fail = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};
const ok = (message) => console.log(`✓ ${message}`);

// 1. Dependencies and Node version.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13))
  fail(
    `Node ${process.versions.node} is too old. This project requires Node >= 22.13.0.`,
  );
ok(`Node ${process.versions.node}`);

if (!existsSync(resolve(root, 'node_modules', '.package-lock.json')))
  fail('Dependencies are not installed. Run `npm ci` first, then rerun `npm run setup:test`.');
ok('Dependencies installed');

// 2. Local env file with a development test identity. Never overwrites an
// existing .env - a developer's local overrides always win.
const envPath = resolve(root, '.env');
const examplePath = resolve(root, '.env.example');
if (!existsSync(envPath)) {
  copyFileSync(examplePath, envPath);
  ok('Created .env from .env.example (development test identity enabled)');
} else {
  const contents = readFileSync(envPath, 'utf8');
  if (!/^CRMUNI_LOCAL_TEST=/m.test(contents))
    console.log(
      '⚠ .env exists but has no CRMUNI_LOCAL_TEST setting - see .env.example if the app rejects requests with 401.',
    );
  ok('.env already exists (left untouched)');
}

// 3. Local D1 schema - safe to rerun, only creates what is missing.
const init = spawnSync(
  process.execPath,
  [resolve(root, 'scripts', 'db-local-init.mjs')],
  { stdio: 'inherit' },
);
if (init.status !== 0) fail('Local database initialization failed.');

// 4. Demo data, but only into an empty database. An empty app gives no sense
// of what any screen looks like in use, and every list, chart and report
// needs records before it says anything. --if-empty makes this a no-op the
// moment there is a workspace, so rerunning setup never disturbs real work.
if (process.env.CRMUNI_SKIP_SEED === '1') {
  ok('Demo data skipped (CRMUNI_SKIP_SEED=1)');
} else {
  const seed = spawnSync(
    process.execPath,
    [resolve(root, 'scripts', 'seed-demo-data.mjs'), '--if-empty'],
    { stdio: 'inherit' },
  );
  // A seeding failure must not fail setup: the schema is already in place and
  // the app runs fine empty, so report it and carry on.
  if (seed.status !== 0)
    console.log(
      '\n⚠ Demo data could not be seeded. The app still works - run `npm run db:local:seed` later to retry.\n',
    );
}

console.log('\nSetup complete. Run:\n\n  npm run dev\n');
