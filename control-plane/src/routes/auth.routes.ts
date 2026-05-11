import { Router, Request, Response } from 'express';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { validateRequest } from '../middleware/validation.middleware';
import { db } from '../database/connection';

export const authRoutes = Router();

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  organizationName: Joi.string().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';

authRoutes.post('/register', validateRequest(registerSchema), async (req: Request, res: Response) => {
  const { email, username, password, firstName, lastName, organizationName } = req.body;

  const existing = await db.query(
    'SELECT id FROM users WHERE email = $1 OR username = $2',
    [email, username]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'User with this email or username already exists' });
  }

  const userId = uuidv4();
  const passwordHash = await bcrypt.hash(password, 12);

  await db.query(
    `INSERT INTO users (id, email, username, password_hash, first_name, last_name, role)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, email, username, passwordHash, firstName || null, lastName || null, 'owner']
  );

  let organizationId: string | null = null;
  if (organizationName) {
    organizationId = uuidv4();
    const slug = organizationName.toLowerCase().replace(/\s+/g, '-');
    await db.query(
      `INSERT INTO organizations (id, name, slug, owner_id)
       VALUES ($1, $2, $3, $4)`,
      [organizationId, organizationName, slug, userId]
    );
    await db.query('UPDATE users SET organization_id = $1 WHERE id = $2', [organizationId, userId]);
  }

  const token = jwt.sign(
    { id: userId, email, organizationId, role: 'owner' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const refreshToken = jwt.sign(
    { id: userId, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    message: 'User registered successfully',
    token,
    refreshToken,
    user: { id: userId, email, username, organizationId },
  });
});

authRoutes.post('/login', validateRequest(loginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const result = await db.query(
    'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
    [email]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = result.rows[0];
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  await db.query(
    'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
    [user.id]
  );

  const token = jwt.sign(
    { id: user.id, email: user.email, organizationId: user.organization_id, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      organizationId: user.organization_id,
      role: user.role,
    },
  });
});

authRoutes.post('/refresh', validateRequest(refreshSchema), async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  let decoded: any;
  try {
    decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  if (decoded.type !== 'refresh') {
    return res.status(401).json({ error: 'Invalid token type' });
  }

  const result = await db.query(
    'SELECT * FROM users WHERE id = $1 AND is_active = TRUE',
    [decoded.id]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'User not found' });
  }

  const user = result.rows[0];
  const token = jwt.sign(
    { id: user.id, email: user.email, organizationId: user.organization_id, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token });
});
