# Job Search Caching Decisions

Status: Architecture implemented in the application; production validation remains deployment-gated

## Decision record

### D1 — Cache the server data function, not the client component

**Decision:** Put the cache boundary around the validated server-side job
search function and keep `JobBrowser` responsible for local bookmarks and UI
state.

**Why:** The route already owns database access, while bookmarks are
browser-local and must not be shared. Caching the client component would not
prevent Turso calls and would risk coupling user state to shared output.

**Rejected:** Caching the entire browser response as a personalized object.

### D2 — Use canonical keys plus a version

**Decision:** Normalize all result-affecting inputs and include a schema/key
version and server-owned page size.

**Why:** URL parameter ordering and cosmetic input differences should not
fragment the cache. A version gives a safe escape hatch when SQL ordering or
the response contract changes.

**Rejected:** Raw URL strings as keys; they create avoidable misses and make
semantic changes difficult to invalidate safely.

### D3 — Use short-lived best-effort process caching

**Decision:** Use the built-in Next.js cache with a 60-second `revalidate`
target and a longer `expire` bound. Do not promise stale-while-revalidate or
stale-if-error behavior from the default in-memory handler.

**Why:** The product prioritizes sub-five-second discovery, and job listings
are acceptable when slightly stale. The default cache can reuse data in a warm
process, but it is not durable or shared across serverless instances. A miss,
eviction, expiry, or restart returns to Turso.

**Rejected:** Treating the default cache as a global shared cache or promising
that a cache hit will occur in every hosted request.

### D4 — Tag data without a nonfunctional webhook

**Decision:** Add one `jobs` tag for future invalidation, but defer the crawler
webhook while only process-local storage is available.

**Why:** A crawler update can affect many providers, filters, and pages. One
tag is correct and operationally simple, but an invalidation request reaching
one process cannot clear other processes' in-memory entries.

**Rejected:** Enumerating every query key or using path invalidation for each
filter combination, or exposing an endpoint that implies global invalidation.

### D5 — Use the free built-in cache profile

**Decision:** Use only the default Next.js in-memory LRU cache behind
`use cache`. Keep HTTP responses `no-store`; do not add Redis, Upstash, remote
`use cache: remote`, or assume a platform CDN cache.

**Why:** The repository already enables Next.js 16 Cache Components, but a
free deployment should not acquire a new service just to make cache behavior
durable. Next.js documents that its default runtime cache is in-memory and
typically not shared across serverless requests/instances. This is a
best-effort optimization, not a promise of durable or cross-instance hits.

**Rejected:** Treating process memory as durable production cache or promising
cross-instance reuse without measurement.

### D6 — Preserve the current query contract before optimizing SQL

**Decision:** Keep the existing response shape, exact totals, filters, and
offset pagination for the first cache release. Capture query plans and
baseline count/page timings; defer FTS5, indexes, cursor pagination, or count
redesign until measurements prove they are needed.

**Why:** The current route uses leading-wildcard search and sequential count/
page work, so these may be the cold-path bottleneck. Speculative schema changes
would expand scope and risk changing search semantics.

**Rejected:** Claiming that one Turso batch or a cache alone guarantees the
cold-path latency target.

### D7 — Defer crawler invalidation until shared storage exists

**Decision:** Defer the crawler invalidation endpoint. Add `cacheTag("jobs")`
to cached data, but do not claim a request to one process invalidates entries
held by other processes.

**Why:** The selected free cache is process-local. A signed webhook would add
security and replay-protection machinery without providing global
invalidation. The `revalidate` lifetime and process eviction/restart remain
the only freshness mechanisms until a shared invalidation provider is selected.

**Rejected:** Shipping a webhook that appears globally authoritative but only
invalidates the instance that receives it.

## Approval checklist

- [ ] Actual hosting vendor and warm-instance cache reuse behavior recorded.
- [ ] Load-test workload, fixture size, and latency percentile targets recorded.
- [ ] Query-plan baseline and test-runner choice recorded.
