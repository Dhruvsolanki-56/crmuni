import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import hostingConfig from './.openai/hosting.json';
import {
  LOCAL_R2_BUCKET_NAME,
  R2_BINDING,
  resolveD1DatabaseId,
} from './scripts/local-cloudflare-config.mjs';

// The database id this build binds to. Defaults to a fixed local-only
// placeholder that can never resolve to the real Cloudflare database, so a
// fresh checkout (Codespaces or otherwise) is safe by default with zero
// configuration. A real production build/deploy must set
// CLOUDFLARE_D1_DATABASE_ID explicitly - see README "Deployment".
const CLOUDFLARE_D1_DATABASE_ID = resolveD1DatabaseId();

const { d1 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

export default defineConfig(async ({ command }) => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  const localBindingConfig = {
    main: 'vinext/server/fetch-handler',
    compatibility_flags: ['nodejs_compat'],
    d1_databases: d1
      ? [
          {
            binding: d1,
            database_name: 'crmuni-db',
            database_id: CLOUDFLARE_D1_DATABASE_ID,
          },
        ]
      : [],
    // Production currently runs with R2 disabled (see README/operations
    // runbook), so a real build keeps r2_buckets empty to match it exactly.
    // `vite dev` gets its own local-only bucket, entirely emulated by
    // Miniflare on disk under .wrangler/ - it never touches Cloudflare, so
    // file-backed features (capture images, audio notes, brochures,
    // knowledge/RFQ/quotation documents) work end-to-end while testing.
    r2_buckets:
      command === 'serve'
        ? [{ binding: R2_BINDING, bucket_name: LOCAL_R2_BUCKET_NAME }]
        : [],
  };

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
    ],
  };
});
