import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { validateOAS, validateRequest } from '../middleware/validation.middleware';
import { db } from '../database/connection';

export const apiRoutes = Router();

// Validation schemas
const registerAPISchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  oasSpec: Joi.object().required(),
  oasFormat: Joi.string().valid('json', 'yaml').default('json'),
  visibility: Joi.string().valid('private', 'public', 'internal').default('private'),
  tags: Joi.array().items(Joi.string()).optional(),
});

/**
 * POST /api/v1/apis
 * Register a new API with OpenAPI Specification
 */
apiRoutes.post('/', validateRequest(registerAPISchema), validateOAS, async (req: Request, res: Response) => {
  const { name, description, oasSpec, oasFormat, visibility, tags } = req.body;
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;

  try {
    const apiId = uuidv4();
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const version = oasSpec.info?.version || '1.0.0';

    // Extract metadata from OAS
    const endpoints = Object.keys(oasSpec.paths || {}).length;
    const methods = Array.from(
      new Set(
        Object.values(oasSpec.paths || {})
          .flatMap((path: any) => Object.keys(path))
          .filter(key => ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(key))
      )
    );

    const query = `
      INSERT INTO apis (
        id, organization_id, name, slug, description, version,
        oas_spec, oas_format, total_endpoints, methods,
        visibility, tags, status, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      ) RETURNING *;
    `;

    const result = await db.query(query, [
      apiId, organizationId, name, slug, description, version,
      JSON.stringify(oasSpec), oasFormat, endpoints, JSON.stringify(methods),
      visibility, JSON.stringify(tags || []), 'draft', userId
    ]);

    // Log audit
    await db.query(
      `INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [organizationId, userId, 'API_CREATED', 'api', apiId, `Created API: ${name}`]
    );

    res.status(201).json({
      message: 'API registered successfully',
      api: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/v1/apis
 * List all APIs for organization
 */
apiRoutes.get('/', async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  const { status, visibility, limit = 20, offset = 0 } = req.query;

  try {
    let query = 'SELECT * FROM apis WHERE organization_id = $1';
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    if (visibility) {
      query += ` AND visibility = $${paramIndex}`;
      params.push(visibility as string);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

    const result = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM apis WHERE organization_id = $1';
    if (status) countQuery += ` AND status = $2`;
    if (visibility) countQuery += ` AND visibility = $${status ? 3 : 2}`;

    const countResult = await db.query(
      countQuery,
      status && visibility ? [organizationId, status, visibility] : (status ? [organizationId, status] : [organizationId])
    );

    res.json({
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      apis: result.rows,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/v1/apis/:apiId
 * Get API details with metadata
 */
apiRoutes.get('/:apiId', async (req: Request, res: Response) => {
  const { apiId } = req.params;
  const organizationId = req.user?.organizationId;

  try {
    const query = `
      SELECT 
        a.*,
        COUNT(DISTINCT p.id) as proxy_count,
        COUNT(DISTINCT av.id) as version_count
      FROM apis a
      LEFT JOIN proxies p ON a.id = p.api_id
      LEFT JOIN api_versions av ON a.id = av.api_id
      WHERE a.id = $1 AND a.organization_id = $2
      GROUP BY a.id;
    `;

    const result = await db.query(query, [apiId, organizationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API not found' });
    }

    res.json({ api: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/v1/apis/:apiId
 * Update API metadata
 */
apiRoutes.put('/:apiId', validateRequest(registerAPISchema.fork(['name', 'oasSpec'], s => s.optional())), async (req: Request, res: Response) => {
  const { apiId } = req.params;
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  const { name, description, visibility, tags, status } = req.body;

  try {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex}`);
      params.push(name);
      paramIndex++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(description);
      paramIndex++;
    }
    if (visibility) {
      updates.push(`visibility = $${paramIndex}`);
      params.push(visibility);
      paramIndex++;
    }
    if (tags) {
      updates.push(`tags = $${paramIndex}`);
      params.push(JSON.stringify(tags));
      paramIndex++;
    }
    if (status) {
      updates.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_by = $' + paramIndex);
    params.push(userId);
    paramIndex++;

    params.push(apiId, organizationId);

    const query = `
      UPDATE apis SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}
      RETURNING *;
    `;

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API not found' });
    }

    // Log audit
    await db.query(
      `INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, changes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [organizationId, userId, 'API_UPDATED', 'api', apiId, JSON.stringify({ updated_fields: Object.keys(req.body) })]
    );

    res.json({ message: 'API updated successfully', api: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/v1/apis/:apiId
 * Soft delete API
 */
apiRoutes.delete('/:apiId', async (req: Request, res: Response) => {
  const { apiId } = req.params;
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;

  try {
    const query = `
      UPDATE apis
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND organization_id = $2
      RETURNING *;
    `;

    const result = await db.query(query, [apiId, organizationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API not found' });
    }

    // Log audit
    await db.query(
      `INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [organizationId, userId, 'API_DELETED', 'api', apiId]
    );

    res.json({ message: 'API deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/v1/apis/:apiId/versions
 * Create new API version
 */
apiRoutes.post('/:apiId/versions', validateRequest(
  Joi.object({
    versionNumber: Joi.string().required(),
    oasSpec: Joi.object().required(),
    changelog: Joi.string().optional(),
    breakingChanges: Joi.boolean().default(false),
  })
), validateOAS, async (req: Request, res: Response) => {
  const { apiId } = req.params;
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  const { versionNumber, oasSpec, changelog, breakingChanges } = req.body;

  try {
    const versionId = uuidv4();

    const query = `
      INSERT INTO api_versions (id, api_id, version_number, oas_spec, changelog, breaking_changes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const result = await db.query(query, [
      versionId, apiId, versionNumber, JSON.stringify(oasSpec), changelog, breakingChanges, userId
    ]);

    // Log audit
    await db.query(
      `INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [organizationId, userId, 'API_VERSION_CREATED', 'api_version', versionId]
    );

    res.status(201).json({
      message: 'API version created successfully',
      version: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/v1/apis/:apiId/versions
 * List API versions
 */
apiRoutes.get('/:apiId/versions', async (req: Request, res: Response) => {
  const { apiId } = req.params;

  try {
    const query = `
      SELECT * FROM api_versions
      WHERE api_id = $1
      ORDER BY created_at DESC;
    `;

    const result = await db.query(query, [apiId]);

    res.json({ versions: result.rows });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
