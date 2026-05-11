import bcrypt from 'bcryptjs';
import { db } from '../database/connection';
import { redis } from '../database/redis';

interface Credential {
  id: string;
  organizationId: string;
  scopes: string[];
  proxyIds: string[];
  rateLimitOverride: number | null;
}

const CACHE_TTL     = 300; // 5 min for valid keys
const NEG_CACHE_TTL = 60;  // 1 min for invalid keys

export const authService = {
  async verifyApiKey(key: string, proxyIds: string[]): Promise<Credential | null> {
    if (!key) return null;

    const cacheKey = `apikey:${key}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed._invalid) return null;
        return parsed as Credential;
      }
    } catch (_) { /* cache miss — continue */ }

    // Narrow candidates by the stored prefix (first 8 chars are plain-text)
    const prefix = key.substring(0, 8);
    const result = await db.query(
      `SELECT * FROM api_keys
       WHERE key_prefix = $1
         AND is_active  = TRUE
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [prefix]
    );

    for (const row of result.rows) {
      const isMatch = await bcrypt.compare(key, row.key_hash);
      if (!isMatch) continue;

      const storedProxyIds: string[] =
        typeof row.proxy_ids === 'string' ? JSON.parse(row.proxy_ids) : row.proxy_ids ?? [];

      // If the key is scoped to specific proxies, verify access
      if (storedProxyIds.length > 0 && !proxyIds.some((p) => storedProxyIds.includes(p))) {
        continue;
      }

      const credential: Credential = {
        id: row.id,
        organizationId: row.organization_id,
        scopes: typeof row.scopes === 'string' ? JSON.parse(row.scopes) : row.scopes ?? [],
        proxyIds: storedProxyIds,
        rateLimitOverride: row.rate_limit_override ?? null,
      };

      // Cache hit — fire-and-forget
      redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(credential)).catch(() => {});

      // Update last_used_at without blocking the response
      db.query('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [row.id]).catch(() => {});

      return credential;
    }

    // Cache negative result to avoid repeated DB lookups for invalid keys
    redis.setEx(cacheKey, NEG_CACHE_TTL, JSON.stringify({ _invalid: true })).catch(() => {});

    return null;
  },
};
