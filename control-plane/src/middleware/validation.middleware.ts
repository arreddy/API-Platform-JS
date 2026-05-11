import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        organizationId: string;
        role: string;
      };
    }
  }
}

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.validateAsync(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });
      req.body = validated;
      next();
    } catch (error: any) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.details?.map((d: any) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }
  };
};

export const validateOAS = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { oasSpec } = req.body;

    // Basic OAS validation
    if (!oasSpec.openapi && !oasSpec.swagger) {
      return res.status(400).json({
        error: 'Invalid OpenAPI specification: Missing openapi or swagger version',
      });
    }

    if (!oasSpec.info?.title) {
      return res.status(400).json({
        error: 'Invalid OpenAPI specification: Missing info.title',
      });
    }

    if (!oasSpec.info?.version) {
      return res.status(400).json({
        error: 'Invalid OpenAPI specification: Missing info.version',
      });
    }

    if (!oasSpec.paths) {
      return res.status(400).json({
        error: 'Invalid OpenAPI specification: Missing paths',
      });
    }

    next();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
