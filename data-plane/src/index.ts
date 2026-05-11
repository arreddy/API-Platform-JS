import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import caching from '@fastify/caching';
import dotenv from 'dotenv';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

import { routerService } from './services/router.service';
import { authService } from './services/auth.service';
import { rateLimiterService } from './services/rate-limiter.service';
import { analyticsService } from './services/analytics.service';

dotenv.config();

// Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/gateway.log' }),
  ],
});

const fastify: FastifyInstance = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
  requestTimeout: 30000,
});

// Plugins
fastify.register(helmet);
fastify.register(cors, { origin: true });
fastify.register(rateLimit, { max: 1000, timeWindow: '15 minutes' });
fastify.register(caching, { privacy: caching.privacy.PRIVATE });

// Health check
fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
  reply.send({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Dynamic route handler
fastify.all('/:apiName/:apiVersion/:pathParam*', async (request: FastifyRequest, reply: FastifyReply) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    const params = request.params as any;
    const { apiName, apiVersion } = params;
    const path = '/' + (params.pathParam || '');
    const method = request.method;

    logger.info({
      requestId,
      apiName,
      apiVersion,
      method,
      path,
      ip: request.ip,
    });

    // 1. Route Resolution: Find proxy and route configuration
    const route = await routerService.resolveRoute(apiName, apiVersion, method, path);
    if (!route) {
      return reply.status(404).send({ error: 'API route not found' });
    }

    // 2. Authentication: Verify API key or OAuth token
    const apiKey = request.headers['x-api-key'] as string;
    if (route.requireAuth) {
      const credentials = await authService.verifyApiKey(apiKey, route.apis);
      if (!credentials) {
        return reply.status(401).send({ error: 'Invalid API key' });
      }
    }

    // 3. Rate Limiting: Check rate limit for this consumer
    const isRateLimited = await rateLimiterService.checkRateLimit(
      apiKey,
      route.proxyId,
      route.rateLimitRequests,
      route.rateLimitWindow
    );
    if (isRateLimited) {
      reply.header('Retry-After', '60');
      return reply.status(429).send({ error: 'Rate limit exceeded' });
    }

    // 4. Request Transformation: Apply request transformations
    const transformedRequest = await routerService.transformRequest(request, route);

    // 5. Backend Invocation: Call target backend
    const targetUrl = new URL(route.targetEndpoint);
    targetUrl.pathname = transformedRequest.path;
    targetUrl.search = new URLSearchParams(transformedRequest.query).toString();

    const response = await routerService.invokeBackend({
      url: targetUrl.toString(),
      method: transformedRequest.method,
      headers: transformedRequest.headers,
      body: transformedRequest.body,
      timeout: route.timeoutMs,
    });

    // 6. Response Transformation: Apply response transformations
    const transformedResponse = await routerService.transformResponse(response, route);

    // 7. Response Validation: Validate response schema
    if (route.validateResponse) {
      const isValid = await routerService.validateResponse(transformedResponse, route);
      if (!isValid) {
        logger.warn({
          requestId,
          warning: 'Response schema validation failed',
        });
      }
    }

    // 8. Analytics & Logging: Record metrics
    const duration = Date.now() - startTime;
    await analyticsService.logRequest({
      requestId,
      organizationId: route.organizationId,
      proxyId: route.proxyId,
      routeId: route.routeId,
      apiKeyId: apiKey ? undefined : undefined,
      method,
      path,
      statusCode: transformedResponse.statusCode,
      responseTime: duration,
      requestSize: JSON.stringify(transformedRequest).length,
      responseSize: JSON.stringify(transformedResponse).length,
      clientIp: request.ip,
      userAgent: request.headers['user-agent'],
      success: transformedResponse.statusCode >= 200 && transformedResponse.statusCode < 300,
    });

    // Send response
    reply
      .status(transformedResponse.statusCode)
      .headers(transformedResponse.headers)
      .send(transformedResponse.body);

  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error({
      requestId,
      error: error.message,
      stack: error.stack,
      duration,
    });

    reply.status(500).send({
      error: 'Internal gateway error',
      requestId,
    });
  }
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    logger.info('Data Plane Gateway running on port 3001');
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();

export default fastify;
