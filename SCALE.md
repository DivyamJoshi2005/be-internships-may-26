# Scale Plan

## Data model/indexes

Table: signals

Indexes:
- PRIMARY KEY(id)
- UNIQUE(idempotency_key)
- INDEX(user_id, created_at)

The unique idempotency key prevents duplicate inserts even under concurrent requests.

## Idempotency across instances

Current implementation relies on a database unique constraint on idempotency_key.

For multi-instance deployments:
- Store idempotency keys in Redis.
- Use SETNX to atomically reserve a key.
- Store the response against the key after successful processing.
- Keep the database unique constraint as the final safety layer.

## Rate limiting across instances

Current implementation uses an in-memory Map.

For multi-instance deployments:
- Move counters to Redis.
- Use INCR with EXPIRE.
- Use one key per user per time window.
- Reject requests once the configured limit is exceeded.

## Observability

Metrics:
- Request count
- Error rate
- 429 responses
- Database latency
- Database failures
- p95 and p99 latency

Logs:
- Structured JSON logs
- Request identifiers
- Error context

Alerts:
- High error rate
- High database failure rate
- Elevated latency
- Increased rate limiting activity

## Failure modes

Database unavailable:
- Retry with exponential backoff and jitter.
- Return 503 after retry exhaustion.

Duplicate requests:
- Protected through unique idempotency key constraints.

Partial outages:
- Use health checks.
- Use load balancer based routing.
- Remove unhealthy instances from service.

## 10k RPS design sketch

Load Balancer
    |
Fastify Instances
    |
Redis Cluster
    |
Primary Database
    |
Read Replicas

Scaling strategy:
- Horizontal API scaling.
- Connection pooling.
- Redis-backed rate limiting.
- Redis-backed idempotency cache.
- Read replicas for query traffic.
- Autoscaling based on CPU and latency.

Cost optimization:
- Stateless API servers.
- Shared Redis cluster.
- Small primary database with read replicas.
- Autoscaling during traffic spikes.