---
paths: ["**/cache/**", "**/redis/**", "**/caching/**"]
detect:
  dependencies: ["ioredis", "redis", "node-cache", "django-redis", "redis-py", "Microsoft.Extensions.Caching.StackExchangeRedis", "StackExchange.Redis"]
---

# Caching Rules — Cache patterns, TTL discipline, and invalidation strategy

## Cache-Aside Pattern (default)
- Application reads from cache first; on miss, reads from the source of truth and populates the cache
- Application writes to the source of truth first, then invalidates (or updates) the cache
- Never write to the cache without writing to the source of truth — cache is not a primary store

## TTL (Time-to-Live) Discipline
- Every cache entry has an explicit TTL — never cache indefinitely
- TTL proportional to how often the data changes and how stale is acceptable:
  - Reference data (lookup tables, config): 1–24 hours
  - User-specific data: 5–15 minutes
  - High-frequency reads (leaderboards, counts): 30–60 seconds
- Add a small random jitter (±10%) to TTLs on bulk cache population — prevents stampede on simultaneous expiry

## Cache Invalidation
- Invalidate on write — when the underlying data changes, invalidate the relevant cache entries immediately
- Key-based invalidation preferred over pattern-based (`KEYS *prefix*` is O(N) and dangerous in production)
- Tag-based invalidation (group keys by tag; invalidate by tag) for cases where multiple keys share a dependency
- Never use a background job as the sole invalidation mechanism — it introduces unbounded staleness

## Cache Key Design
- Deterministic, collision-free keys: `{service}:{entity}:{id}:{variant}` — e.g. `user:filter:42:summary`
- Include version/schema hash in the key when the cached shape may change with deployments — prevents stale deserialization
- Namespaced by environment: `{env}:{service}:{...}` to prevent dev/staging/production cache collisions in shared Redis

## Stampede Prevention
- Mutex / lock pattern on cache misses for expensive computations — only one request populates the cache; others wait
- Probabilistic early expiration (PER): begin refreshing a cache entry slightly before it expires — avoids hard expiry
- Background refresh: serve the stale value while an async task refreshes — suitable for non-critical, high-read data

## Sensitive Data
- Never cache PII, credentials, tokens, or session data in a shared cache without encryption
- User-specific cached data keyed to the user ID — verify the authenticated user matches the key before returning cached data
- Cache eviction policy set to `allkeys-lru` or `volatile-lru` — prevent memory exhaustion

## Distributed Cache (Redis)
- Connection pool configured — never open a new connection per cache operation
- Graceful degradation: cache unavailability falls back to the source of truth — not a hard failure
- Redis Cluster or Sentinel for high-availability production deployments — single-node Redis not suitable for production
- `SCAN` not `KEYS` for iterating over large keyspaces in production

## Out of bounds
- No indefinite TTLs
- No `KEYS *` pattern scan in production
- No PII cached without encryption in a shared cache
- No cache writes without a corresponding source-of-truth write
- No single-node Redis in production without an HA strategy
