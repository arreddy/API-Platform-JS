# API Management Platform - Complete API Reference

## Base URLs

- **Control Plane**: `https://api.example.com/api/v1`
- **Data Plane**: `https://gateway.example.com`
- **Local Development**: `http://localhost:3000/api/v1` (Control Plane)

## Authentication

All Control Plane endpoints require authentication via JWT token in the `Authorization` header.

```bash
Authorization: Bearer <JWT_TOKEN>
```

### Authentication Endpoints

#### Register User
```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "secure-password",
  "firstName": "John",
  "lastName": "Doe",
  "organizationName": "Acme Corp"
}

Response: 201 Created
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "organizationId": "uuid"
  }
}
```

#### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password"
}

Response: 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

#### Refresh Token
```
POST /auth/refresh
Content-Type: application/json

{
  "token": "expired-jwt-token"
}

Response: 200 OK
{
  "token": "new-jwt-token",
  "expiresIn": 3600
}
```

---

## API Management Endpoints

### Register API

#### POST /apis
Register a new API with OpenAPI Specification.

```bash
POST /apis
Content-Type: application/json
Authorization: Bearer <TOKEN>

{
  "name": "Pet Store API",
  "description": "Public Pet Store API",
  "oasSpec": {
    "openapi": "3.0.3",
    "info": {
      "title": "Pet Store API",
      "version": "1.0.0",
      "description": "A sample API"
    },
    "servers": [
      {
        "url": "https://petstore.swagger.io/v2"
      }
    ],
    "paths": {
      "/pet": {
        "get": {
          "summary": "List pets",
          "responses": {
            "200": {
              "description": "Success"
            }
          }
        }
      }
    }
  },
  "oasFormat": "json",
  "visibility": "public",
  "tags": ["pets", "store"]
}

Response: 201 Created
{
  "message": "API registered successfully",
  "api": {
    "id": "api-uuid",
    "organizationId": "org-uuid",
    "name": "Pet Store API",
    "slug": "pet-store-api",
    "version": "1.0.0",
    "description": "Public Pet Store API",
    "status": "draft",
    "visibility": "public",
    "totalEndpoints": 12,
    "methods": ["GET", "POST", "PUT", "DELETE", "PATCH"],
    "createdAt": "2024-01-15T10:30:00Z",
    "createdBy": "user-uuid"
  }
}
```

### List APIs

#### GET /apis
List all APIs for the organization.

```bash
GET /apis?status=published&visibility=public&limit=20&offset=0
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "total": 45,
  "limit": 20,
  "offset": 0,
  "apis": [
    {
      "id": "api-uuid",
      "name": "Pet Store API",
      "slug": "pet-store-api",
      "version": "1.0.0",
      "description": "...",
      "status": "published",
      "visibility": "public",
      "totalEndpoints": 12,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Get API Details

#### GET /apis/{apiId}
Get detailed information about a specific API.

```bash
GET /apis/api-uuid-123
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "api": {
    "id": "api-uuid",
    "name": "Pet Store API",
    "description": "...",
    "version": "1.0.0",
    "oasSpec": { /* Full OAS 3.0 spec */ },
    "status": "published",
    "visibility": "public",
    "totalEndpoints": 12,
    "methods": ["GET", "POST", "PUT", "DELETE"],
    "proxyCount": 3,
    "versionCount": 2,
    "contactName": "API Support",
    "contactEmail": "support@example.com",
    "licenseUrl": "https://...",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-20T15:45:00Z"
  }
}
```

### Update API

#### PUT /apis/{apiId}
Update API metadata (not the OAS spec).

```bash
PUT /apis/api-uuid-123
Content-Type: application/json
Authorization: Bearer <TOKEN>

{
  "description": "Updated description",
  "visibility": "internal",
  "status": "published",
  "tags": ["updated", "tag"]
}

Response: 200 OK
{
  "message": "API updated successfully",
  "api": {
    "id": "api-uuid",
    "name": "Pet Store API",
    "description": "Updated description",
    // ... other fields
  }
}
```

### Delete API

#### DELETE /apis/{apiId}
Soft delete an API (safe deletion, data retained).

```bash
DELETE /apis/api-uuid-123
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "message": "API deleted successfully"
}
```

### API Versioning

#### POST /apis/{apiId}/versions
Create a new version of an API.

```bash
POST /apis/api-uuid-123/versions
Content-Type: application/json
Authorization: Bearer <TOKEN>

{
  "versionNumber": "1.1.0",
  "oasSpec": {
    // Updated OAS specification
  },
  "changelog": "- Added new endpoint /pets/{id}/photos\n- Deprecated /store endpoint",
  "breakingChanges": false
}

Response: 201 Created
{
  "message": "API version created successfully",
  "version": {
    "id": "version-uuid",
    "apiId": "api-uuid",
    "versionNumber": "1.1.0",
    "status": "active",
    "changelog": "...",
    "breakingChanges": false,
    "createdAt": "2024-01-25T11:00:00Z"
  }
}
```

#### GET /apis/{apiId}/versions
List all versions of an API.

```bash
GET /apis/api-uuid-123/versions
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "versions": [
    {
      "id": "version-uuid",
      "apiId": "api-uuid",
      "versionNumber": "1.1.0",
      "status": "active",
      "createdAt": "2024-01-25T11:00:00Z"
    },
    {
      "id": "version-uuid-2",
      "apiId": "api-uuid",
      "versionNumber": "1.0.0",
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## Proxy Management Endpoints

### Create Proxy

#### POST /proxies
Create a new proxy for an API.

```bash
POST /proxies
Content-Type: application/json
Authorization: Bearer <TOKEN>

{
  "apiId": "api-uuid-123",
  "name": "Pet Store Production Proxy",
  "description": "Production proxy for Pet Store API",
  "basePath": "/api/v1/petstore",
  "targetEndpoint": "https://petstore.swagger.io/v2",
  "requireAuthentication": true,
  "authType": "apikey",
  "enableRateLimiting": true,
  "enableCaching": true,
  "cacheTTLSeconds": 300,
  "timeoutMs": 30000,
  "corsEnabled": true,
  "corsOrigins": ["https://app.example.com", "https://admin.example.com"],
  "status": "draft"
}

Response: 201 Created
{
  "message": "Proxy created successfully",
  "proxy": {
    "id": "proxy-uuid",
    "apiId": "api-uuid",
    "name": "Pet Store Production Proxy",
    "basePath": "/api/v1/petstore",
    "targetEndpoint": "https://petstore.swagger.io/v2",
    "status": "draft",
    "createdAt": "2024-01-30T09:00:00Z"
  }
}
```

### List Proxies

#### GET /proxies
List all proxies for the organization.

```bash
GET /proxies?status=active&limit=20&offset=0
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "total": 15,
  "limit": 20,
  "offset": 0,
  "proxies": [
    {
      "id": "proxy-uuid",
      "apiId": "api-uuid",
      "name": "Pet Store Production Proxy",
      "basePath": "/api/v1/petstore",
      "status": "active",
      "deployedAt": "2024-02-01T10:00:00Z"
    }
  ]
}
```

### Get Proxy Details

#### GET /proxies/{proxyId}
Get detailed proxy configuration.

```bash
GET /proxies/proxy-uuid-123
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "proxy": {
    "id": "proxy-uuid",
    "apiId": "api-uuid",
    "name": "Pet Store Production Proxy",
    "basePath": "/api/v1/petstore",
    "targetEndpoint": "https://petstore.swagger.io/v2",
    "status": "active",
    "requireAuthentication": true,
    "authType": "apikey",
    "enableRateLimiting": true,
    "enableCaching": true,
    "corsEnabled": true,
    "corsOrigins": ["https://app.example.com"],
    "routes": [
      {
        "id": "route-uuid",
        "pathPattern": "/pet",
        "methods": ["GET", "POST"],
        "validateRequest": true,
        "validateResponse": true
      }
    ],
    "policies": [
      {
        "id": "policy-uuid",
        "type": "rate-limit",
        "enabled": true,
        "config": {
          "requests_per_minute": 1000
        }
      }
    ],
    "deployedAt": "2024-02-01T10:00:00Z"
  }
}
```

### Update Proxy

#### PUT /proxies/{proxyId}
Update proxy configuration.

```bash
PUT /proxies/proxy-uuid-123
Content-Type: application/json
Authorization: Bearer <TOKEN>

{
  "cacheTTLSeconds": 600,
  "corsOrigins": ["https://new-app.example.com"],
  "timeoutMs": 45000
}

Response: 200 OK
{
  "message": "Proxy updated successfully",
  "proxy": { /* Updated proxy object */ }
}
```

### Delete Proxy

#### DELETE /proxies/{proxyId}
Delete a proxy.

```bash
DELETE /proxies/proxy-uuid-123
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "message": "Proxy deleted successfully"
}
```

### Deploy Proxy

#### POST /proxies/{proxyId}/deploy
Deploy a proxy to the data plane gateway.

```bash
POST /proxies/proxy-uuid-123/deploy
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "message": "Proxy deployed successfully",
  "deployment": {
    "proxyId": "proxy-uuid",
    "status": "deployed",
    "deployedAt": "2024-02-01T10:00:00Z",
    "gatewayNodes": 5,
    "gatewayUrl": "https://gateway.example.com/api/v1/petstore"
  }
}
```

---

## Policy Management Endpoints

### Create Policy

#### POST /policies
Create a policy (rate limiting, auth, transformation, etc.).

```bash
POST /policies
Content-Type: application/json
Authorization: Bearer <TOKEN>

{
  "proxyId": "proxy-uuid-123",
  "name": "Strict Rate Limit",
  "type": "rate-limit",
  "config": {
    "type": "token_bucket",
    "requests_per_minute": 60,
    "burst_size": 10
  },
  "enabled": true,
  "priority": 100
}

Response: 201 Created
{
  "message": "Policy created successfully",
  "policy": {
    "id": "policy-uuid",
    "proxyId": "proxy-uuid",
    "name": "Strict Rate Limit",
    "type": "rate-limit",
    "enabled": true,
    "createdAt": "2024-02-01T10:00:00Z"
  }
}
```

### List Policies

#### GET /policies
List policies for a proxy.

```bash
GET /policies?proxyId=proxy-uuid&type=rate-limit
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "policies": [
    {
      "id": "policy-uuid",
      "proxyId": "proxy-uuid",
      "name": "Strict Rate Limit",
      "type": "rate-limit",
      "enabled": true
    }
  ]
}
```

### Update Policy

#### PUT /policies/{policyId}
Update policy configuration.

```bash
PUT /policies/policy-uuid-123
Content-Type: application/json
Authorization: Bearer <TOKEN>

{
  "config": {
    "requests_per_minute": 100
  }
}

Response: 200 OK
{
  "message": "Policy updated successfully",
  "policy": { /* Updated policy */ }
}
```

### Delete Policy

#### DELETE /policies/{policyId}
Delete a policy.

```bash
DELETE /policies/policy-uuid-123
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "message": "Policy deleted successfully"
}
```

---

## API Key Management Endpoints

### Generate API Key

#### POST /credentials
Generate a new API key for API access.

```bash
POST /credentials
Content-Type: application/json
Authorization: Bearer <TOKEN>

{
  "name": "Mobile App Key",
  "apis": ["api-uuid-123", "api-uuid-456"],
  "scopes": ["read", "write"],
  "rateLimitEnabled": true,
  "rateLimitRequestsPerMinute": 5000,
  "ipWhitelist": ["192.168.1.0/24"],
  "expiresIn": 7776000  // 90 days in seconds
}

Response: 201 Created
{
  "message": "API key generated successfully",
  "credential": {
    "id": "credential-uuid",
    "name": "Mobile App Key",
    "keyPrefix": "sk_live_abc123...",
    "key": "sk_live_abc123xyz789...",  // Only shown once
    "apis": ["api-uuid-123", "api-uuid-456"],
    "scopes": ["read", "write"],
    "expiresAt": "2024-05-01T00:00:00Z",
    "createdAt": "2024-02-01T10:00:00Z"
  },
  "warning": "Save the API key securely. You won't be able to see it again."
}
```

### List API Keys

#### GET /credentials
List all API keys for the user.

```bash
GET /credentials?status=active
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "credentials": [
    {
      "id": "credential-uuid",
      "name": "Mobile App Key",
      "keyPrefix": "sk_live_abc123...",
      "apis": ["api-uuid-123"],
      "scopes": ["read"],
      "status": "active",
      "lastUsedAt": "2024-02-01T15:30:00Z",
      "expiresAt": "2024-05-01T00:00:00Z",
      "createdAt": "2024-02-01T10:00:00Z"
    }
  ]
}
```

### Rotate API Key

#### PATCH /credentials/{keyId}
Rotate/regenerate an API key.

```bash
PATCH /credentials/credential-uuid-123
Content-Type: application/json
Authorization: Bearer <TOKEN>

{
  "action": "rotate"
}

Response: 200 OK
{
  "message": "API key rotated successfully",
  "credential": {
    "id": "credential-uuid",
    "name": "Mobile App Key",
    "newKeyPrefix": "sk_live_def456...",
    "expiresAt": "2024-05-01T00:00:00Z"
  }
}
```

### Revoke API Key

#### DELETE /credentials/{keyId}
Revoke an API key (cannot be undone).

```bash
DELETE /credentials/credential-uuid-123
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "message": "API key revoked successfully"
}
```

---

## Analytics Endpoints

### Get Usage Metrics

#### GET /analytics/usage
Get API usage statistics.

```bash
GET /analytics/usage?startDate=2024-01-01&endDate=2024-02-01&proxyId=proxy-uuid&granularity=daily
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "metrics": {
    "totalRequests": 1234567,
    "successfulRequests": 1200000,
    "failedRequests": 34567,
    "successRate": 97.2,
    "topApis": [
      {
        "proxyId": "proxy-uuid",
        "name": "Pet Store API",
        "requestCount": 500000,
        "percentage": 40.5
      }
    ],
    "byStatusCode": {
      "200": 900000,
      "400": 200000,
      "500": 34567
    },
    "dailyBreakdown": [
      {
        "date": "2024-01-01",
        "requests": 50000,
        "errors": 1500
      }
    ]
  }
}
```

### Get Performance Metrics

#### GET /analytics/performance
Get performance statistics.

```bash
GET /analytics/performance?startDate=2024-01-01&proxyId=proxy-uuid
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "metrics": {
    "avgResponseTime": 125.5,  // milliseconds
    "p50ResponseTime": 95,
    "p95ResponseTime": 350,
    "p99ResponseTime": 850,
    "avgRequestSize": 2048,    // bytes
    "avgResponseSize": 5120,   // bytes
    "throughput": 14250        // requests/minute
  }
}
```

### Get Error Statistics

#### GET /analytics/errors
Get error and exception statistics.

```bash
GET /analytics/errors?startDate=2024-01-01&proxyId=proxy-uuid&limit=20
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "errors": [
    {
      "errorCode": 500,
      "errorType": "Internal Server Error",
      "count": 100,
      "firstOccurrence": "2024-01-15T10:30:00Z",
      "lastOccurrence": "2024-02-01T15:45:00Z",
      "topMessages": [
        "Database connection timeout",
        "Service unavailable"
      ]
    }
  ]
}
```

### Get Audit Logs

#### GET /analytics/audit-logs
Get audit trail for compliance.

```bash
GET /analytics/audit-logs?startDate=2024-01-01&action=API_CREATED&resourceType=api&limit=50
Authorization: Bearer <TOKEN>

Response: 200 OK
{
  "logs": [
    {
      "id": "log-uuid",
      "timestamp": "2024-02-01T10:00:00Z",
      "userId": "user-uuid",
      "userEmail": "user@example.com",
      "action": "API_CREATED",
      "resourceType": "api",
      "resourceId": "api-uuid",
      "resourceName": "Pet Store API",
      "status": "success",
      "description": "Created API: Pet Store API",
      "ipAddress": "192.168.1.100",
      "changes": {
        "new": { "status": "draft" }
      }
    }
  ]
}
```

---

## Data Plane Gateway (Runtime) Endpoints

### Proxied API Requests

All requests to registered APIs are routed through the data plane gateway.

#### Dynamic Routing

```bash
{METHOD} /{apiName}/{apiVersion}/{path}
X-API-Key: sk_live_...

Example:
GET /petstore/v1/pets?status=available
POST /petstore/v1/pets
PUT /petstore/v1/pets/123
DELETE /petstore/v1/pets/123
```

#### Rate Limiting Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1644264000

When rate limited:
HTTP 429 Too Many Requests
Retry-After: 60
```

#### Request/Response Transformation

Proxy automatically:
- Validates requests against OAS schema
- Transforms headers based on configuration
- Validates responses
- Logs all traffic for analytics

---

## Error Responses

### Standard Error Format

```json
{
  "error": "Error title",
  "message": "Detailed error message",
  "code": "ERROR_CODE",
  "statusCode": 400,
  "details": {
    "field": "error details"
  },
  "timestamp": "2024-02-01T10:00:00Z",
  "requestId": "req-uuid"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request succeeded |
| 201 | Created - Resource created |
| 204 | No Content - Success with no body |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing/invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |
| 503 | Service Unavailable - Service down |

---

## Rate Limiting

Default rate limits:
- **Control Plane**: 1000 requests per 15 minutes per IP
- **Data Plane**: Per-API-key basis (configurable)

### Handling Rate Limits

```bash
# Check remaining requests
X-RateLimit-Remaining: 50

# Wait until reset time
Retry-After: 60  # seconds

# Exponential backoff implementation
function callWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.statusCode === 429) {
        const retryAfter = parseInt(error.headers['retry-after'] || '60');
        await sleep(retryAfter * 1000 * Math.pow(2, i));
      }
    }
  }
}
```

---

## Pagination

List endpoints support pagination:

```bash
GET /apis?limit=20&offset=40

Response includes:
{
  "total": 150,
  "limit": 20,
  "offset": 40,
  "items": [...]
}
```

---

## Webhooks & Callbacks

Configure webhooks for events:

```bash
POST /webhooks
{
  "url": "https://app.example.com/webhooks/api-events",
  "events": ["api.created", "api.updated", "api.deleted", "proxy.deployed"],
  "secret": "webhook-secret-key"
}
```

Webhook payload:

```json
{
  "id": "event-uuid",
  "timestamp": "2024-02-01T10:00:00Z",
  "event": "api.created",
  "data": {
    "apiId": "api-uuid",
    "name": "Pet Store API",
    "createdBy": "user-uuid"
  }
}
```

---

## Rate Limiting & Quota Management

### Organization Quotas

```bash
GET /organizations/{orgId}/quotas

{
  "quotas": {
    "totalApis": { "limit": 50, "used": 12 },
    "totalProxies": { "limit": 100, "used": 25 },
    "monthlyRequests": { "limit": 10000000, "used": 2500000 },
    "storageGB": { "limit": 100, "used": 25.5 }
  }
}
```

---

## SDK Examples

### JavaScript/Node.js

```typescript
import APIManagementClient from '@api-platform/sdk';

const client = new APIManagementClient({
  apiKey: 'sk_live_...',
  baseUrl: 'https://api.example.com/api/v1'
});

// Register API
const api = await client.apis.create({
  name: 'My API',
  description: 'My API Description',
  oasSpec: {...}
});

// Create Proxy
const proxy = await client.proxies.create({
  apiId: api.id,
  basePath: '/my-api',
  targetEndpoint: 'https://backend.example.com'
});

// Deploy Proxy
await client.proxies.deploy(proxy.id);

// Generate API Key
const key = await client.credentials.create({
  name: 'My App',
  apis: [api.id]
});
```

### Python

```python
from api_platform import APIManagementClient

client = APIManagementClient(
    api_key='sk_live_...',
    base_url='https://api.example.com/api/v1'
)

# Register API
api = client.apis.create(
    name='My API',
    description='My API Description',
    oas_spec={...}
)

# Create Proxy
proxy = client.proxies.create(
    api_id=api['id'],
    base_path='/my-api',
    target_endpoint='https://backend.example.com'
)

# Deploy
client.proxies.deploy(proxy['id'])
```

---

## Changelog

### v1.0.0 (2024-02-01)
- Initial release
- API registration with OAS 3.0/3.1 support
- Proxy management CRUD
- Rate limiting and authentication
- Analytics and audit logging
- Developer portal
- Kubernetes deployment

---

## Support & Community

- **Documentation**: https://docs.example.com
- **GitHub Issues**: https://github.com/api-platform/issues
- **Discord Community**: https://discord.gg/api-platform
- **Email Support**: support@example.com
