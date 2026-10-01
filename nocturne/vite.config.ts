import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import hostingConfig from './.openai/hosting.json';
import { localProjectEditor } from './tools/local-project-editor';
import { localProfileEditor } from './tools/local-profile-editor';
import { localSkillEditor } from './tools/local-skill-editor';
import { localContentUpdates } from './tools/local-content-updates';

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const { d1, r2 } = hostingConfig;

// Poll on Windows to avoid locked generated files; Seatbelt blocks FSEvents.
const usePolling =
  process.platform === 'win32' || process.env.CODEX_SANDBOX === 'seatbelt';

const localBindingConfig = {
  main: 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: 'site-creator-d1',
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: 'site-creator-r2',
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    build: {
      chunkSizeWarningLimit: 1600,
    },
    css: { postcss: { plugins: [tailwindcss()] } },
    server: {
      host: '127.0.0.1',
      watch: {
        ignored: [
          '**/.next/**',
          '**/.vinext/**',
          '**/dist/**',
          '**/work/**',
          '**/.wrangler/**',
          '**/.hall-projects.tmp',
          '**/.profile.tmp',
          '**/.skills.tmp',
        ],
        ...(usePolling
          ? { useFsEvents: false, usePolling: true, interval: 300 }
          : {}),
      },
    },
    plugins: [
      localContentUpdates(),
      localProjectEditor(),
      localProfileEditor(),
      localSkillEditor(),
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
    ],
  };
});
