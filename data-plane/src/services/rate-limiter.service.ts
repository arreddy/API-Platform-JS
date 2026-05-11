import { redis } from '../database/redis';

export const rateLimiterService = {
  /**
   * Sliding-window counter using Redis INCR + EXPIRE.
   * Returns true when the caller has exceeded maxRequests within windowSeconds.
   * Fails open on Redis errors to avoid blocking legitimate traffic.
   */
  async checkRateLimit(
    identifier: string,
    proxyId: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<boolean> {
    const key = `ratelimit:${proxyId}:${identifier || 'anonymous'}`;

    try {
      const current = await redis.incr(key);

      if (current === 1) {
        // First request in this window — set the expiry
        await redis.expire(key, windowSeconds);
      }

      return current > maxRequests;
    } catch (err) {
      console.error('Rate limiter Redis error (failing open):', err);
      return false;
    }
  },

  /** Expose remaining quota for the X-RateLimit-Remaining header. */
  async remaining(
    identifier: string,
    proxyId: string,
    maxRequests: number
  ): Promise<number> {
    const key = `ratelimit:${proxyId}:${identifier || 'anonymous'}`;
    try {
      const current = await redis.get(key);
      const used = current ? parseInt(current, 10) : 0;
      return Math.max(0, maxRequests - used);
    } catch {
      return maxRequests;
    }
  },
};
