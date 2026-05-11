import { db } from '../database/connection';

interface RequestLog {
  requestId: string;
  organizationId: string;
  proxyId: string;
  routeId: string;
  apiKeyId?: string;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  clientIp: string;
  userAgent?: string;
  success: boolean;
}

export const analyticsService = {
  async logRequest(data: RequestLog): Promise<void> {
    // Non-blocking — gateway response is already sent before this persists
    db.query(
      `INSERT INTO request_logs (
        id, organization_id, proxy_id, route_id, api_key_id,
        method, path, status_code, response_time,
        request_size, response_size, client_ip, user_agent, success
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, $14
      )`,
      [
        data.requestId,
        data.organizationId,
        data.proxyId,
        data.routeId,
        data.apiKeyId ?? null,
        data.method,
        data.path,
        data.statusCode,
        data.responseTime,
        data.requestSize,
        data.responseSize,
        data.clientIp,
        data.userAgent ?? null,
        data.success,
      ]
    ).catch((err: Error) => {
      console.error('Failed to persist request log:', err.message);
    });
  },
};
