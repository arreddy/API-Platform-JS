# API Management Platform

A **production-grade, scalable API Management Platform** that enables API producers to register, manage, and govern APIs using OpenAPI Specification (OAS 3.0/3.1) with enterprise-grade features like rate limiting, authentication, versioning, and analytics.

## 🚀 Features

### Core Capabilities

- ✅ **OpenAPI-First Design**: Register APIs using OAS 3.0/3.1 JSON/YAML format
- ✅ **Automatic Validation**: OAS structure and schema compliance validation
- ✅ **Proxy Management**: Full CRUD operations on API proxies with version control
- ✅ **Smart Routing**: Path-based and header-based request routing to backend services
- ✅ **Security**: Multi-factor authentication (OAuth2, API keys, JWT, mTLS)
- ✅ **Rate Limiting**: Token bucket algorithm with per-consumer and per-endpoint limits
- ✅ **Request/Response Transformation**: Schema validation, header/body transformations
- ✅ **Mock Server**: Serve mock responses based on OAS examples (perfect for testing)
- ✅ **Auto-Publishing**: Swagger UI + ReDoc integration for API documentation
- ✅ **Analytics Dashboard**: Real-time metrics, latency tracking, error analysis
- ✅ **API Key Management**: Generation, rotation, expiration, and scope management
- ✅ **Audit Logging**: Complete compliance trail of all actions
- ✅ **Multi-Tenancy**: Isolated namespaces per organization
- ✅ **Versioning**: Multiple API versions running concurrently with deprecation support

### Advanced Features

- 🔄 **CI/CD Integration**: Deploy proxies directly from GitLab CI/GitHub Actions/Jenkins
- 🤖 **AI-Assisted Validation**: Policy recommendations based on OAS analysis
- 📊 **Advanced Analytics**: Request/response patterns, bottleneck detection
- 🌍 **Multi-Cloud**: Deploy to AWS, GCP, Azure, or on-premises
- 📈 **Auto-Scaling**: Kubernetes HPA for automatic scaling based on load
- 🔐 **Enterprise Security**: TLS 1.3, encryption at rest, secret management
- 🪵 **Centralized Logging**: ELK Stack integration for log aggregation
- 📉 **Distributed Tracing**: OpenTelemetry support for request tracing
- 💳 **API Monetization**: Usage-based billing integration (optional)

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Quick Start

### Local Development (Docker Compose)

```bash
# Clone repository
git clone https://github.com/your-org/api-management-platform.git
cd API-Platform

# Setup environment
cp .env.example .env

# Start all services
docker-compose up -d

# Verify services
docker-compose ps
curl http://localhost:3000/health
curl http://localhost:3001/health

# Access services
Control Plane API:  http://localhost:3000
Data Plane Gateway: http://localhost:3001
PostgreSQL:         localhost:5432
Elasticsearch:      http://localhost:9200
Kibana:             http://localhost:5601
```

### Quick API Test

```bash
# 1. Register an API with OAS
curl -X POST http://localhost:3000/api/v1/apis \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @samples/petstore-oas-3.0.json

# 2. Create a Proxy
curl -X POST http://localhost:3000/api/v1/proxies \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @samples/petstore-proxy-config.json

# 3. Deploy Proxy
curl -X POST http://localhost:3000/api/v1/proxies/{proxyId}/deploy \
  -H "Authorization: Bearer <token>"

# 4. Get API Key
curl -X POST http://localhost:3000/api/v1/credentials \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-key", "apis": ["<apiId>"]}'

# 5. Call proxied API
curl -X GET http://localhost:3001/petstore/v1/pets \
  -H "X-API-Key: sk_live_..."
```

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────┐
│         API Producers & Consumers                   │
└────┬──────────────────────────────────────┬─────────┘
     │ Dashboard (React)                    │ Client Apps
     ▼                                      ▼
┌──────────────────────┐        ┌───────────────────┐
│  Control Plane       │        │  Data Plane       │
│  (API Management)    │        │  (Runtime Gateway)│
│  - Registration      │        │  - Routing        │
│  - Governance        │        │  - Rate Limiting  │
│  - Policies          │        │  - Auth           │
└──────────────────────┘        │  - Logging        │
         │                      └────────┬──────────┘
         │                              │
         └──────────────────┬───────────┘
                            │
         ┌──────────────────┴──────────────────┐
         │      Shared Infrastructure          │
         │  - PostgreSQL (persistent state)   │
         │  - Redis (cache/sessions)          │
         │  - Elasticsearch (analytics)       │
         │  - Object Storage (OAS files)      │
         └─────────────────────────────────────┘
```

### Microservices Components

**Control Plane:**
- API Registry Service
- Proxy CRUD Service
- Policies Service
- OAS Validator Service
- Metadata Service
- Analytics Service
- Audit Service

**Data Plane:**
- Request Router
- Rate Limiter (Token Bucket)
- Authentication Module
- Request/Response Transformer
- Mock Server
- Logger & Analytics Collector

## 📁 Project Structure

```
API-Platform/
├── docs/                          # Documentation
│   ├── ARCHITECTURE.md           # System design & components
│   ├── DATABASE.md               # DB schema & relationships
│   ├── DEPLOYMENT.md             # Deployment guides
│   ├── API_REFERENCE.md          # Complete API docs
│   └── README.md                 # This file
│
├── control-plane/                # Control Plane API (Express.js)
│   ├── src/
│   │   ├── index.ts             # Main app entry
│   │   ├── routes/              # API endpoints
│   │   │   ├── api.routes.ts    # API registration
│   │   │   ├── proxy.routes.ts  # Proxy CRUD
│   │   │   ├── policy.routes.ts # Policy management
│   │   │   ├── credential.routes.ts
│   │   │   ├── analytics.routes.ts
│   │   │   └── auth.routes.ts
│   │   ├── middleware/          # Auth, validation, error
│   │   ├── services/            # Business logic
│   │   └── database/            # DB connection & migrations
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── data-plane/                   # Data Plane Gateway (Fastify)
│   ├── src/
│   │   ├── index.ts             # Gateway entry
│   │   ├── services/            # Router, Auth, Rate Limiter
│   │   │   ├── router.service.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── rate-limiter.service.ts
│   │   │   └── analytics.service.ts
│   │   └── middleware/
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── developer-portal/            # React Frontend
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/              # Page components
│   │   ├── services/           # API client
│   │   └── App.tsx
│   ├── Dockerfile
│   └── package.json
│
├── database/                    # Database schemas & migrations
│   ├── schema.sql              # Full schema definition
│   └── migrations/             # Migration scripts
│
├── kubernetes/                  # K8s manifests
│   ├── deployment.yaml         # Deployments, Services, ConfigMaps
│   ├── ingress.yaml           # Ingress configuration
│   ├── monitoring.yaml         # Prometheus & Grafana
│   └── storage.yaml           # PersistentVolumes
│
├── samples/                     # Sample files
│   ├── petstore-oas-3.0.json   # Sample OAS spec
│   ├── petstore-proxy-config.json
│   └── requests.http           # HTTP requests for testing
│
├── docker-compose.yml          # Local dev setup
├── .env.example               # Environment template
└── README.md
```

## 🔧 Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Control Plane** | Node.js + Express.js + TypeScript | 18.0+ |
| **Data Plane** | Node.js + Fastify | 18.0+ |
| **Frontend** | React + Redux + TailwindCSS | 18.0+ |
| **Database** | PostgreSQL | 14+ |
| **Cache** | Redis | 7.0+ |
| **Analytics** | Elasticsearch + Kibana | 8.5+ |
| **Containerization** | Docker + Docker Compose | 20.10+ |
| **Orchestration** | Kubernetes | 1.24+ |
| **API Validation** | OpenAPI Schema Validator | - |
| **Monitoring** | Prometheus + Grafana | - |
| **Logging** | ELK Stack | - |
| **Message Queue** | RabbitMQ / Kafka | Optional |

## 📦 Installation

### Prerequisites

- Docker & Docker Compose
- Git
- Node.js 18+ (for development)
- PostgreSQL client (optional)

### Local Setup

```bash
# 1. Clone repository
git clone https://github.com/your-org/api-platform.git
cd API-Platform

# 2. Copy environment file
cp .env.example .env

# 3. Build images
docker-compose build

# 4. Start services
docker-compose up -d

# 5. Run migrations
docker-compose exec control-plane npm run db:migrate

# 6. Seed sample data (optional)
docker-compose exec control-plane npm run db:seed

# 7. Verify health
curl http://localhost:3000/health
curl http://localhost:3001/health
```

### Development Setup

```bash
# Install dependencies
cd control-plane && npm install
cd ../data-plane && npm install
cd ../developer-portal && npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

## ⚙️ Configuration

### Environment Variables

Create `.env` file in root directory:

```env
# Node Environment
NODE_ENV=development
LOG_LEVEL=info

# Database
DB_USER=postgres
DB_PASSWORD=secure_password
DB_HOST=postgres
DB_PORT=5432
DB_NAME=api_management

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Authentication
JWT_SECRET=your-very-long-secret-key-min-32-characters
JWT_EXPIRY=3600

# Storage
STORAGE_TYPE=s3
S3_BUCKET=api-specs
S3_REGION=us-east-1

# Email Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=app_password

# Analytics
ELASTICSEARCH_HOST=elasticsearch:9200

# Optional: CI/CD
GITHUB_TOKEN=xxx
GITLAB_TOKEN=xxx
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed configuration.

## 📚 API Documentation

### Getting Started with APIs

1. **Register API**
   ```bash
   POST /api/v1/apis
   ```
   Upload OpenAPI 3.0/3.1 specification

2. **Create Proxy**
   ```bash
   POST /api/v1/proxies
   ```
   Create proxy configuration with routing rules

3. **Deploy Proxy**
   ```bash
   POST /api/v1/proxies/{id}/deploy
   ```
   Deploy to data plane gateway

4. **Generate API Key**
   ```bash
   POST /api/v1/credentials
   ```
   Create credentials for consumers

5. **Call API**
   ```bash
   GET /petstore/v1/pets
   X-API-Key: sk_live_...
   ```
   Requests routed through gateway

See [docs/API_REFERENCE.md](docs/API_REFERENCE.md) for complete API documentation.

## 🚀 Deployment

### Docker Compose (Local/Staging)

```bash
docker-compose -f docker-compose.yml up -d
```

### Kubernetes (Production)

```bash
# Apply configurations
kubectl apply -f kubernetes/deployment.yaml

# Verify deployment
kubectl get pods -n api-management
kubectl get svc -n api-management

# Check logs
kubectl logs -f deployment/control-plane -n api-management
```

### AWS ECS (Alternative)

See [docs/DEPLOYMENT.md#aws-ecs-deployment](docs/DEPLOYMENT.md) for ECS setup.

### Helm Charts (Optional)

```bash
# Add Helm repository
helm repo add api-platform https://charts.example.com
helm repo update

# Install
helm install api-platform api-platform/api-management \
  --namespace api-management \
  --values values.yaml
```

## 📊 Monitoring & Observability

### Health Checks

```bash
# Control Plane
curl http://localhost:3000/health

# Data Plane
curl http://localhost:3001/health
```

### Metrics

Access Grafana dashboards at http://localhost:3000 (when deployed with monitoring)

**Available Dashboards:**
- API Request Rate & Latency
- Error Rates & Status Codes
- Resource Utilization (CPU, Memory)
- Database Performance
- Authentication & Rate Limiting

### Logs

**ELK Stack:**
- Elasticsearch: http://localhost:9200
- Kibana: http://localhost:5601

**Query Examples:**
```json
{
  "query": {
    "match": {
      "level": "error"
    }
  }
}
```

### Alerts

Configure alerts in Grafana:
- Response time > 1 second
- Error rate > 1%
- Pod restart count > 2
- Disk usage > 80%

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Load Testing

```bash
# Using k6
k6 run load-tests/api-gateway.js

# Using Apache JMeter
jmeter -n -t load-tests/api-gateway.jmx
```

## 📝 Sample Workflows

### Workflow 1: Register and Deploy Public API

```bash
# 1. Register Pet Store API
curl -X POST http://localhost:3000/api/v1/apis \
  -H "Authorization: Bearer $TOKEN" \
  -d @samples/petstore-oas-3.0.json

# 2. Create proxy
curl -X POST http://localhost:3000/api/v1/proxies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "apiId": "api-uuid",
    "basePath": "/api/v1/petstore",
    "targetEndpoint": "https://petstore.swagger.io/v2"
  }'

# 3. Deploy
curl -X POST http://localhost:3000/api/v1/proxies/{proxyId}/deploy \
  -H "Authorization: Bearer $TOKEN"

# 4. Test
curl http://localhost:3001/api/v1/petstore/pets
```

### Workflow 2: Set Up Rate Limiting

```bash
# Create rate limit policy
curl -X POST http://localhost:3000/api/v1/policies \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "proxyId": "proxy-uuid",
    "type": "rate-limit",
    "config": {
      "requests_per_minute": 100,
      "burst_size": 10
    }
  }'
```

### Workflow 3: Version an API

```bash
# Create new API version
curl -X POST http://localhost:3000/api/v1/apis/{apiId}/versions \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "versionNumber": "2.0.0",
    "oasSpec": {...},
    "breakingChanges": true
  }'
```

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Fork and clone
git clone https://github.com/your-fork/api-platform.git
cd api-platform

# Create branch
git checkout -b feature/amazing-feature

# Make changes and test
npm test

# Commit with conventional commits
git commit -m "feat: add amazing feature"

# Push and create PR
git push origin feature/amazing-feature
```

## 📄 License

This project is licensed under the Apache License 2.0 - see [LICENSE](LICENSE) file.

## 🆘 Support

- **Documentation**: https://docs.api-platform.example.com
- **Issues**: https://github.com/api-platform/issues
- **Discussions**: https://github.com/api-platform/discussions
- **Email**: support@example.com
- **Community Discord**: https://discord.gg/api-platform

## 🎓 Learn More

- [Architecture Deep Dive](docs/ARCHITECTURE.md)
- [Database Schema](docs/DATABASE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [API Reference](docs/API_REFERENCE.md)
- [OpenAPI Specification](https://spec.openapis.org/oas/v3.0.3)

## 🗺️ Roadmap

### v1.1.0 (Q2 2024)
- [ ] GraphQL API support
- [ ] Advanced webhook system
- [ ] API monetization integration
- [ ] Enhanced AI/ML policy suggestions

### v1.2.0 (Q3 2024)
- [ ] Service mesh integration (Istio)
- [ ] Blue-green deployment support
- [ ] Advanced analytics with ML anomaly detection
- [ ] Multi-cloud provider support

### v2.0.0 (Q4 2024)
- [ ] Native GraphQL gateway
- [ ] Enhanced performance (10x throughput)
- [ ] Advanced security (FIPS compliance)
- [ ] Enterprise support & SLA

## 🎉 Acknowledgments

Built with ❤️ using:
- [Express.js](https://expressjs.com) & [Fastify](https://www.fastify.io)
- [PostgreSQL](https://www.postgresql.org) & [Redis](https://redis.io)
- [Kubernetes](https://kubernetes.io) & [Docker](https://www.docker.com)
- [OpenAPI](https://www.openapis.org) specification

---

**Questions?** Feel free to open an issue or reach out to our community!

**Star ⭐ us on GitHub if you find this project useful!**
