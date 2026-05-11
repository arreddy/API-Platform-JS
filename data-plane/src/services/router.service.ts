import axios from 'axios';
import { db } from '../database/connection';
import { redis } from '../database/redis';

export interface RouteConfig {
  proxyId: string;
  routeId: string;
  organizationId: string;
  targetEndpoint: string;
  requireAuth: boolean;
  rateLimitRequests: number;
  rateLimitWindow: number;
  timeoutMs: number;
  validateResponse: boolean;
  validateRequest: boolean;
  apis: string[];
}

// Convert OAS path template {param} to a regex segment
function oasPathToRegex(oasPath: string): RegExp {
  const pattern = oasPath
    .replace(/\{[^}]+\}/g, '[^/]+')
    .replace(/\//g, '\\/')
    .replace(/\./g, '\\.');
  return new RegExp(`^${pattern}$`);
}

// Cache proxy+route config keyed by "apiName:method:path" for 30 s
const ROUTE_CACHE_TTL = 30;

export const routerService = {
  async resolveRoute(
    apiName: string,
    apiVersion: string,
    method: string,
    path: string
  ): Promise<RouteConfig | null> {
    const cacheKey = `route:${apiName}:${method}:${path}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_) { /* ignore cache errors */ }

    // Locate the active proxy for this API slug
    const proxyResult = await db.query(
      `SELECT p.*, a.id AS api_id, a.organization_id
       FROM proxies p
       JOIN apis a ON p.api_id = a.id
       WHERE a.slug = $1 AND p.status = 'active'
       ORDER BY p.deployed_at DESC
       LIMIT 1`,
      [apiName]
    );

    if (proxyResult.rows.length === 0) return null;

    const proxy = proxyResult.rows[0];

    // Fetch all routes for this proxy and match in memory
    const routesResult = await db.query(
      'SELECT * FROM routes WHERE proxy_id = $1',
      [proxy.id]
    );

    const route = routesResult.rows.find(
      (r: any) => r.method === method.toUpperCase() && oasPathToRegex(r.path).test(path)
    );

    if (!route) return null;

    const config: RouteConfig = {
      proxyId: proxy.id,
      routeId: route.id,
      organizationId: proxy.organization_id,
      targetEndpoint: proxy.target_base_url.replace(/\/$/, ''),
      requireAuth: proxy.auth_type !== 'none',
      rateLimitRequests: proxy.rate_limit_requests,
      rateLimitWindow: proxy.rate_limit_window,
      timeoutMs: proxy.timeout_ms,
      validateResponse: proxy.validate_response,
      validateRequest: proxy.validate_request,
      apis: [proxy.api_id],
    };

    try {
      await redis.setEx(cacheKey, ROUTE_CACHE_TTL, JSON.stringify(config));
    } catch (_) { /* ignore */ }

    return config;
  },

  async transformRequest(request: any, route: RouteConfig) {
    // Extract the downstream path from the Fastify wildcard param
    const pathParam = request.params?.pathParam;
    const forwardPath = pathParam ? '/' + pathParam : '/';

    const headers = { ...request.headers };
    // Strip hop-by-hop headers before forwarding
    delete headers['host'];
    delete headers['connection'];
    delete headers['transfer-encoding'];

    return {
      method: request.method,
      path: forwardPath,
      query: request.query as Record<string, string>,
      headers,
      body: request.body,
    };
  },

  async transformResponse(response: any, _route: RouteConfig) {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(response.headers as Record<string, any>)) {
      if (!['transfer-encoding', 'connection', 'keep-alive'].includes(k)) {
        headers[k] = String(v);
      }
    }

    return {
      statusCode: response.status as number,
      headers,
      body: response.data,
    };
  },

  async invokeBackend(config: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: any;
    timeout: number;
  }) {
    return axios({
      url:     config.url,
      method:  config.method as any,
      headers: config.headers,
      data:    config.body,
      timeout: config.timeout,
      validateStatus: () => true, // Let the gateway pass through all status codes
    });
  },

  async validateResponse(_response: any, _route: RouteConfig): Promise<boolean> {
    // TODO: plug in AJV schema validation against OAS response schema
    return true;
  },
};
