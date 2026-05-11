# API Management Platform - Database Schema

## Overview
PostgreSQL 14+ schema supporting API registration, proxy management, analytics, and governance.

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           ORGANIZATIONS                             │
│ ┌──────────┬─────────────┬──────────┬───────────┬──────────────┐   │
│ │id (PK)   │name         │slug      │created_at │updated_at    │   │
│ │ owner_id │tier (free.. │storage   │api_quota  │is_active     │   │
│ └──────────┴─────────────┴──────────┴───────────┴──────────────┘   │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
        ┌──────────┴──────────────┬─────────────────────┐
        │                         │                     │
        ▼                         ▼                     ▼
   ┌─────────┐           ┌─────────────┐        ┌────────────┐
   │  USERS  │           │    APIS     │        │   PROXIES  │
   └─────────┘           └─────────────┘        └────────────┘
        │                      │                      │
        │                      ├──────┐               │
        │                      ▼      ▼               │
        │              ┌──────────────────┐           │
        │              │  API_VERSIONS    │           │
        │              └──────────────────┘           │
        │                      │                      │
        │                      └──────┬───────────────┘
        │                             │
        │         ┌───────────────────┼───────────────────┐
        │         │                   │                   │
        ▼         ▼                   ▼                   ▼
   ┌─────────────────┐        ┌──────────────┐     ┌────────────┐
   │   API_KEYS      │        │    ROUTES    │     │  POLICIES  │
   └─────────────────┘        └──────────────┘     └────────────┘
        │                           │                    │
        └───────────┬───────────────┼────────────────────┤
                    │               │                    │
                    ▼               ▼                    ▼
            ┌─────────────────┐ ┌────────────┐    ┌──────────────┐
            │  REQUEST_LOGS   │ │ TRANSFORMS │    │ RATE_LIMITS  │
            └─────────────────┘ └────────────┘    └──────────────┘
                    │
                    ▼
            ┌─────────────────┐
            │   ANALYTICS     │
            └─────────────────┘
                    │
                    ▼
            ┌─────────────────┐
            │  AUDIT_LOGS     │
            └─────────────────┘
```

## Table Definitions

### 1. ORGANIZATIONS
Represents API producer organizations.

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier VARCHAR(50) DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'professional', 'enterprise')),
  storage_quota BIGINT DEFAULT 1073741824, -- 1GB default
  api_quota INTEGER DEFAULT 10,
  monthly_request_quota BIGINT DEFAULT 1000000,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_owner_id ON organizations(owner_id);
```

### 2. USERS
Platform users (API producers and consumers).

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url VARCHAR(500),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('admin', 'owner', 'member', 'viewer')),
  is_email_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization_id ON users(organization_id);
```

### 3. APIS
Registered APIs with OpenAPI specifications.

```sql
CREATE TABLE apis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  version VARCHAR(50) NOT NULL,
  base_path VARCHAR(255),
  
  -- OAS Metadata
  oas_spec JSONB NOT NULL, -- Full OpenAPI 3.0/3.1 specification
  oas_spec_url VARCHAR(500), -- URL to OAS file in storage
  oas_format VARCHAR(20) DEFAULT 'json' CHECK (oas_format IN ('json', 'yaml')),
  
  -- API Details
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_url VARCHAR(500),
  license_name VARCHAR(255),
  license_url VARCHAR(500),
  terms_of_service VARCHAR(500),
  external_docs_url VARCHAR(500),
  
  -- Endpoints info
  total_endpoints INTEGER DEFAULT 0,
  methods JSONB DEFAULT '[]', -- Array of unique HTTP methods
  
  -- Status
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'deprecated', 'retired')),
  visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'internal')),
  
  -- Metadata
  tags JSONB DEFAULT '[]', -- Array of tags/categories
  metadata JSONB DEFAULT '{}',
  
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(organization_id, slug, version)
);

CREATE INDEX idx_apis_organization_id ON apis(organization_id);
CREATE INDEX idx_apis_slug ON apis(slug);
CREATE INDEX idx_apis_status ON apis(status);
CREATE INDEX idx_apis_visibility ON apis(visibility);
```

### 4. API_VERSIONS
Version history and rollback support.

```sql
CREATE TABLE api_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  version_number VARCHAR(50) NOT NULL,
  oas_spec JSONB NOT NULL,
  changelog TEXT,
  breaking_changes BOOLEAN DEFAULT FALSE,
  deprecation_date TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'beta', 'deprecated')),
  
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(api_id, version_number)
);

CREATE INDEX idx_api_versions_api_id ON api_versions(api_id);
CREATE INDEX idx_api_versions_status ON api_versions(status);
```

### 5. PROXIES
Proxy configurations for routing and transformations.

```sql
CREATE TABLE proxies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  api_id UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  api_version_id UUID REFERENCES api_versions(id) ON DELETE SET NULL,
  
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Proxy Configuration
  base_path VARCHAR(255) NOT NULL, -- /api/v1/petstore
  target_endpoint VARCHAR(500) NOT NULL, -- Backend URL
  
  -- Security
  require_authentication BOOLEAN DEFAULT TRUE,
  auth_type VARCHAR(50) DEFAULT 'apikey' CHECK (auth_type IN ('apikey', 'oauth2', 'jwt', 'basic', 'mtls', 'none')),
  
  -- Features
  enable_rate_limiting BOOLEAN DEFAULT TRUE,
  enable_caching BOOLEAN DEFAULT TRUE,
  cache_ttl_seconds INTEGER DEFAULT 300,
  enable_mock_mode BOOLEAN DEFAULT FALSE, -- Serve OAS examples
  
  -- Status
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'deprecated')),
  
  -- Config
  cors_enabled BOOLEAN DEFAULT TRUE,
  cors_origins JSONB DEFAULT '["*"]',
  timeout_ms INTEGER DEFAULT 30000,
  
  metadata JSONB DEFAULT '{}',
  
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  deployed_by UUID REFERENCES users(id),
  
  deployed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_proxies_organization_id ON proxies(organization_id);
CREATE INDEX idx_proxies_api_id ON proxies(api_id);
CREATE INDEX idx_proxies_status ON proxies(status);
```

### 6. ROUTES
Individual route definitions within a proxy.

```sql
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proxy_id UUID NOT NULL REFERENCES proxies(id) ON DELETE CASCADE,
  
  path_pattern VARCHAR(500) NOT NULL, -- /pets/{petId}
  methods JSONB NOT NULL DEFAULT '[]', -- ["GET", "POST"]
  
  -- Route Configuration
  target_path VARCHAR(500), -- Backend path override
  request_body_schema JSONB, -- Request schema from OAS
  response_schemas JSONB DEFAULT '{}', -- Response schemas by status code
  
  -- Transformations
  request_headers_map JSONB DEFAULT '{}', -- Header transformations
  response_headers_map JSONB DEFAULT '{}',
  request_body_transform VARCHAR(1000), -- Transformation logic (JSONPath, etc.)
  response_body_transform VARCHAR(1000),
  
  -- Validation
  validate_request BOOLEAN DEFAULT TRUE,
  validate_response BOOLEAN DEFAULT TRUE,
  
  -- Rate limiting
  rate_limit_enabled BOOLEAN DEFAULT FALSE,
  rate_limit_requests INTEGER,
  rate_limit_window_seconds INTEGER,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'disabled')),
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(proxy_id, path_pattern)
);

CREATE INDEX idx_routes_proxy_id ON routes(proxy_id);
```

### 7. POLICIES
Rate limiting, authentication, and custom policies.

```sql
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  proxy_id UUID NOT NULL REFERENCES proxies(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('rate-limit', 'authentication', 'transformation', 'logging', 'caching', 'cors', 'custom')),
  
  -- Policy Configuration (JSON for flexibility)
  config JSONB NOT NULL DEFAULT '{}',
  
  -- Rate Limiting Config Example:
  -- {
  --   "type": "token_bucket",
  --   "requests_per_minute": 100,
  --   "burst_size": 10
  -- }
  
  -- Authentication Config Example:
  -- {
  --   "providers": ["apikey", "oauth2"],
  --   "jwt_issuer": "https://auth.example.com",
  --   "scopes": ["read:api", "write:api"]
  -- }
  
  enabled BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 100, -- Lower = higher priority
  
  -- Conditional enforcement
  conditions JSONB DEFAULT '{}', -- e.g., {"path": "/admin/*", "method": "POST"}
  
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_policies_proxy_id ON policies(proxy_id);
CREATE INDEX idx_policies_type ON policies(type);
CREATE INDEX idx_policies_enabled ON policies(enabled);
```

### 8. API_KEYS
Credentials for API consumers.

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL UNIQUE, -- SHA256 hash of actual key
  key_prefix VARCHAR(20) NOT NULL, -- For display, e.g., "sk_live_..."
  
  -- Permissions
  apis JSONB DEFAULT '[]', -- Array of API IDs this key can access
  scopes JSONB DEFAULT '[]', -- Array of scopes ["read", "write"]
  
  -- Rate limiting
  rate_limit_enabled BOOLEAN DEFAULT FALSE,
  rate_limit_requests_per_minute INTEGER DEFAULT 1000,
  
  -- Validity
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  
  -- Metadata
  ip_whitelist JSONB DEFAULT '[]', -- Allowed IP addresses
  referrer_whitelist JSONB DEFAULT '[]', -- Allowed referrers
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_organization_id ON api_keys(organization_id);
CREATE INDEX idx_api_keys_status ON api_keys(status);
```

### 9. REQUEST_LOGS
Detailed request/response logging for analytics.

```sql
CREATE TABLE request_logs (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  proxy_id UUID NOT NULL REFERENCES proxies(id),
  route_id UUID REFERENCES routes(id),
  api_key_id UUID REFERENCES api_keys(id),
  
  -- Request Details
  request_id VARCHAR(100) NOT NULL UNIQUE, -- Correlation ID
  http_method VARCHAR(10) NOT NULL,
  request_path VARCHAR(500) NOT NULL,
  query_string TEXT,
  
  -- Request size/timing
  request_size_bytes INTEGER,
  response_status_code INTEGER,
  response_time_ms INTEGER,
  response_size_bytes INTEGER,
  
  -- Request IP
  client_ip VARCHAR(45),
  user_agent VARCHAR(500),
  
  -- Status
  success BOOLEAN,
  error_message TEXT,
  
  -- Timestamps
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- For retention policies
  TTL TIMESTAMP WITH TIME ZONE GENERATED ALWAYS AS (requested_at + INTERVAL '90 days') STORED
);

CREATE INDEX idx_request_logs_organization_id ON request_logs(organization_id, requested_at DESC);
CREATE INDEX idx_request_logs_proxy_id ON request_logs(proxy_id, requested_at DESC);
CREATE INDEX idx_request_logs_api_key_id ON request_logs(api_key_id, requested_at DESC);
CREATE INDEX idx_request_logs_timestamp ON request_logs(requested_at DESC);
```

### 10. ANALYTICS
Aggregated metrics (hourly/daily rollups).

```sql
CREATE TABLE analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  proxy_id UUID NOT NULL REFERENCES proxies(id) ON DELETE CASCADE,
  
  -- Time dimension
  metric_date DATE NOT NULL,
  metric_hour INTEGER DEFAULT 0, -- 0-23
  
  -- Counts
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  
  -- Timing
  avg_response_time_ms DECIMAL(10, 2),
  p50_response_time_ms INTEGER,
  p95_response_time_ms INTEGER,
  p99_response_time_ms INTEGER,
  
  -- Traffic
  total_bytes_in BIGINT DEFAULT 0,
  total_bytes_out BIGINT DEFAULT 0,
  
  -- Errors
  error_breakdown JSONB DEFAULT '{}', -- {"404": 10, "500": 2}
  
  -- Status codes
  status_codes JSONB DEFAULT '{}', -- {"200": 950, "400": 45, "500": 5}
  
  -- Rate limiting
  rate_limited_requests INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(organization_id, proxy_id, metric_date, metric_hour)
);

CREATE INDEX idx_analytics_proxy_id_date ON analytics(proxy_id, metric_date DESC);
CREATE INDEX idx_analytics_organization_id_date ON analytics(organization_id, metric_date DESC);
```

### 11. AUDIT_LOGS
Compliance and governance audit trail.

```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  action VARCHAR(100) NOT NULL, -- "API_CREATED", "PROXY_DEPLOYED", "KEY_REVOKED"
  resource_type VARCHAR(50) NOT NULL, -- "api", "proxy", "api_key", "policy"
  resource_id VARCHAR(100),
  
  -- Change tracking
  changes JSONB DEFAULT '{}', -- {"old": {...}, "new": {...}}
  
  -- Details
  status VARCHAR(50) NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure')),
  description TEXT,
  error_details TEXT,
  
  -- IP and context
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```

### 12. RATE_LIMIT_COUNTERS
Real-time rate limiting state.

```sql
CREATE TABLE rate_limit_counters (
  id BIGSERIAL PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  proxy_id UUID NOT NULL REFERENCES proxies(id) ON DELETE CASCADE,
  
  request_count INTEGER DEFAULT 0,
  window_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  window_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  
  UNIQUE(api_key_id, proxy_id, window_start_time)
);

CREATE INDEX idx_rate_limit_counters_key_proxy ON rate_limit_counters(api_key_id, proxy_id);
```

## Stored Procedures and Functions

### Function: Extract OAS Metadata
```sql
CREATE OR REPLACE FUNCTION extract_oas_metadata(oas_spec JSONB)
RETURNS TABLE (
  title VARCHAR,
  version VARCHAR,
  base_path VARCHAR,
  contact_name VARCHAR,
  contact_email VARCHAR,
  endpoints INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (oas_spec -> 'info' ->> 'title')::VARCHAR,
    (oas_spec -> 'info' ->> 'version')::VARCHAR,
    (oas_spec -> 'servers' -> 0 ->> 'url')::VARCHAR,
    (oas_spec -> 'info' -> 'contact' ->> 'name')::VARCHAR,
    (oas_spec -> 'info' -> 'contact' ->> 'email')::VARCHAR,
    jsonb_object_keys(oas_spec -> 'paths') ::INTEGER;
END;
$$ LANGUAGE plpgsql;
```

### Trigger: Update Updated_At Timestamp
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all major tables
CREATE TRIGGER trigger_apis_updated_at BEFORE UPDATE ON apis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_proxies_updated_at BEFORE UPDATE ON proxies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_policies_updated_at BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Indexes Summary

**Performance Indexes:**
- Organization lookups: `idx_organizations_slug`, `idx_organizations_owner_id`
- User lookups: `idx_users_email`, `idx_users_organization_id`
- API queries: `idx_apis_organization_id`, `idx_apis_slug`, `idx_apis_status`
- Proxy queries: `idx_proxies_organization_id`, `idx_proxies_api_id`, `idx_proxies_status`
- Request logs: Time-series indexes for analytics queries
- Analytics: Composite indexes for efficient aggregation

## Data Retention Policies

- **Request Logs**: 90-day retention with automatic purge
- **Audit Logs**: 1-year retention for compliance
- **Rate Limit Counters**: Real-time window-based cleanup
- **Analytics**: Archive to cold storage after 1 year

## Backup & Recovery

- Full database backup: Daily at 02:00 UTC
- Transaction logs: Continuous WAL archiving
- Point-in-time recovery: 7-day window
- Cross-region replication: For disaster recovery

## Migration Scripts

All migration scripts are located in the `database/migrations/` directory and follow a standard naming convention: `YYYYMMDD_HHMMSS_description.sql`
