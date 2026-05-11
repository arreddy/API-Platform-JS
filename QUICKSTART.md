# Quick Start Guide

## 5-Minute Local Setup

### Prerequisites
- Docker & Docker Compose installed
- Git
- curl or Postman

### Step 1: Clone & Setup

```bash
git clone <repo-url>
cd API-Platform
cp .env.example .env
```

### Step 2: Start Services

```bash
docker-compose up -d
```

Wait for all services to be healthy:
```bash
docker-compose ps
```

Expected output:
```
NAME                  STATUS
postgres              healthy
redis                 healthy
elasticsearch         healthy
control-plane         healthy
data-plane            healthy
```

### Step 3: Verify Services

```bash
# Control Plane (port 3000)
curl http://localhost:3000/health
# Response: {"status":"healthy","timestamp":"..."}

# Data Plane (port 3001)
curl http://localhost:3001/health
# Response: {"status":"healthy","timestamp":"..."}
```

### Step 4: Create Test User & Get Token

```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "Test@1234",
    "firstName": "Test",
    "lastName": "User",
    "organizationName": "Test Org"
  }'

# Login and save token
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@1234"
  }' | jq -r '.token')

echo $TOKEN
```

### Step 5: Register Sample API

```bash
curl -X POST http://localhost:3000/api/v1/apis \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @samples/petstore-oas-3.0.json
```

### Step 6: Create Proxy

```bash
API_ID=$(curl -s http://localhost:3000/api/v1/apis \
  -H "Authorization: Bearer $TOKEN" | jq -r '.apis[0].id')

curl -X POST http://localhost:3000/api/v1/proxies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "apiId": "'$API_ID'",
    "name": "Pet Store Proxy",
    "basePath": "/api/v1/petstore",
    "targetEndpoint": "https://petstore.swagger.io/v2",
    "requireAuthentication": true,
    "enableRateLimiting": true
  }'
```

### Step 7: Deploy Proxy

```bash
PROXY_ID=$(curl -s http://localhost:3000/api/v1/proxies \
  -H "Authorization: Bearer $TOKEN" | jq -r '.proxies[0].id')

curl -X POST http://localhost:3000/api/v1/proxies/$PROXY_ID/deploy \
  -H "Authorization: Bearer $TOKEN"
```

### Step 8: Generate API Key

```bash
curl -X POST http://localhost:3000/api/v1/credentials \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Key",
    "apis": ["'$API_ID'"],
    "scopes": ["read", "write"]
  }' | jq .
```

Save the `key` value from response.

### Step 9: Test Proxied API

```bash
API_KEY="sk_live_..." # From step 8

curl -X GET http://localhost:3001/api/v1/petstore/pets \
  -H "X-API-Key: $API_KEY"
```

## 🎉 Success!

You now have:
- ✅ Control Plane running (API management)
- ✅ Data Plane running (API gateway)
- ✅ PostgreSQL database with schema
- ✅ Redis cache for sessions
- ✅ Elasticsearch for analytics
- ✅ Sample API registered
- ✅ Proxy deployed
- ✅ API key created
- ✅ Proxied API callable

## Next Steps

### Explore the Platform

1. **Check registered APIs**
   ```bash
   curl http://localhost:3000/api/v1/apis -H "Authorization: Bearer $TOKEN" | jq .
   ```

2. **View proxy details**
   ```bash
   curl http://localhost:3000/api/v1/proxies/$PROXY_ID -H "Authorization: Bearer $TOKEN" | jq .
   ```

3. **Get API usage analytics**
   ```bash
   curl "http://localhost:3000/api/v1/analytics/usage?startDate=2024-01-01" \
     -H "Authorization: Bearer $TOKEN" | jq .
   ```

4. **View audit logs**
   ```bash
   curl http://localhost:3000/api/v1/analytics/audit-logs -H "Authorization: Bearer $TOKEN" | jq .
   ```

### Access Dashboards

- **Kibana** (Logs & Analytics): http://localhost:5601
- **Elasticsearch** (Raw Data): http://localhost:9200

### Make More API Calls

```bash
# Get all pets
curl http://localhost:3001/api/v1/petstore/pets?status=available \
  -H "X-API-Key: $API_KEY"

# Get specific pet
curl http://localhost:3001/api/v1/petstore/pets/1 \
  -H "X-API-Key: $API_KEY"

# Create pet
curl -X POST http://localhost:3001/api/v1/petstore/pets \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 99,
    "name": "Fluffy",
    "category": {"id": 1, "name": "Dogs"},
    "photoUrls": ["https://example.com/photo.jpg"],
    "status": "available"
  }'
```

## Troubleshooting

### Services not healthy

```bash
# Check logs
docker-compose logs postgres
docker-compose logs control-plane
docker-compose logs data-plane

# Restart services
docker-compose restart

# Full reset
docker-compose down -v
docker-compose up -d
```

### Database issues

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d api_management

# Check tables
SELECT * FROM apis;
SELECT * FROM proxies;
```

### Port conflicts

If ports are already in use, update `docker-compose.yml`:
```yaml
ports:
  - "3000:3000"  # Change to 3002:3000
  - "3001:3001"  # Change to 3002:3001
```

## File Locations

- **Logs**: `./logs/` (created automatically)
- **Database data**: Docker volume `postgres_data`
- **Config**: `.env` file
- **Sample files**: `samples/` directory

## Stop Services

```bash
# Stop all services
docker-compose stop

# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: deletes data)
docker-compose down -v
```

## What's Next?

1. **Read Full Documentation**: See [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
2. **Explore Architecture**: See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
3. **Production Deployment**: See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
4. **Create More APIs**: Register your own OAS files
5. **Set Up Policies**: Add rate limiting, authentication
6. **Monitor Metrics**: Check analytics and performance

## Common Commands

```bash
# View all services
docker-compose ps

# View logs for a service
docker-compose logs -f control-plane

# Execute command in container
docker-compose exec control-plane npm test

# SSH into container
docker-compose exec postgres bash

# Remove all containers and data
docker-compose down -v

# Rebuild images
docker-compose build --no-cache

# Scale a service
docker-compose up -d --scale data-plane=3
```

---

**Need Help?** Check the [docs/](docs/) folder or open an issue on GitHub!
