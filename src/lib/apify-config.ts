// ─── Apify integration settings (admin-configurable) ─────────────────────────
// The IndiaMART provider reads its token/actor from here. Priority:
//   1. DB SystemConfig('apifyConfig') — set from the admin dashboard
//   2. Environment (APIFY_TOKEN / APIFY_ACTOR_ID)
//   3. None → the deterministic demo dataset keeps the pipeline usable.

import { db } from '@/lib/db';

export interface ApifyConfig {
  token: string | null;
  actorId: string | null;
  enabled: boolean;
  source: 'database' | 'environment' | 'none';
}

interface StoredApifyConfig {
  token?: string;
  actorId?: string;
  enabled?: boolean;
}

export async function getApifyConfig(): Promise<ApifyConfig> {
  try {
    const row = await db.systemConfig.findUnique({ where: { key: 'apifyConfig' } });
    if (row) {
      const stored = JSON.parse(row.value) as StoredApifyConfig;
      if (stored.enabled !== false && stored.token && stored.token.trim() !== '') {
        return {
          token: stored.token.trim(),
          actorId: stored.actorId?.trim() || 'thirdwatch~indiamart-supplier-scraper',
          enabled: true,
          source: 'database',
        };
      }
    }
  } catch {
    // DB not reachable / malformed row — fall through to env
  }
  const envToken = process.env.APIFY_TOKEN;
  if (envToken) {
    return {
      token: envToken,
      actorId: process.env.APIFY_ACTOR_ID ?? 'thirdwatch~indiamart-supplier-scraper',
      enabled: true,
      source: 'environment',
    };
  }
  return { token: null, actorId: null, enabled: false, source: 'none' };
}

export function maskToken(token: string | null): string | null {
  if (!token) return null;
  if (token.length <= 8) return '••••••••';
  return `${token.slice(0, 4)}••••••••${token.slice(-4)}`;
}
