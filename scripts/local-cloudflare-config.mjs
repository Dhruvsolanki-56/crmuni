// Single source of truth for the LOCAL/Codespaces Cloudflare bindings, used
// by both vite.config.ts (so `npm run dev`/`npm run build` bind to it) and
// scripts/db-local-init.mjs (so migrations land in the exact same local D1
// file Miniflare will open later). Keeping one file means the two can never
// drift apart and silently point at different local databases.
//
// SAFETY: LOCAL_D1_DATABASE_ID is a fixed, obviously-fake placeholder. It is
// never the real Cloudflare database id. Real production deployment must
// pass the real id explicitly via the CLOUDFLARE_D1_DATABASE_ID environment
// variable - see vite.config.ts. Nothing in this repo's default (no env
// vars set) configuration can resolve to the production database.
export const D1_BINDING = 'DB';
export const LOCAL_D1_DATABASE_ID = '00000000-0000-4000-8000-000000000000';
export const LOCAL_D1_DATABASE_NAME = 'crmuni-local-test-db';

export const R2_BINDING = 'FILES';
export const LOCAL_R2_BUCKET_NAME = 'crmuni-local-test-files';

// Matches @cloudflare/vite-plugin's own default persistence location, so a
// database this script creates is the same one `npm run dev` opens.
export const LOCAL_PERSIST_PATH = '.wrangler/state/v3';

export function resolveD1DatabaseId() {
  const real = process.env.CLOUDFLARE_D1_DATABASE_ID;
  if (real && real !== LOCAL_D1_DATABASE_ID) return real;
  return LOCAL_D1_DATABASE_ID;
}

// Refuses to run if anything nearby is asking for real Cloudflare state.
// Called by local-only scripts before they touch the filesystem.
export function assertLocalOnly() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg.includes('--remote')))
    throw new Error(
      'Refusing to run: local database scripts must never pass --remote.',
    );
  if (process.env.CLOUDFLARE_D1_DATABASE_ID) {
    throw new Error(
      'Refusing to run: CLOUDFLARE_D1_DATABASE_ID is set, which usually ' +
        'means this shell is configured for a real deployment. Local ' +
        'database scripts always use a fixed local placeholder id and ' +
        'never read that variable, precisely so they cannot accidentally ' +
        'target production. Unset it before running local database ' +
        'scripts, or run them in a clean shell/Codespace.',
    );
  }
}
