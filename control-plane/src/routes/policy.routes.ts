import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { validateRequest } from '../middleware/validation.middleware';
import { db } from '../database/connection';

export const policyRoutes = Router();

const createPolicySchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  type: Joi.string().valid('rate_limit', 'auth', 'transform', 'cors', 'ip_filter', 'header').required(),
  proxyId: Joi.string().uuid().optional(),
  routeId: Joi.string().uuid().optional(),
  config: Joi.object().required(),
  priority: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
});

policyRoutes.post('/', validateRequest(createPolicySchema), async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  const { name, description, type, proxyId, routeId, config, priority, isActive } = req.body;

  const policyId = uuidv4();
  const result = await db.query(
    `INSERT INTO policies (id, organization_id, proxy_id, route_id, name, description, type, config, priority, is_active, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [policyId, organizationId, proxyId || null, routeId || null, name, description || null, type, JSON.stringify(config), priority, isActive, userId]
  );

  await db.query(
    `INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, description)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [organizationId, userId, 'POLICY_CREATED', 'policy', policyId, `Created ${type} policy: ${name}`]
  );

  res.status(201).json({ message: 'Policy created successfully', policy: result.rows[0] });
});

policyRoutes.get('/', async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  const { type, proxyId, isActive, limit = 20, offset = 0 } = req.query;

  let query = 'SELECT * FROM policies WHERE organization_id = $1';
  const params: any[] = [organizationId];
  let idx = 2;

  if (type)     { query += ` AND type = $${idx}`;      params.push(type);              idx++; }
  if (proxyId)  { query += ` AND proxy_id = $${idx}`;  params.push(proxyId);           idx++; }
  if (isActive !== undefined) {
    query += ` AND is_active = $${idx}`;
    params.push(isActive === 'true');
    idx++;
  }

  query += ` ORDER BY priority DESC, created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const [result, countResult] = await Promise.all([
    db.query(query, params),
    db.query('SELECT COUNT(*) FROM policies WHERE organization_id = $1', [organizationId]),
  ]);

  res.json({ total: parseInt(countResult.rows[0].count), policies: result.rows });
});

policyRoutes.get('/:policyId', async (req: Request, res: Response) => {
  const { policyId } = req.params;
  const organizationId = req.user?.organizationId;

  const result = await db.query(
    'SELECT * FROM policies WHERE id = $1 AND organization_id = $2',
    [policyId, organizationId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Policy not found' });
  }

  res.json({ policy: result.rows[0] });
});

policyRoutes.put(
  '/:policyId',
  validateRequest(createPolicySchema.fork(['name', 'type', 'config'], s => s.optional())),
  async (req: Request, res: Response) => {
    const { policyId } = req.params;
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;

    const fieldMap: Record<string, any> = {
      name: req.body.name,
      description: req.body.description,
      config: req.body.config !== undefined ? JSON.stringify(req.body.config) : undefined,
      priority: req.body.priority,
      is_active: req.body.isActive,
    };

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const [col, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        updates.push(`${col} = $${idx}`);
        params.push(val);
        idx++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    params.push(policyId, organizationId);
    const result = await db.query(
      `UPDATE policies SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${idx} AND organization_id = $${idx + 1}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    await db.query(
      `INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [organizationId, userId, 'POLICY_UPDATED', 'policy', policyId]
    );

    res.json({ message: 'Policy updated successfully', policy: result.rows[0] });
  }
);

policyRoutes.delete('/:policyId', async (req: Request, res: Response) => {
  const { policyId } = req.params;
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;

  const result = await db.query(
    'DELETE FROM policies WHERE id = $1 AND organization_id = $2 RETURNING *',
    [policyId, organizationId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Policy not found' });
  }

  await db.query(
    `INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [organizationId, userId, 'POLICY_DELETED', 'policy', policyId]
  );

  res.json({ message: 'Policy deleted successfully' });
});
