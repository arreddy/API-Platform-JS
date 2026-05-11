import { Router, Request, Response } from 'express';
import Joi from 'joi';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { validateRequest } from '../middleware/validation.middleware';
import { db } from '../database/connection';

export const credentialRoutes = Router();

const createCredentialSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  proxyIds: Joi.array().items(Joi.string().uuid()).default([]),
  scopes: Joi.array().items(Joi.string()).default(['read']),
  expiresAt: Joi.date().iso().greater('now').optional(),
  rateLimitOverride: Joi.number().integer().min(1).optional(),
});

function generateApiKey(): string {
  return 'ak_' + crypto.randomBytes(32).toString('hex');
}

credentialRoutes.post('/', validateRequest(createCredentialSchema), async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  const { name, description, proxyIds, scopes, expiresAt, rateLimitOverride } = req.body;

  const rawKey = generateApiKey();
  // Bcrypt is intentionally slow; 10 rounds is appropriate for API key storage
  const keyHash = await bcrypt.hash(rawKey, 10);
  const keyPrefix = rawKey.substring(0, 8);
  const keyId = uuidv4();

  const result = await db.query(
    `INSERT INTO api_keys (
      id, organization_id, name, description, key_hash, key_prefix,
      proxy_ids, scopes, expires_at, rate_limit_override, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id, name, description, key_prefix, scopes, proxy_ids, expires_at, created_at`,
    [
      keyId, organizationId, name, description || null, keyHash, keyPrefix,
      JSON.stringify(proxyIds), JSON.stringify(scopes), expiresAt || null,
      rateLimitOverride || null, userId,
    ]
  );

  await db.query(
    `INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, description)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [organizationId, userId, 'API_KEY_CREATED', 'api_key', keyId, `Created API key: ${name}`]
  );

  res.status(201).json({
    message: 'API key created successfully',
    credential: result.rows[0],
    apiKey: rawKey, // Shown only once — store securely
  });
});

credentialRoutes.get('/', async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  const { proxyId, limit = 20, offset = 0 } = req.query;

  let query = `
    SELECT id, name, description, key_prefix, scopes, proxy_ids,
           expires_at, is_active, rate_limit_override, last_used_at, created_at
    FROM api_keys
    WHERE organization_id = $1 AND revoked_at IS NULL
  `;
  const params: any[] = [organizationId];
  let idx = 2;

  if (proxyId) {
    // JSONB contains check
    query += ` AND proxy_ids @> $${idx}::jsonb`;
    params.push(JSON.stringify([proxyId]));
    idx++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const [result, countResult] = await Promise.all([
    db.query(query, params),
    db.query(
      'SELECT COUNT(*) FROM api_keys WHERE organization_id = $1 AND revoked_at IS NULL',
      [organizationId]
    ),
  ]);

  res.json({
    total: parseInt(countResult.rows[0].count),
    limit: parseInt(limit as string),
    offset: parseInt(offset as string),
    credentials: result.rows,
  });
});

const patchSchema = Joi.object({
  name: Joi.string().optional(),
  description: Joi.string().optional(),
  scopes: Joi.array().items(Joi.string()).optional(),
  expiresAt: Joi.date().iso().optional().allow(null),
  isActive: Joi.boolean().optional(),
  rateLimitOverride: Joi.number().integer().optional().allow(null),
  rotate: Joi.boolean().default(false),
});

credentialRoutes.patch('/:keyId', validateRequest(patchSchema), async (req: Request, res: Response) => {
  const { keyId } = req.params;
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  const { name, description, scopes, expiresAt, isActive, rateLimitOverride, rotate } = req.body;

  const updates: string[] = [];
  const params: any[] = [];
  let idx = 1;
  let rawKey: string | undefined;

  if (rotate) {
    rawKey = generateApiKey();
    const keyHash = await bcrypt.hash(rawKey, 10);
    const keyPrefix = rawKey.substring(0, 8);
    updates.push(`key_hash = $${idx}`, `key_prefix = $${idx + 1}`);
    params.push(keyHash, keyPrefix);
    idx += 2;
  }

  const fieldMap: Record<string, any> = {
    name, description,
    scopes: scopes !== undefined ? JSON.stringify(scopes) : undefined,
    expires_at: expiresAt,
    is_active: isActive,
    rate_limit_override: rateLimitOverride,
  };

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

  params.push(keyId, organizationId);
  const result = await db.query(
    `UPDATE api_keys SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${idx} AND organization_id = $${idx + 1} AND revoked_at IS NULL
     RETURNING id, name, description, key_prefix, scopes, expires_at, is_active`,
    params
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'API key not found' });
  }

  await db.query(
    `INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [organizationId, userId, rotate ? 'API_KEY_ROTATED' : 'API_KEY_UPDATED', 'api_key', keyId]
  );

  const response: any = { message: 'API key updated successfully', credential: result.rows[0] };
  if (rawKey) response.apiKey = rawKey; // Only returned on rotation

  res.json(response);
});

credentialRoutes.delete('/:keyId', async (req: Request, res: Response) => {
  const { keyId } = req.params;
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;

  const result = await db.query(
    `UPDATE api_keys SET revoked_at = CURRENT_TIMESTAMP, is_active = FALSE
     WHERE id = $1 AND organization_id = $2 AND revoked_at IS NULL
     RETURNING id`,
    [keyId, organizationId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'API key not found' });
  }

  await db.query(
    `INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [organizationId, userId, 'API_KEY_REVOKED', 'api_key', keyId]
  );

  res.json({ message: 'API key revoked successfully' });
});
