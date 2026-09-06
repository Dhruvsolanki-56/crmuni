import { env } from 'cloudflare:workers';

export type RevenueEnv = { DB: D1Database; OPENAI_API_KEY?: string; OPENAI_MODEL?: string };

export function database(): D1Database {
  return (env as unknown as RevenueEnv).DB;
}

export function revenueEnv(): RevenueEnv {
  return env as unknown as RevenueEnv;
}

export function requestUser(request: Request) {
  return {
    id: request.headers.get('oai-authenticated-user-id') || 'local-preview-user',
    email: request.headers.get('oai-authenticated-user-email') || 'preview@revenue-os.local',
  };
}

export const DEFAULT_WORKSPACE = 'nova-automation';
export const DEFAULT_EVENT = 'industrialtech-expo-2026';
