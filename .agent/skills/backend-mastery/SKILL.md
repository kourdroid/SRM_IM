---
name: Backend Mastery
description: Production-grade backend development skill implementing Clean Architecture, DDIA principles, and The Silicon Sovereign's engineering standards.
---

# 🏛️ Backend Mastery Skill

> *"You do not hope. You ensure. You do not try. You build."*

## Overview

This skill embodies the apex of backend engineering. Every system built with this skill is designed to survive **100-step projection stress tests**—from MVP to 1 million concurrent users.

---

## 📜 The Sacred Foundations

### Pillar 1: Clean Architecture (Robert C. Martin)

```
┌─────────────────────────────────────────────────┐
│                  FRAMEWORKS                      │
│  ┌───────────────────────────────────────────┐  │
│  │              INTERFACE ADAPTERS            │  │
│  │  ┌───────────────────────────────────┐    │  │
│  │  │        APPLICATION LAYER          │    │  │
│  │  │  ┌───────────────────────────┐    │    │  │
│  │  │  │     DOMAIN ENTITIES       │    │    │  │
│  │  │  │   (Business Logic Core)   │    │    │  │
│  │  │  └───────────────────────────┘    │    │  │
│  │  └───────────────────────────────────┘    │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘

DEPENDENCY RULE: Dependencies point INWARD only.
```

**Key Principles:**
- **Entities** = Pure business logic. NO framework imports. NO database dependencies.
- **Use Cases** = Application-specific business rules. Orchestrate entities.
- **Interface Adapters** = Controllers, Gateways, Presenters. Transform data between layers.
- **Frameworks & Drivers** = HTTP servers, databases, external services. Easily replaceable.

### Pillar 2: DDIA (Martin Kleppmann)

| Principle | Application |
|-----------|-------------|
| **Reliability** | Systems continue to work correctly even when faults occur |
| **Scalability** | Handle increased load gracefully with horizontal/vertical strategies |
| **Maintainability** | Code remains operable, simple, and evolvable over time |

---

## 🎯 The 100-Step Projection Protocol

Before writing ANY code, project the system's future:

| Step | Users | Critical Questions |
|------|-------|-------------------|
| 1 | 1 | Does the code work? |
| 10 | 10K | Does the DB schema hold? Is indexing correct? |
| 50 | 100K | Does the event loop block? Need message queues? |
| 100 | 1M+ | Is this maintainable? Would a junior understand it in 2 years? |

---

## 🏗️ Standard Project Structure

```
project-root/
├── src/
│   ├── domain/                    # 🟢 ENTITIES (Pure Business Logic)
│   │   ├── entities/              # Domain models
│   │   ├── value-objects/         # Immutable value types
│   │   ├── events/                # Domain events
│   │   ├── errors/                # Domain-specific errors
│   │   └── interfaces/            # Repository contracts (ports)
│   │
│   ├── application/               # 🔵 USE CASES (Application Logic)
│   │   ├── use-cases/             # Business operations
│   │   ├── services/              # Application services
│   │   ├── dtos/                  # Data transfer objects
│   │   └── interfaces/            # External service contracts
│   │
│   ├── infrastructure/            # 🟠 ADAPTERS (External World)
│   │   ├── database/              # Repository implementations
│   │   │   ├── repositories/      # Concrete repos
│   │   │   ├── migrations/        # Schema migrations
│   │   │   └── seeds/             # Seed data
│   │   ├── http/                  # HTTP layer
│   │   │   ├── controllers/       # Request handlers
│   │   │   ├── middlewares/       # Auth, logging, etc.
│   │   │   ├── validators/        # Input validation (Zod/Pydantic)
│   │   │   └── routes/            # Route definitions
│   │   ├── messaging/             # Message queues (Redis, RabbitMQ)
│   │   ├── cache/                 # Caching layer
│   │   ├── external/              # Third-party API clients
│   │   └── config/                # Environment configuration
│   │
│   └── shared/                    # 🟣 SHARED KERNEL
│       ├── utils/                 # Pure utility functions
│       ├── types/                 # Shared type definitions
│       └── constants/             # Application constants
│
├── tests/
│   ├── unit/                      # Domain & Use Case tests
│   ├── integration/               # Infrastructure tests
│   └── e2e/                       # End-to-end tests
│
├── docker/                        # Container configurations
├── scripts/                       # Automation scripts
└── docs/                          # Project documentation
```

---

## ⚡ Database Selection Matrix

**NEVER choose a database based on hype. Use this matrix:**

| Use Case | Recommended DB | Data Model | Why |
|----------|---------------|------------|-----|
| **Financial Transactions** | PostgreSQL | Relational | ACID, Write Skew protection |
| **User Profiles** | PostgreSQL | Relational | Complex relationships |
| **Session/Cache** | Redis | Key-Value | Sub-millisecond latency |
| **Logs/Events** | ScyllaDB/Cassandra | Wide-Column | LSM-Tree write optimization |
| **Full-Text Search** | Elasticsearch | Document | Inverted index |
| **Graph Relationships** | Neo4j | Graph | N-degree traversal |
| **Real-time Chat** | ScyllaDB + Redis | Hybrid | High write throughput + Pub/Sub |
| **Analytics** | ClickHouse | Column-Oriented | OLAP aggregations |

### Indexing Strategy

```sql
-- ❌ WRONG: No compound index for common queries
SELECT * FROM orders WHERE user_id = ? AND status = ? ORDER BY created_at DESC;

-- ✅ CORRECT: Compound index matching query pattern
CREATE INDEX idx_orders_user_status_created 
ON orders(user_id, status, created_at DESC);
```

---

## 🛡️ Security Checklist (Zero Trust)

### Authentication

```typescript
// ✅ Production Auth Configuration
const authConfig = {
  tokenType: 'JWT',
  accessTokenExpiry: '15m',      // Short-lived
  refreshTokenExpiry: '7d',
  algorithm: 'RS256',            // Asymmetric
  issuer: 'https://auth.yourdomain.com',
  audience: 'your-api-identifier',
};
```

### Input Validation (Zod Example)

```typescript
import { z } from 'zod';

// Define schema at API boundary
export const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain special char'),
  name: z.string().min(2).max(100).trim(),
});

export type CreateUserDTO = z.infer<typeof CreateUserSchema>;

// In controller - validate FIRST
const result = CreateUserSchema.safeParse(req.body);
if (!result.success) {
  throw new ValidationError(result.error.flatten());
}
```

### Security Headers

```typescript
// Required security headers
app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));
```

---

## 🔧 Error Handling Pattern

```typescript
// Domain Error - Specific, typed errors
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number = 400,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UserNotFoundError extends DomainError {
  constructor(userId: string) {
    super(
      'USER_NOT_FOUND',
      `User with ID ${userId} was not found`,
      404,
      { userId }
    );
  }
}

export class InsufficientBalanceError extends DomainError {
  constructor(required: number, available: number) {
    super(
      'INSUFFICIENT_BALANCE',
      `Insufficient balance: required ${required}, available ${available}`,
      400,
      { required, available }
    );
  }
}

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof DomainError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(process.env.NODE_ENV === 'development' && { context: err.context }),
      },
    });
  }

  // Unexpected error - log full stack, return generic message
  logger.error('Unexpected error', { error: err, requestId: req.id });
  
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
});
```

---

## 📊 Observability Stack

### Structured Logging

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: process.env.SERVICE_NAME,
    environment: process.env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Usage with context
logger.info({ 
  userId: user.id, 
  action: 'order_created', 
  orderId: order.id,
  amount: order.total 
}, 'Order successfully created');
```

### Health Check Endpoint

```typescript
app.get('/health', async (req, res) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkExternalAPI(),
  ]);

  const status = checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'degraded';
  
  res.status(status === 'healthy' ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    checks: {
      database: checks[0].status === 'fulfilled' ? 'up' : 'down',
      redis: checks[1].status === 'fulfilled' ? 'up' : 'down',
      externalApi: checks[2].status === 'fulfilled' ? 'up' : 'down',
    },
  });
});
```

---

## 🚀 Performance Patterns

### Connection Pooling

```typescript
// PostgreSQL connection pool
import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,                    // Maximum pool size
  idleTimeoutMillis: 30000,   // Close idle clients after 30s
  connectionTimeoutMillis: 5000,
});
```

### Caching Strategy

```typescript
// Cache-Aside Pattern
async function getUser(userId: string): Promise<User> {
  const cacheKey = `user:${userId}`;
  
  // 1. Check cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // 2. Cache miss - fetch from DB
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new UserNotFoundError(userId);
  }

  // 3. Populate cache (TTL: 1 hour)
  await redis.setex(cacheKey, 3600, JSON.stringify(user));

  return user;
}

// Invalidate on update
async function updateUser(userId: string, data: UpdateUserDTO): Promise<User> {
  const user = await userRepository.update(userId, data);
  await redis.del(`user:${userId}`);  // Invalidate cache
  return user;
}
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

const limiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rate_limit:',
  }),
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
```

---

## 🧪 Testing Strategy

### Test Pyramid

```
        ╱╲
       ╱  ╲         E2E Tests (10%)
      ╱────╲        - Full user journeys
     ╱      ╲       - Browser automation
    ╱────────╲      Integration Tests (30%)
   ╱          ╲     - Database queries
  ╱────────────╲    - API contracts
 ╱              ╲   Unit Tests (60%)
╱────────────────╲  - Domain entities
                    - Use cases (mocked deps)
```

### Unit Test Example

```typescript
// Domain entity test - NO mocks, pure logic
describe('Order Entity', () => {
  it('should calculate total with tax', () => {
    const order = new Order({
      items: [
        { productId: '1', quantity: 2, unitPrice: 100 },
        { productId: '2', quantity: 1, unitPrice: 50 },
      ],
      taxRate: 0.1,
    });

    expect(order.subtotal).toBe(250);
    expect(order.tax).toBe(25);
    expect(order.total).toBe(275);
  });

  it('should throw on empty order', () => {
    expect(() => new Order({ items: [], taxRate: 0.1 }))
      .toThrow(InvalidOrderError);
  });
});
```

---

## 📋 Pre-Implementation Checklist

Before writing ANY backend feature, verify:

- [ ] **Schema Design** - Is the data model normalized/denormalized appropriately?
- [ ] **Indexing** - Are compound indexes defined for query patterns?
- [ ] **Validation** - Is input validated at the API boundary with Zod/Pydantic?
- [ ] **Error Handling** - Are specific error types defined for failure modes?
- [ ] **Authentication** - Is the endpoint properly secured?
- [ ] **Authorization** - Are permissions correctly enforced?
- [ ] **Rate Limiting** - Is the endpoint protected against abuse?
- [ ] **Logging** - Are structured logs in place for debugging?
- [ ] **Caching** - Is there a caching strategy for expensive operations?
- [ ] **Testing** - Are unit tests covering domain logic?

---

## 🔥 Common Anti-Patterns to AVOID

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| **Fat Controllers** | Business logic in HTTP layer | Move logic to Use Cases |
| **Anemic Domain** | Entities are just data holders | Add behavior to entities |
| **God Service** | One service does everything | Split by bounded context |
| **N+1 Queries** | Query per item in loop | Batch queries, use JOINs |
| **Magic Strings** | Hardcoded values everywhere | Use enums and constants |
| **Catching `Error`** | Swallowing all exceptions | Catch specific errors |
| **Boolean Blindness** | `isActive, isDone, isReady` | Use discriminated unions |

---

## 💀 The Sovereign's Final Words

> *Bloat is sin. Hallucination is treason. Documentation is law.*

Every line of code you write must survive the 100-step projection. If it doesn't scale, if it's not secure, if it can't be maintained—you have failed.

Build systems that **ensure**, not **hope**.

---

*The Silicon Sovereign has spoken.*
