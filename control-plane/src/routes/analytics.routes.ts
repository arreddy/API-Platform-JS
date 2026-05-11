import { Router, Request, Response } from 'express';
import { db } from '../database/connection';

export const analyticsRoutes = Router();

analyticsRoutes.get('/usage', async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  const { proxyId, startDate, endDate, interval = 'day' } = req.query;

  const validIntervals = ['hour', 'day', 'week', 'month'];
  const bucketInterval = validIntervals.includes(interval as string) ? interval : 'day';

  const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end   = endDate   ? new Date(endDate as string)   : new Date();

  let timeSeriesQuery = `
    SELECT
      DATE_TRUNC($1, created_at) AS period,
      COUNT(*)                                                  AS total_requests,
      COUNT(*) FILTER (WHERE success = TRUE)                    AS successful_requests,
      COUNT(*) FILTER (WHERE success = FALSE)                   AS failed_requests,
      ROUND(AVG(response_time)::numeric, 2)                    AS avg_response_time,
      SUM(request_size)                                         AS total_request_bytes,
      SUM(response_size)                                        AS total_response_bytes
    FROM request_logs
    WHERE organization_id = $2 AND created_at BETWEEN $3 AND $4
  `;
  const tsParams: any[] = [bucketInterval, organizationId, start, end];
  let idx = 5;

  if (proxyId) { timeSeriesQuery += ` AND proxy_id = $${idx}`; tsParams.push(proxyId); idx++; }
  timeSeriesQuery += ' GROUP BY period ORDER BY period ASC';

  let summaryQuery = `
    SELECT
      COUNT(*)                                      AS total_requests,
      COUNT(*) FILTER (WHERE success = TRUE)        AS successful_requests,
      COUNT(*) FILTER (WHERE success = FALSE)       AS failed_requests,
      ROUND(AVG(response_time)::numeric, 2)        AS avg_response_time,
      COUNT(DISTINCT client_ip)                     AS unique_clients
    FROM request_logs
    WHERE organization_id = $1 AND created_at BETWEEN $2 AND $3
  `;
  const sumParams: any[] = [organizationId, start, end];
  if (proxyId) { summaryQuery += ' AND proxy_id = $4'; sumParams.push(proxyId); }

  const [timeSeriesResult, summaryResult] = await Promise.all([
    db.query(timeSeriesQuery, tsParams),
    db.query(summaryQuery, sumParams),
  ]);

  res.json({
    summary: summaryResult.rows[0],
    timeSeries: timeSeriesResult.rows,
    period: { start, end, interval: bucketInterval },
  });
});

analyticsRoutes.get('/performance', async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  const { proxyId, startDate, endDate } = req.query;

  const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const end   = endDate   ? new Date(endDate as string)   : new Date();

  let query = `
    SELECT
      proxy_id,
      method,
      COUNT(*)                                                                          AS request_count,
      ROUND(AVG(response_time)::numeric, 2)                                            AS avg_response_time,
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY response_time)::numeric, 2)  AS p50,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time)::numeric, 2)  AS p95,
      ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time)::numeric, 2)  AS p99,
      MIN(response_time)                                                                AS min_response_time,
      MAX(response_time)                                                                AS max_response_time
    FROM request_logs
    WHERE organization_id = $1 AND created_at BETWEEN $2 AND $3
  `;
  const params: any[] = [organizationId, start, end];

  if (proxyId) { query += ' AND proxy_id = $4'; params.push(proxyId); }
  query += ' GROUP BY proxy_id, method ORDER BY avg_response_time DESC';

  const result = await db.query(query, params);
  res.json({ performance: result.rows, period: { start, end } });
});

analyticsRoutes.get('/errors', async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  const { proxyId, startDate, endDate } = req.query;

  const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const end   = endDate   ? new Date(endDate as string)   : new Date();

  let query = `
    SELECT
      status_code,
      method,
      COUNT(*)                                                                      AS count,
      ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 2)               AS percentage,
      MAX(created_at)                                                               AS last_seen
    FROM request_logs
    WHERE organization_id = $1 AND created_at BETWEEN $2 AND $3
      AND status_code >= 400
  `;
  const params: any[] = [organizationId, start, end];

  if (proxyId) { query += ' AND proxy_id = $4'; params.push(proxyId); }
  query += ' GROUP BY status_code, method ORDER BY count DESC';

  const result = await db.query(query, params);
  res.json({ errors: result.rows, period: { start, end } });
});

analyticsRoutes.get('/audit-logs', async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  const { action, resourceType, userId, startDate, endDate, limit = 50, offset = 0 } = req.query;

  let query = `
    SELECT al.*, u.email AS user_email, u.username
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE al.organization_id = $1
  `;
  const params: any[] = [organizationId];
  let idx = 2;

  if (action)       { query += ` AND al.action = $${idx}`;        params.push(action);                   idx++; }
  if (resourceType) { query += ` AND al.resource_type = $${idx}`; params.push(resourceType);             idx++; }
  if (userId)       { query += ` AND al.user_id = $${idx}`;       params.push(userId);                   idx++; }
  if (startDate)    { query += ` AND al.created_at >= $${idx}`;   params.push(new Date(startDate as string)); idx++; }
  if (endDate)      { query += ` AND al.created_at <= $${idx}`;   params.push(new Date(endDate as string));   idx++; }

  query += ` ORDER BY al.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const [result, countResult] = await Promise.all([
    db.query(query, params),
    db.query('SELECT COUNT(*) FROM audit_logs WHERE organization_id = $1', [organizationId]),
  ]);

  res.json({
    total: parseInt(countResult.rows[0].count),
    limit: parseInt(limit as string),
    offset: parseInt(offset as string),
    logs: result.rows,
  });
});
