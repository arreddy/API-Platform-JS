# API Management Platform - Deployment & Operations Guide

## Table of Contents
1. [Local Development](#local-development)
2. [Production Deployment](#production-deployment)
3. [Configuration](#configuration)
4. [Monitoring & Observability](#monitoring--observability)
5. [Backup & Disaster Recovery](#backup--disaster-recovery)
6. [Troubleshooting](#troubleshooting)

## Local Development

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- Node.js 18+ (for direct development)
- PostgreSQL client tools (optional)
- Git

### Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd API-Platform

# Create environment file
cp .env.example .env

# Start all services
docker-compose up -d

# Verify services are healthy
docker-compose ps

# View logs
docker-compose logs -f control-plane
docker-compose logs -f data-plane
```

### Service URLs

| Service | URL | Port |
|---------|-----|------|
| Control Plane API | http://localhost:3000 | 3000 |
| Data Plane Gateway | http://localhost:3001 | 3001 |
| PostgreSQL | localhost | 5432 |
| Redis | localhost | 6379 |
| Elasticsearch | http://localhost:9200 | 9200 |
| Kibana | http://localhost:5601 | 5601 |

### Database Setup

```bash
# Run migrations
docker-compose exec control-plane npm run db:migrate

# Seed sample data
docker-compose exec control-plane npm run db:seed
```

### Accessing the Database

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d api_management

# Sample queries
SELECT * FROM apis;
SELECT * FROM proxies;
SELECT * FROM api_keys;
```

## Production Deployment

### Kubernetes Deployment

#### Prerequisites
- Kubernetes 1.24+
- kubectl configured
- Helm 3.0+ (optional)
- Docker registry access

#### Deployment Steps

```bash
# 1. Build and push Docker images
docker build -t your-registry/api-platform-control-plane:1.0.0 ./control-plane
docker build -t your-registry/api-platform-data-plane:1.0.0 ./data-plane

docker push your-registry/api-platform-control-plane:1.0.0
docker push your-registry/api-platform-data-plane:1.0.0

# 2. Update image references in deployment.yaml
sed -i 's|api-platform-control-plane:latest|your-registry/api-platform-control-plane:1.0.0|g' kubernetes/deployment.yaml
sed -i 's|api-platform-data-plane:latest|your-registry/api-platform-data-plane:1.0.0|g' kubernetes/deployment.yaml

# 3. Create namespace and deploy
kubectl apply -f kubernetes/deployment.yaml

# 4. Verify deployment
kubectl get pods -n api-management
kubectl get services -n api-management

# 5. Check logs
kubectl logs -f deployment/control-plane -n api-management
kubectl logs -f deployment/data-plane -n api-management
```

#### Scaling

```bash
# Auto-scaling is configured via HorizontalPodAutoscaler
# Check current status
kubectl get hpa -n api-management

# Manual scaling (if needed)
kubectl scale deployment control-plane --replicas=5 -n api-management
kubectl scale deployment data-plane --replicas=10 -n api-management
```

### AWS ECS Deployment (Alternative)

```bash
# Create ECS task definitions
aws ecs register-task-definition --cli-input-json file://ecs-task-control-plane.json
aws ecs register-task-definition --cli-input-json file://ecs-task-data-plane.json

# Create ECS services
aws ecs create-service \
  --cluster api-management \
  --service-name control-plane \
  --task-definition control-plane:1 \
  --desired-count 3 \
  --load-balancers targetGroupArn=...,containerName=control-plane,containerPort=3000

aws ecs create-service \
  --cluster api-management \
  --service-name data-plane \
  --task-definition data-plane:1 \
  --desired-count 5 \
  --load-balancers targetGroupArn=...,containerName=data-plane,containerPort=3001
```

## Configuration

### Environment Variables

**.env file** (local development):
```env
# Database
DB_USER=postgres
DB_PASSWORD=your-secure-password
DB_HOST=postgres
DB_PORT=5432
DB_NAME=api_management

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key-min-32-chars

# Logging
LOG_LEVEL=info
NODE_ENV=development

# Storage
STORAGE_TYPE=s3  # or 'local', 'minio'
S3_BUCKET=api-platform-specs
S3_REGION=us-east-1

# Email (for notifications)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=password
```

### PostgreSQL Configuration

**Max connections** (for production):
```sql
-- Edit postgresql.conf
max_connections = 500

-- Or via environment
docker run -e POSTGRES_INITDB_ARGS="-c max_connections=500" ...
```

### Redis Configuration

**For production use**:
```bash
# Update docker-compose.yml or add redis.conf
redis-server /etc/redis/redis.conf \
  --maxmemory 2gb \
  --maxmemory-policy allkeys-lru \
  --appendonly yes \
  --appendfsync everysec
```

## Monitoring & Observability

### Prometheus Metrics

Create `prometheus.yml`:
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'control-plane'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'

  - job_name: 'data-plane'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']  # postgres_exporter

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']  # redis_exporter
```

### Grafana Dashboards

1. Import official dashboards:
   - Kubernetes Cluster Monitoring
   - PostgreSQL Dashboard
   - Redis Dashboard
   - Application Performance Monitoring

2. Create custom dashboards:
   - API Request Rate
   - Response Time Distribution
   - Error Rate Trend
   - Resource Utilization

### Log Aggregation (ELK Stack)

**Logstash Configuration**:
```conf
input {
  file {
    path => "/var/log/api-platform/*.log"
    codec => json
    start_position => "beginning"
  }
}

filter {
  mutate {
    add_field => { "environment" => "production" }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "api-platform-%{+YYYY.MM.dd}"
  }
}
```

### Health Checks

```bash
# Control Plane
curl http://localhost:3000/health

# Data Plane
curl http://localhost:3001/health

# Database
docker-compose exec postgres pg_isready

# Redis
docker-compose exec redis redis-cli ping

# Elasticsearch
curl http://localhost:9200/_cluster/health
```

## Backup & Disaster Recovery

### Database Backup

```bash
# Manual backup
docker-compose exec postgres pg_dump -U postgres api_management > backup-$(date +%Y%m%d).sql

# Automated daily backup (cron)
0 2 * * * /scripts/backup-postgres.sh

# Restore from backup
docker-compose exec -T postgres psql -U postgres api_management < backup-20240101.sql
```

### Kubernetes Persistent Volume Backup

```bash
# Using Velero
velero install --secret-file ./credentials-aws

# Create backup
velero backup create api-platform-full

# Restore backup
velero restore create --from-backup api-platform-full

# Schedule daily backups
velero schedule create daily-backup --schedule="0 2 * * *"
```

### Multi-Region Replication

For high availability:

```sql
-- PostgreSQL Replication
-- Primary server
CREATE PUBLICATION pub_api_management FOR ALL TABLES;

-- Replica server
CREATE SUBSCRIPTION sub_api_management CONNECTION 'dbname=api_management host=primary-db' PUBLICATION pub_api_management;
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

```bash
# Check PostgreSQL service
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres psql -U postgres -d api_management -c "SELECT 1"

# Check environment variables
docker-compose exec control-plane env | grep DB
```

#### 2. API Gateway Timeouts

```bash
# Increase timeout in gateway config
timeout_ms: 60000  # 60 seconds

# Check backend service health
curl -v https://backend-service/health

# Monitor response times
kubectl logs -f deployment/data-plane -n api-management | grep "response_time"
```

#### 3. High Memory Usage

```bash
# Check container memory limits
docker stats
kubectl describe pod <pod-name> -n api-management

# Increase limits in docker-compose or deployment.yaml
resources:
  limits:
    memory: 2Gi
    cpu: 2000m
```

#### 4. Rate Limiting Not Working

```bash
# Check Redis connection
docker-compose exec redis redis-cli PING

# Verify rate limit keys in Redis
docker-compose exec redis redis-cli KEYS "rate-limit:*"

# Check rate limiter service logs
docker-compose logs data-plane | grep "rate"
```

### Performance Tuning

#### Connection Pooling

```typescript
// In database.ts
pool = new Pool({
  max: 50,  // Maximum connections
  min: 10,  // Minimum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

#### Query Optimization

```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_apis_org_status ON apis(organization_id, status);
CREATE INDEX idx_proxies_api_id ON proxies(api_id);
CREATE INDEX idx_request_logs_timestamp ON request_logs(requested_at DESC);
```

#### Caching Strategy

```typescript
// Redis caching for API metadata
const cacheKey = `api:${apiId}:metadata`;
const cached = await redis.get(cacheKey);

if (!cached) {
  const data = await db.query('SELECT * FROM apis WHERE id = $1', [apiId]);
  await redis.setex(cacheKey, 3600, JSON.stringify(data)); // 1 hour TTL
}
```

### Debug Logs

Enable detailed logging:

```env
LOG_LEVEL=debug
DEBUG=api-platform:*
```

### Performance Metrics

Monitor via Prometheus/Grafana:

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_failed_total[5m]) / rate(http_requests_total[5m])

# P95 response time
histogram_quantile(0.95, http_request_duration_seconds_bucket)

# Database query latency
rate(db_query_duration_seconds_sum[5m]) / rate(db_query_duration_seconds_count[5m])
```

### Contact & Support

For issues:
1. Check logs: `docker-compose logs [service]`
2. Review documentation: `/docs`
3. File issue in GitHub
4. Contact support@example.com
