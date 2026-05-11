# API Management Platform - System Architecture

## Overview
A scalable, microservices-based API Management Platform that enables API producers to register, manage, and govern APIs using OpenAPI Specification (OAS 3.0/3.1).

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                         External Users / Developers                     │
└────────────────┬───────────────────────────────────────┬────────────────┘
                 │                                       │
         ┌───────▼────────┐                    ┌─────────▼──────────┐
         │ Developer Portal│                    │  API Consumers     │
         │   (React SPA)   │                    │  (Client Apps)     │
         └───────┬────────┘                    └─────────┬──────────┘
                 │                                       │
      ┌──────────▼──────────┐                ┌──────────▼──────────┐
      │   Load Balancer     │                │   Load Balancer     │
      │    (API Gateway)    │                │    (Data Plane)     │
      └──────────┬──────────┘                └──────────┬──────────┘
                 │                                       │
      ┌──────────▼────────────────────────────────────────┼──────────┐
      │                    CONTROL PLANE                  │          │
      │                 (API Management)                  │          │
      │                                                   │          │
      │  ┌──────────────┐  ┌────────────┐  ┌──────────┐  │          │
      │  │ API Registry │  │ Proxy CRUD │  │ Policies │  │          │
      │  │   Service    │  │  Service   │  │ Service  │  │          │
      │  └──────────────┘  └────────────┘  └──────────┘  │          │
      │                                                   │          │
      │  ┌──────────────┐  ┌────────────┐  ┌──────────┐  │          │
      │  │ OAS Validator│  │ Schema Gen │  │ Metadata │  │          │
      │  │  Service     │  │  Service   │  │ Service  │  │          │
      │  └──────────────┘  └────────────┘  └──────────┘  │          │
      └─────────┬──────────────────────────────────────────┘          │
                │                                                     │
      DATA PLANE (Gateway Layer)                                     │
      ┌─────────▼──────────────────────────────────────────────────┐ │
      │                                                             │ │
      │  ┌──────────────────┐  ┌────────────────┐                 │ │
      │  │ Request Router   │  │ Rate Limiter   │                 │ │
      │  │                  │  │ (Token Bucket) │                 │ │
      │  └──────────────────┘  └────────────────┘                 │ │
      │                                                             │ │
      │  ┌──────────────────┐  ┌────────────────┐                 │ │
      │  │ Authentication   │  │ Request Logger │                 │ │
      │  │ (OAuth2, API Key)│  │ & Analytics    │                 │ │
      │  └──────────────────┘  └────────────────┘                 │ │
      │                                                             │ │
      │  ┌──────────────────┐  ┌────────────────┐                 │ │
      │  │ Request/Response │  │ Mock Server    │                 │ │
      │  │ Transformation   │  │ (OAS-based)    │                 │ │
      │  └──────────────────┘  └────────────────┘                 │ │
      │                                                             │ │
      │  ┌──────────────────────────────────────────────────────┐ │ │
      │  │           Backend Target Services                   │ │ │
      │  │  (Customer's APIs, Microservices, Third-party APIs) │ │ │
      │  └──────────────────────────────────────────────────────┘ │ │
      └────────────────────────────────────────────────────────────┘ │
                                                                     │
      ┌──────────────────────────────────────────────────────────────┘
      │
      │  Shared Services
      │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐
      │  │   PostgreSQL    │  │   Redis Cache   │  │ Message Queue│
      │  │     Database    │  │   (Sessions)    │  │  (Events)    │
      │  └─────────────────┘  └─────────────────┘  └──────────────┘
      │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐
      │  │ Elasticsearch   │  │  Object Storage │  │   Logging    │
      │  │  (Analytics)    │  │   (OAS Files)   │  │  (ELK Stack) │
      │  └─────────────────┘  └─────────────────┘  └──────────────┘
      │
      └──────────────────────────────────────────────────────────────
```

## Core Components

### 1. Control Plane (API Management)
**Responsibility:** API registration, governance, and proxy configuration management.

**Services:**
- **API Registry Service**: Handles OAS upload, validation, and storage
- **Proxy CRUD Service**: Manages proxy lifecycle (create, read, update, delete)
- **Policies Service**: Manages rate limiting, authentication, and transformation policies
- **OAS Validator Service**: Validates OAS structure and schema compliance
- **Schema Generator Service**: Auto-generates proxy configs and validation schemas
- **Metadata Service**: Extracts and manages API metadata
- **Analytics Service**: Tracks API usage, performance metrics, and health

### 2. Data Plane (Gateway/Proxy)
**Responsibility:** Runtime request routing, transformation, and enforcement of policies.

**Components:**
- **Request Router**: Routes incoming requests to target backends based on proxy definitions
- **Rate Limiter**: Enforces rate limiting policies using token bucket algorithm
- **Authentication Module**: OAuth2, API key validation, JWT verification
- **Request/Response Transformer**: Applies transformations based on proxy policies
- **Logger & Analytics**: Logs all requests and tracks metrics
- **Mock Server**: Serves mock responses based on OAS schemas (development mode)

### 3. Developer Portal
**Responsibility:** Self-service UI for API producers and consumers.

**Features:**
- API registration and management dashboard
- Proxy lifecycle management
- Interactive API documentation (Swagger UI / Redoc)
- API testing console (Postman-like)
- API key generation and management
- Usage analytics and monitoring
- Developer account management

## Database Schema

### Primary Tables
1. **apis**: Registered APIs with OAS metadata
2. **api_versions**: Version history of APIs
3. **proxies**: Proxy configurations for APIs
4. **routes**: Routing rules within proxies
5. **policies**: Rate limiting, auth, transformation policies
6. **api_keys**: API key credentials and permissions
7. **audit_logs**: Compliance and governance tracking
8. **analytics**: Request/response metrics and performance data

See [DATABASE.md](./DATABASE.md) for detailed schema.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Control Plane** | Node.js 18+, Express.js, TypeScript |
| **Data Plane** | Node.js 18+, Fastify (high-performance) |
| **Frontend** | React 18+, Redux, TailwindCSS, Swagger UI |
| **Database** | PostgreSQL 14+ (primary), Redis (cache/sessions) |
| **Message Queue** | RabbitMQ / Apache Kafka (async events) |
| **Caching** | Redis |
| **Search/Analytics** | Elasticsearch |
| **Object Storage** | MinIO / AWS S3 (OAS files) |
| **Containerization** | Docker, Docker Compose |
| **Orchestration** | Kubernetes 1.24+ |
| **Monitoring** | Prometheus, Grafana |
| **Logging** | ELK Stack (Elasticsearch, Logstash, Kibana) |
| **API Documentation** | OpenAPI 3.0/3.1, Swagger UI, ReDoc |

## Deployment Architecture

### Local Development
- Docker Compose for multi-container setup
- All services running locally
- PostgreSQL with sample data
- Redis and Elasticsearch included

### Kubernetes Production
- Separate namespaces: api-management, data-plane, monitoring
- StatefulSets for databases
- Deployments for microservices
- Services and Ingress for networking
- ConfigMaps and Secrets for configuration
- PersistentVolumes for data persistence
- HorizontalPodAutoscaler for auto-scaling

See [kubernetes/](../kubernetes) directory for K8s manifests.

## API Design

### Control Plane Endpoints

**API Registration:**
```
POST   /api/v1/apis                    - Register new API (upload OAS)
GET    /api/v1/apis                    - List all registered APIs
GET    /api/v1/apis/:apiId             - Get API details
PUT    /api/v1/apis/:apiId             - Update API metadata
DELETE /api/v1/apis/:apiId             - Delete API
POST   /api/v1/apis/:apiId/versions    - Create new API version
```

**Proxy Management:**
```
POST   /api/v1/proxies                 - Create new proxy
GET    /api/v1/proxies                 - List proxies
GET    /api/v1/proxies/:proxyId        - Get proxy details
PUT    /api/v1/proxies/:proxyId        - Update proxy
DELETE /api/v1/proxies/:proxyId        - Delete proxy
POST   /api/v1/proxies/:proxyId/deploy - Deploy proxy to gateway
```

**Policy Management:**
```
POST   /api/v1/policies                - Create policy
GET    /api/v1/policies                - List policies
PUT    /api/v1/policies/:policyId      - Update policy
DELETE /api/v1/policies/:policyId      - Delete policy
```

**API Key Management:**
```
POST   /api/v1/credentials             - Generate API key
GET    /api/v1/credentials             - List credentials
PATCH  /api/v1/credentials/:keyId      - Rotate/update key
DELETE /api/v1/credentials/:keyId      - Revoke key
```

**Analytics & Monitoring:**
```
GET    /api/v1/analytics/usage         - Get usage metrics
GET    /api/v1/analytics/performance   - Get performance metrics
GET    /api/v1/analytics/errors        - Get error statistics
GET    /api/v1/audit-logs              - Get audit trail
```

### Data Plane Endpoints

**Dynamic proxy routes** based on registered APIs:
```
{method} /:apiName/:apiVersion{*path}  - Proxy requests to backend
```

Example:
```
GET    /petstore/v1/pets               - Routes to backend based on proxy config
POST   /petstore/v1/pets               - Create pet
PUT    /petstore/v1/pets/{petId}       - Update pet
DELETE /petstore/v1/pets/{petId}       - Delete pet
```

## Key Features

### 1. OAS-Driven API Management
- **Automatic Validation**: OAS structure and schema validation
- **Metadata Extraction**: Title, version, endpoints, methods, security schemes
- **Proxy Generation**: Auto-generate proxy config from OAS
- **Request/Response Validation**: Automatic schema-based validation
- **Mock Server**: Serve mock responses based on OAS examples

### 2. Security & Governance
- **Multi-factor Authentication**: OAuth2, API keys, JWT
- **Rate Limiting**: Per-consumer, per-endpoint rate limits
- **API Key Management**: Key rotation, expiration, scoping
- **Audit Logging**: Full compliance trail
- **Policy Enforcement**: Custom policies per API/consumer

### 3. Developer Experience
- **Interactive Portal**: Self-service API management
- **API Testing**: Built-in Postman-like console
- **Documentation Auto-publishing**: Swagger UI, ReDoc
- **API Analytics**: Usage, latency, error tracking
- **Webhook Support**: Real-time event notifications

### 4. Advanced Capabilities
- **Multi-tenancy**: Isolated namespaces per organization
- **CI/CD Integration**: Automated deployment pipelines
- **API Versioning**: Multiple versions running concurrently
- **Request/Response Transformation**: Custom middlewares
- **AI-assisted Validation**: (Optional) Policy recommendations

## Scalability & Performance

### Horizontal Scaling
- Stateless service design
- Load balancing across instances
- Cache-first approach (Redis)
- Database read replicas

### Performance Optimization
- Request caching with TTL
- Connection pooling
- Batch processing for analytics
- CDN for static content
- Compression and minification

### High Availability
- Multi-region deployment
- Database replication and failover
- Health checks and auto-recovery
- Circuit breakers for backend calls
- Message queue for async operations

## Security Considerations

1. **Data Protection**: Encryption at rest and in transit (TLS 1.3)
2. **API Key Security**: Hashed storage, rotation policies
3. **RBAC**: Role-based access control for management plane
4. **Network Isolation**: Private networking, VPC integration
5. **Compliance**: GDPR, SOC2 audit logging
6. **Secret Management**: HashiCorp Vault integration
7. **DDoS Protection**: Rate limiting, WAF integration

## Monitoring & Observability

- **Metrics**: Prometheus for collection, Grafana for visualization
- **Logging**: ELK Stack for centralized logging
- **Tracing**: Distributed tracing (Jaeger/OpenTelemetry)
- **Alerting**: Real-time alerts for anomalies
- **Health Checks**: Liveness and readiness probes

## Deployment Workflow

1. **API Producer**: Uploads OAS specification
2. **Control Plane**: Validates OAS and extracts metadata
3. **Proxy Generation**: Auto-generates proxy configuration
4. **Deployment**: Deploy proxy to data plane gateway
5. **API Consumer**: Receives API key and can call API
6. **Data Plane**: Routes requests, enforces policies
7. **Analytics**: Collects metrics and logs
8. **Dashboard**: Producer/consumer view analytics

## Integration Points

- **CI/CD**: GitLab CI, GitHub Actions, Jenkins
- **Monitoring**: Datadog, New Relic, CloudWatch
- **Auth Providers**: Auth0, Okta, Azure AD
- **Webhooks**: Custom integrations
- **Kafka/RabbitMQ**: Event streaming
- **Cloud Platforms**: AWS, GCP, Azure

## Future Enhancements

1. **GraphQL Support**: GraphQL schema registration and validation
2. **API Monetization**: Usage-based billing integration
3. **Advanced Analytics**: Machine learning for anomaly detection
4. **Multi-cloud**: Multi-cloud deployment support
5. **Service Mesh Integration**: Istio/Linkerd integration
6. **API Versioning Strategy**: Blue-green, canary deployments
7. **OpenTelemetry**: Full observability instrumentation
