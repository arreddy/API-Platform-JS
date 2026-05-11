import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { validateRequest } from '../middleware/validation.middleware';
import { db } from '../database/connection';

export const proxyRoutes = Router();

const createProxySchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  apiId: Joi.string().uuid().required(),
  targetBaseUrl: Joi.string().uri().required(),
  pathPrefix: Joi.string().default('/'),
  authType: Joi.string().valid('none', 'api_key', 'oauth2', 'jwt').default('api_key'),
  rateLimitRequests: Joi.number().integer().min(1).default(1000),
  rateLimitWindow: Joi.number().integer().min(1).default(60),
  timeoutMs: Joi.number().integer().min(100).default(30000),
  validateRequest: Joi.boolean().default(true),
  validateResponse: Joi.boolean().default(false),
  stripBasePath: Joi.boolean().default(true),
  corsConfig: Joi.object({
    enabled: Joi.boolean().default(true),
    origins: Joi.array().items(Joi.string()).default(['*']),
  }).optional(),
  transformations: Joi.object({
    request: Joi.array().items(Joi.object()).optional(),
    response: Joi.array().items(Joi.object()).optional(),
  }).optional(),
});

proxyRoutes.post('/', validateRequest(createProxySchema), async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  const {
    name, description, apiId, targetBaseUrl, pathPrefix, authType,
    rateLimitRequests, rateLimitWindow, timeoutMs,
    validateRequest: validateReq, validateResponse, stripBasePath,
    corsConfig, transformations,
  } = req.body;

  const apiCheck = await db.query(
    'SELECT id, slug FROM apis WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
    [apiId, organizationId]
  );
  if (apiCheck.rows.length === 0) {
    return res.status(404).json({ error: 'API not found' });
  }

  const proxyId = uuidv4();
  const slug = name.toLowerCase().replace(/\s+/g, '-');

  const result = await db.query(
    `INSERT INTO proxies (
      id, organization_id, api_id, name, slug, description,
      target_base_url, path_prefix, auth_type,
      rate_limit_requests, rate_limit_window, timeout_ms,
      validate_request, validate_response, strip_base_path,
      cors_config, transformations, status, created_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9,
      $10, $11, $12,
      $13, $14, $15,
      $16, $17, 'inactive', $18
    ) RETURNING *`,
    [
      proxyId, organizationId, apiId, name, slug, description || null,
      targetBaseUrl, pathPrefix, authType,
      rateLimitRequests, rateLimitWindow, timeoutMs,
      validateReq, validateResponse, stripBasePath,
      JSON.stringify(corsConfig || {}), JSON.stringify(transformations || {}), userId,
    ]
  );

  await db.query(
    `INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, description)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [organizationId, userId, 'PROXY_CREATED', 'proxy', proxyId, `Created proxy: ${name}`]
  );

  res.status(201).json({ message: 'Proxy created successfully', proxy: result.rows[0] });
});

proxyRoutes.get('/', async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  const { status, apiId, limit = 20, offset = 0 } = req.query;

  let query = `
    SELECT p.*, a.name AS api_name, a.slug AS api_slug, a.version AS api_version
    FROM proxies p
    LEFT JOIN apis a ON p.api_id = a.id
    WHERE p.organization_id = $1 AND p.status != 'deleted'
  `;
  const params: any[] = [organizationId];
  let idx = 2;

  if (status) { query += ` AND p.status = $${idx}`; params.push(status); idx++; }
  if (apiId)  { query += ` AND p.api_id = $${idx}`;  params.push(apiId);  idx++; }

  query += ` ORDER BY p.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const [result, countResult] = await Promise.all([
    db.query(query, params),
    db.query('SELECT COUNT(*) FROM proxies WHERE organization_id = $1 AND status != $2', [organizationId, 'deleted']),
  ]);

  res.json({
    total: parseInt(countResult.rows[0].count),
    limit: parseInt(limit as string),
    offset: parseInt(offset as string),
    proxies: result.rows,
  });
});

proxyRoutes.get('/:proxyId', async (req: Request, res: Response) => {
  const { proxyId } = req.params;
  const organizationId = req.user?.organizationId;

  const [proxyResult, routesResult] = await Promise.all([
    db.query(
      `SELECT p.*, a.name AS api_name, a.slug AS api_slug, a.oas_spec
       FROM proxies p
       LEFT JOIN apis a ON p.api_id = a.id
       WHERE p.id = $1 AND p.organization_id = $2 AND p.status != 'deleted'`,
      [proxyId, organizationId]
    ),
    db.query('SELECT * FROM routes WHERE proxy_id = $1 ORDER BY path, method', [proxyId]),
  ]);

  if (proxyResult.rows.length === 0) {
    return res.status(404).json({ error: 'Proxy not found' });
  }

  res.json({ proxy: proxyResult.rows[0], routes: routesResult.rows });
});

proxyRoutes.put(
  '/:proxyId',
  validateRequest(createProxySchema.fork(['name', 'apiId', 'targetBaseUrl'], s => s.optional())),
  async (req: Request, res: Response) => {
    const { proxyId } = req.params;
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;

    const colMap: Record<string, string> = {
      name: 'name', description: 'description', targetBaseUrl: 'target_base_url',
      pathPrefix: 'path_prefix', authType: 'auth_type',
      rateLimitRequests: 'rate_limit_requests', rateLimitWindow: 'rate_limit_window',
      timeoutMs: 'timeout_ms', validateRequest: 'validate_request',
      validateResponse: 'validate_response', stripBasePath: 'strip_base_path',
    };

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const [bodyKey, col] of Object.entries(colMap)) {
      if (req.body[bodyKey] !== undefined) {
        updates.push(`${col} = $${idx}`);
        params.push(req.body[bodyKey]);
        idx++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    params.push(proxyId, organizationId);
    const result = await db.query(
      `UPDATE proxies SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${idx} AND organization_id = $${idx + 1} AND status != 'deleted'
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proxy not found' });
    }

    await db.query(
      `INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [organizationId, userId, 'PROXY_UPDATED', 'proxy', proxyId]
    );

    res.json({ message: 'Proxy updated successfully', proxy: result.rows[0] });
  }
);

proxyRoutes.delete('/:proxyId', async (req: Request, res: Response) => {
  const { proxyId } = req.params;
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;

  const result = await db.query(
    `UPDATE proxies SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND organization_id = $2 AND status != 'deleted'
     RETURNING *`,
    [proxyId, organizationId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Proxy not found' });
  }

  await db.query(
    `INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [organizationId, userId, 'PROXY_DELETED', 'proxy', proxyId]
  );

  res.json({ message: 'Proxy deleted successfully' });
});

proxyRoutes.post('/:proxyId/deploy', async (req: Request, res: Response) => {
  const { proxyId } = req.params;
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;

  const proxyResult = await db.query(
    `SELECT p.*, a.oas_spec, a.slug AS api_slug
     FROM proxies p
     LEFT JOIN apis a ON p.api_id = a.id
     WHERE p.id = $1 AND p.organization_id = $2 AND p.status != 'deleted'`,
    [proxyId, organizationId]
  );

  if (proxyResult.rows.length === 0) {
    return res.status(404).json({ error: 'Proxy not found' });
  }

  const proxy = proxyResult.rows[0];
  const oasSpec = typeof proxy.oas_spec === 'string' ? JSON.parse(proxy.oas_spec) : proxy.oas_spec;
  const paths = (oasSpec?.paths || {}) as Record<string, any>;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Replace all routes atomically
    await client.query('DELETE FROM routes WHERE proxy_id = $1', [proxyId]);

    const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
    let routeCount = 0;

    for (const [path, pathItem] of Object.entries(paths)) {
      for (const method of httpMethods) {
        if (!(pathItem as any)[method]) continue;

        const operation = (pathItem as any)[method];
        await client.query(
          `INSERT INTO routes (id, proxy_id, method, path, target_path, operation_id, require_auth, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            uuidv4(), proxyId, method.toUpperCase(), path, path,
            operation.operationId || null,
            proxy.auth_type !== 'none',
            userId,
          ]
        );
        routeCount++;
      }
    }

    await client.query(
      `UPDATE proxies SET status = 'active', deployed_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [proxyId]
    );

    await client.query(
      `INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [organizationId, userId, 'PROXY_DEPLOYED', 'proxy', proxyId, `Deployed ${routeCount} routes`]
    );

    await client.query('COMMIT');

    res.json({ message: 'Proxy deployed successfully', proxyId, routesDeployed: routeCount, status: 'active' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});
