# Job Search Optimisations

> Technical spec for optimising the job search pipeline — database queries, caching,
> pagination, and payload delivery. Each section is self-contained so an implementing
> agent can pick up any optimisation independently.

---

## Table of Contents

1. [Current Architecture](#1-current-architecture)
2. [Problem Statement](#2-problem-statement)
3. [Optimisation 1 — Separate the Count Query](#3-optimisation-1--separate-the-count-query)
4. [Optimisation 2 — Covering Index for Page Order](#4-optimisation-2--covering-index-for-page-order)
5. [Optimisation 3 — Deferred-Join (Two-Step ID-First Pagination)](#5-optimisation-3--deferred-join-two-step-id-first-pagination)
6. [Optimisation 4 — Cursor / Keyset Pagination](#6-optimisation-4--cursor--keyset-pagination)
7. [Optimisation 5 — Reverse Scan for Tail Pages](#7-optimisation-5--reverse-scan-for-tail-pages)
8. [Optimisation 6 — Exclude Description from Page Queries](#8-optimisation-6--exclude-description-from-page-queries)
9. [Optimisation 7 — Client Prefetch Count Deduplication](#9-optimisation-7--client-prefetch-count-deduplication)
10. [Optimisation 8 — FTS5 for Filtered Searches](#10-optimisation-8--fts5-for-filtered-searches)
11. [Migration & Rollout Strategy](#11-migration--rollout-strategy)
12. [Appendix — File Reference](#12-appendix--file-reference)

---

## 1. Current Architecture

### Request Flow

```
Browser ──GET /api/jobs?page=N&q=intern──▶ Route Handler
                                            │
                                            ▼
                                     parseJobSearchParams
                                            │
                                            ▼
                                       searchJobs()
                                      ┌─────┴──────┐
                                      │ cache hit?  │
                                      │  yes → return│
                                      │  no ↓       │
                                      └─────┬──────┘
                                            ▼
                                    executeJobSearch()
                                            │
                              database.batch([
                                COUNT(*) query,
                                SELECT + ORDER BY + LIMIT/OFFSET
                              ])
                                            │
                                            ▼
                                  JSON or MessagePack response
```

### Key Files

| File | Role |
|------|------|
| [`app/api/jobs/route.ts`](file:///d:/projects/crawler/frontend/app/api/jobs/route.ts) | API route handler — validates origin, parses params, calls `searchJobs`, encodes response |
| [`lib/job-search.ts`](file:///d:/projects/crawler/frontend/lib/job-search.ts) | Core search — `buildWhere`, `executeJobSearch`, `getCachedJobSearch`, `searchJobs` |
| [`lib/job-search-params.ts`](file:///d:/projects/crawler/frontend/lib/job-search-params.ts) | Parameter parsing / normalisation |
| [`lib/api-payload.ts`](file:///d:/projects/crawler/frontend/lib/api-payload.ts) | MessagePack encode/decode, content negotiation |
| [`lib/job-pagination.ts`](file:///d:/projects/crawler/frontend/lib/job-pagination.ts) | `getPaginationItems`, `getPagesToPrefetch` — controls which pages the client prefetches |
| [`lib/jobs.ts`](file:///d:/projects/crawler/frontend/lib/jobs.ts) | `Job` / `JobSearchResponse` types and validators |
| [`lib/turso.ts`](file:///d:/projects/crawler/frontend/lib/turso.ts) | Turso/libSQL connection singleton |
| [`components/job-browser.tsx`](file:///d:/projects/crawler/frontend/components/job-browser.tsx) | Client component — search UI, `loadPage`, in-memory page cache (20 entries), prefetch logic |

### Current SQL (from `executeJobSearch`)

```sql
-- Batched together in a single database.batch() call:

-- Query 1: Count
SELECT COUNT(*) AS total
FROM indexed_jobs j
WHERE ${where}

-- Query 2: Page
SELECT
  j.provider, j.company_slug, j.job_id, j.title, j.company_name,
  j.location_name, j.details_url, j.apply_url,
  j.first_published, j.employment_type, j.workplace_type, j.description,
  0 AS is_bookmarked, 1 AS is_available
FROM indexed_jobs j
WHERE ${where}
ORDER BY j.first_published DESC, j.title COLLATE NOCASE
LIMIT ? OFFSET ?
```

### Current Caching

- **Server:** Next.js `"use cache"` with `revalidate: 60, expire: 600`. Cache key includes
  **all params including `page`**, so page 1 and page 2 of the same search are separate entries.
  `JOB_SEARCH_CACHE_MODE=off` bypasses the cache.
- **Client:** In-memory `Map<queryString, JobSearchResponse>`, LRU-evicted at 20 entries.
  Prefetches visible pagination items ± 1 and current page + [−1, +1, +2, +3].

### Known Index

- `indexed_jobs_date_idx` on `(first_published)` — single column, does not match the
  `ORDER BY first_published DESC, title COLLATE NOCASE` clause.

### Table Shape (inferred from queries)

```
indexed_jobs (
  provider        TEXT,
  company_slug    TEXT,
  job_id          TEXT,
  title           TEXT,
  company_name    TEXT,
  location_name   TEXT,
  details_url     TEXT,
  apply_url       TEXT,
  first_published TEXT,
  employment_type TEXT,
  workplace_type  TEXT,
  description     TEXT,
  PRIMARY KEY (provider, company_slug, job_id)
)
```

---

## 2. Problem Statement

| Symptom | Root Cause |
|---------|-----------|
| Every prefetched page re-runs `COUNT(*)` | Count is batched with the page query; the server cache key includes `page`, so each page is a separate cache entry |
| Deep pages (e.g. page 8655 → OFFSET 173,080) are slow | SQLite must walk the B-tree in sort order, visiting and discarding 173k rows before returning 20 |
| No index matches `ORDER BY` | Only `indexed_jobs_date_idx(first_published)` exists — no composite covering `(first_published DESC, title COLLATE NOCASE)` |
| `LOWER(col) LIKE '%term%'` defeats indexes | Substring search with function wrapping prevents index usage |
| `description` selected but unused on list pages | Wide `TEXT` column fetched for every row on every page, inflating I/O |

---

## 3. Optimisation 1 — Separate the Count Query

### Why

The current `executeJobSearch` batches `COUNT(*)` with the page query in a single
`database.batch()` call. The Next.js `"use cache"` key includes `page`, so **every
prefetched page of the same search runs its own `COUNT(*)`**. For a search that
prefetches ~10 nearby pages, that is 10 identical count scans.

### Strategy

Separate count into its own cached function keyed by **filter params only** (excluding `page`).

### Implementation

```typescript
// lib/job-search-count.ts
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getTursoConnection } from "./turso";
import type { JobSearchParams } from "./job-search-params";

// Build a cache key that excludes page
type CountCacheKey = Omit<JobSearchParams, "page" | "pageSize">;

function getCountCacheKey(params: JobSearchParams): CountCacheKey {
  const { page, pageSize, ...rest } = params;
  return rest;
}

async function executeCount(
  where: string,
  args: Array<string | number>,
): Promise<number> {
  const database = getTursoConnection();
  const result = await database.execute({
    sql: `SELECT COUNT(*) AS total FROM indexed_jobs j WHERE ${where}`,
    args,
  });
  return Number(result.rows?.[0]?.total ?? 0);
}

export async function getCachedCount(
  params: JobSearchParams,
  where: string,
  args: Array<string | number>,
): Promise<number> {
  "use cache";
  // Cache key automatically includes all arguments — params (minus page),
  // where clause, and args. Revalidate every 60s, expire after 600s.
  cacheLife({ revalidate: 60, expire: 600 });
  cacheTag("jobs-count");

  // params is captured for cache key identity but we only use where/args
  void getCountCacheKey(params);

  return executeCount(where, args);
}
```

Then update `executeJobSearch`:

```typescript
// lib/job-search.ts — updated executeJobSearch
export async function executeJobSearch(
  params: JobSearchParams,
): Promise<JobSearchResponse> {
  const database = getTursoConnection();
  const { where, args } = buildWhere(params);
  const requestedOffset = (params.page - 1) * params.pageSize;

  // Count and page queries now run concurrently but are cached separately
  const [total, jobsResult] = await Promise.all([
    getCachedCount(params, where, args),
    database.execute({
      sql: `SELECT
        j.provider, j.company_slug, j.job_id, j.title, j.company_name,
        j.location_name, j.details_url, j.apply_url,
        j.first_published, j.employment_type, j.workplace_type, j.description,
        0 AS is_bookmarked, 1 AS is_available
      FROM indexed_jobs j
      WHERE ${where}
      ORDER BY j.first_published DESC, j.title COLLATE NOCASE
      LIMIT ? OFFSET ?`,
      args: [...args, params.pageSize, requestedOffset],
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  const page = Math.min(params.page, totalPages);
  const offset = (page - 1) * params.pageSize;

  let jobs = toPlainJobs(jobsResult.rows as Job[]);
  if (offset !== requestedOffset) {
    // Page was clamped — re-query with correct offset
    const pagedResult = await database.execute({
      sql: `SELECT /* ... same columns ... */
      FROM indexed_jobs j WHERE ${where}
      ORDER BY j.first_published DESC, j.title COLLATE NOCASE
      LIMIT ? OFFSET ?`,
      args: [...args, params.pageSize, offset],
    });
    jobs = toPlainJobs(pagedResult.rows as Job[]);
  }

  return { jobs, total, page, pageSize: params.pageSize, totalPages };
}
```

### Tradeoffs

| Pro | Con |
|-----|-----|
| Prefetching 10 pages runs `COUNT(*)` once instead of 10 times | Count can be stale for up to 60 seconds |
| Reduces Turso round trips for prefetch burst | Adds a new cache entry (trivial memory) |
| No schema changes required | Breaks the single `batch()` call into `Promise.all` — verify Turso doesn't penalise concurrent requests vs batch |

> [!IMPORTANT]
> If Turso charges per request or has concurrency limits, benchmark `Promise.all` vs keeping the
> batch for the first page and using a cached count for prefetches only.

---

## 4. Optimisation 2 — Covering Index for Page Order

### Why

The current `ORDER BY j.first_published DESC, j.title COLLATE NOCASE` has no matching index.
SQLite must materialise and sort the entire filtered result set before it can apply `LIMIT/OFFSET`.

### Index Definition

```sql
-- Run on the crawler's database (schema lives outside the frontend repo)
CREATE INDEX IF NOT EXISTS idx_jobs_page_order
ON indexed_jobs (first_published DESC, title COLLATE NOCASE, provider, company_slug, job_id);
```

The trailing `(provider, company_slug, job_id)` columns make the index **covering** for the
deferred-join pattern (Optimisation 3) — the database can scan the narrow index to find the
page's row IDs without touching the main table at all.

### Verification

```sql
EXPLAIN QUERY PLAN
SELECT provider, company_slug, job_id
FROM indexed_jobs
WHERE 1 = 1
ORDER BY first_published DESC, title COLLATE NOCASE
LIMIT 20 OFFSET 0;
-- Should show: SCAN indexed_jobs USING COVERING INDEX idx_jobs_page_order
```

### Provider-Filtered Variant

If provider-filtered searches are common, also test:

```sql
CREATE INDEX IF NOT EXISTS idx_jobs_provider_page_order
ON indexed_jobs (provider, first_published DESC, title COLLATE NOCASE, company_slug, job_id);
```

### Tradeoffs

| Pro | Con |
|-----|-----|
| Avoids sorting — index is pre-sorted | Increases write cost (inserts/updates maintain the index) |
| Enables covering scans for deferred-join | Storage overhead (~173k × ~60 bytes ≈ 10 MB) |
| Foundation for Optimisations 3, 4, 5 | `COLLATE NOCASE` in the index must match the query exactly |

> [!WARNING]
> The `COLLATE NOCASE` in the index **must exactly match** the `COLLATE NOCASE` in the
> `ORDER BY` clause. If the query changes, the index stops being useful. Always verify
> with `EXPLAIN QUERY PLAN` after any query changes.

---

## 5. Optimisation 3 — Deferred-Join (Two-Step ID-First Pagination)

### Why

Even with a covering index, deep `OFFSET` means walking many narrow index entries. But walking
narrow entries (just sort keys + primary key) is **much cheaper** than walking wide rows
that include `description` (which can be kilobytes per row).

The deferred-join pattern:
1. **Step 1:** Scan the narrow covering index to find the 20 row IDs for this page.
2. **Step 2:** Fetch full rows for only those 20 IDs using primary key lookups.

### SQL

```sql
-- Single statement — no extra Turso round trip
SELECT
  j.provider, j.company_slug, j.job_id, j.title, j.company_name,
  j.location_name, j.details_url, j.apply_url,
  j.first_published, j.employment_type, j.workplace_type, j.description,
  0 AS is_bookmarked, 1 AS is_available
FROM indexed_jobs j
INNER JOIN (
  SELECT provider, company_slug, job_id
  FROM indexed_jobs
  WHERE 1 = 1  -- same WHERE as outer
  ORDER BY first_published DESC, title COLLATE NOCASE
  LIMIT ? OFFSET ?
) AS page_ids
  ON j.provider = page_ids.provider
  AND j.company_slug = page_ids.company_slug
  AND j.job_id = page_ids.job_id
ORDER BY j.first_published DESC, j.title COLLATE NOCASE;
```

### How It Helps

```
Without deferred-join (current):
  Walk 173,080 WIDE rows (including description) → discard → return 20

With deferred-join:
  Walk 173,080 NARROW index entries (no description) → discard → get 20 IDs
  Fetch 20 WIDE rows by primary key → return

The index walk is ~10-50x faster because each entry is ~60 bytes vs ~2-5 KB.
```

### Implementation in TypeScript

```typescript
function buildDeferredJoinQuery(where: string): string {
  return `
    SELECT
      j.provider, j.company_slug, j.job_id, j.title, j.company_name,
      j.location_name, j.details_url, j.apply_url,
      j.first_published, j.employment_type, j.workplace_type, j.description,
      0 AS is_bookmarked, 1 AS is_available
    FROM indexed_jobs j
    INNER JOIN (
      SELECT provider, company_slug, job_id
      FROM indexed_jobs j
      WHERE ${where}
      ORDER BY j.first_published DESC, j.title COLLATE NOCASE
      LIMIT ? OFFSET ?
    ) AS page_ids
      ON j.provider = page_ids.provider
      AND j.company_slug = page_ids.company_slug
      AND j.job_id = page_ids.job_id
    ORDER BY j.first_published DESC, j.title COLLATE NOCASE
  `;
}
```

### Tradeoffs

| Pro | Con |
|-----|-----|
| Dramatically reduces I/O for deep pages | Requires the covering index (Optimisation 2) |
| Single SQL statement — no extra round trip | Subquery must duplicate the WHERE clause |
| Works with all filter combinations | Does not eliminate the offset walk, just makes it cheaper |
| Compatible with Turso/libSQL | SQLite subquery planner must handle the join correctly — verify with `EXPLAIN QUERY PLAN` |

---

## 6. Optimisation 4 — Cursor / Keyset Pagination

### Why

`OFFSET N` always walks N rows before returning results. Cursor pagination uses the **sort key
of the last row on the previous page** to seek directly to the next page's starting position.
For an index-backed query, this turns O(N) into O(log N + page_size).

### How It Works

```
Page 1:  ORDER BY first_published DESC, title COLLATE NOCASE LIMIT 20
         → last row: first_published='2024-11-01', title='Zephyr Intern'

Page 2:  WHERE (first_published, title) < ('2024-11-01', 'Zephyr Intern')
         ORDER BY ... LIMIT 20
         → seek directly to the right index position
```

### SQL (Row-Value Comparison)

SQLite supports row-value comparisons for multi-column cursors:

```sql
-- Forward cursor (next page)
SELECT
  j.provider, j.company_slug, j.job_id, j.title, j.company_name,
  j.location_name, j.details_url, j.apply_url,
  j.first_published, j.employment_type, j.workplace_type, j.description,
  0 AS is_bookmarked, 1 AS is_available
FROM indexed_jobs j
WHERE ${where}
  AND (j.first_published, j.title, j.provider, j.company_slug, j.job_id)
    < (?, ?, ?, ?, ?)  -- cursor from last row of previous page
ORDER BY j.first_published DESC, j.title COLLATE NOCASE
LIMIT 20;
```

> [!NOTE]
> The cursor must include **all columns in the ORDER BY plus tiebreakers** to be fully
> deterministic. Since `first_published` can have duplicates and `title COLLATE NOCASE`
> can tie, include `(provider, company_slug, job_id)` as tiebreakers.

### API Changes

```typescript
// New response shape
interface CursorJobSearchResponse extends JobSearchResponse {
  cursor?: {
    first_published: string;
    title: string;
    provider: string;
    company_slug: string;
    job_id: string;
  };
}

// New query parameter
// GET /api/jobs?q=intern&after=eyJmcCI6IjIwMjQtMTEtMDEiLCJ0IjoiWmVwaHlyIiwicCI6Imx...
// `after` is a base64url-encoded JSON cursor
```

### Compatibility with Page Numbers

Cursor pagination and page-number pagination **are not mutually exclusive**. The strategy:

1. **Page 1:** Always uses `OFFSET 0` (no cursor needed).
2. **Sequential navigation** (Next/Prev): Use cursor — O(log N).
3. **Random page jump** (clicking page 5000): Fall back to OFFSET — O(N), but improved by
   deferred-join (Optimisation 3).
4. **Prefetch:** Nearby pages use cursors chained from the current result; distant pages use OFFSET.

### Implementation Sketch

```typescript
// In executeJobSearch — enhanced with optional cursor
export async function executeJobSearch(
  params: JobSearchParams & { cursor?: CursorValue },
): Promise<CursorJobSearchResponse> {
  const { where, args } = buildWhere(params);

  if (params.cursor) {
    // Cursor-based: seek directly
    const cursorWhere = `${where} AND (j.first_published, j.title, j.provider, j.company_slug, j.job_id) < (?, ?, ?, ?, ?)`;
    const cursorArgs = [
      ...args,
      params.cursor.first_published,
      params.cursor.title,
      params.cursor.provider,
      params.cursor.company_slug,
      params.cursor.job_id,
    ];
    // ... execute with cursorWhere
  } else {
    // Offset-based: existing logic (with deferred-join)
  }
}
```

### Tradeoffs

| Pro | Con |
|-----|-----|
| O(log N) for sequential page navigation | Cannot jump to arbitrary page N without falling back to OFFSET |
| Index seek instead of walk | API becomes more complex (cursor parameter) |
| No stale-data issues from cached offsets | Client must store and forward cursor values |
| Works beautifully with prefetch (chain cursors) | Requires the covering index (Optimisation 2) |

> [!TIP]
> Start by implementing cursor pagination only for Next/Prev navigation and
> sequential prefetch. Keep OFFSET + deferred-join as the fallback for random page jumps.

---

## 7. Optimisation 5 — Reverse Scan for Tail Pages

### Why

When the user navigates to the **last few pages** (e.g., page 8655 of 8655), the `OFFSET` walk
traverses nearly the entire table. A reverse scan starts from the **end** of the index and reads
only the handful of rows needed.

### Strategy

If `page > totalPages / 2`, query in **ascending** order with a mirrored offset, then reverse
the results in application code.

### SQL

```sql
-- Normal (first half of pages):
ORDER BY first_published DESC, title COLLATE NOCASE
LIMIT 20 OFFSET 173060

-- Reversed (last half of pages):
ORDER BY first_published ASC, title COLLATE NOCASE DESC
LIMIT 20 OFFSET (total - page * pageSize)
-- Then reverse the result array in TypeScript
```

### Implementation

```typescript
function isInTailHalf(page: number, totalPages: number): boolean {
  return page > totalPages / 2;
}

function buildPageQuery(where: string, page: number, pageSize: number, total: number, totalPages: number) {
  if (isInTailHalf(page, totalPages)) {
    // Reverse scan — offset from the end
    const tailOffset = Math.max(0, total - page * pageSize);
    const tailLimit = Math.min(pageSize, total - (page - 1) * pageSize);
    return {
      sql: `SELECT /* columns */
        FROM indexed_jobs j WHERE ${where}
        ORDER BY j.first_published ASC, j.title COLLATE NOCASE DESC
        LIMIT ? OFFSET ?`,
      offset: tailOffset,
      limit: tailLimit,
      reverseResults: true,
    };
  }

  // Normal forward scan
  return {
    sql: `SELECT /* columns */
      FROM indexed_jobs j WHERE ${where}
      ORDER BY j.first_published DESC, j.title COLLATE NOCASE
      LIMIT ? OFFSET ?`,
    offset: (page - 1) * pageSize,
    limit: pageSize,
    reverseResults: false,
  };
}
```

### Tradeoffs

| Pro | Con |
|-----|-----|
| Last page is as fast as first page | Need to know `total` before deciding scan direction (requires count first) |
| No API changes — transparent to client | Reverse-order index scan must be verified with `EXPLAIN QUERY PLAN` |
| Combines well with deferred-join | Edge cases around middle pages need careful offset maths |

> [!IMPORTANT]
> This optimisation **requires knowing the total count first** to decide scan direction.
> It pairs naturally with Optimisation 1 (separate cached count).

---

## 8. Optimisation 6 — Exclude Description from Page Queries

### Why

The current page query always selects `j.description` — a column that can be several kilobytes
per row. On the list page, descriptions are **not displayed** (they are only used for
`includeDescriptions` search matching, which happens in the `WHERE` clause, not in the `SELECT`).

### Current Behaviour

```typescript
// In toPlainJobs — description IS included in the response
description: job.description,
```

The client receives and caches descriptions for all 20 jobs per page, even though the list view
only shows title, company, location, and date. Descriptions are only shown when a user clicks
into a job detail view.

### Strategy

1. Remove `j.description` from the page query's `SELECT` list.
2. Return an empty string for `description` in list responses.
3. Add a separate endpoint or parameter to fetch a single job's description on demand.

### Impact Estimate

```
20 jobs × ~3 KB average description = ~60 KB per page response
Without description: 20 jobs × ~200 bytes = ~4 KB per page response

Reduction: ~93% smaller payloads
Combined with MessagePack: even smaller
```

### Tradeoffs

| Pro | Con |
|-----|-----|
| ~93% payload reduction | Requires a separate request for job detail (or lazy-load) |
| Faster page queries (less I/O) | Changes the `JobSearchResponse` contract |
| Less memory in client page cache | Client needs to handle missing descriptions gracefully |

> [!NOTE]
> The `includeDescriptions` search filter still needs `description` in the `WHERE` clause,
> but it does **not** need it in the `SELECT` list. SQLite can match against a column
> without returning it.

---

## 9. Optimisation 7 — Client Prefetch Count Deduplication

### Why

The client ([`job-browser.tsx`](file:///d:/projects/crawler/frontend/components/job-browser.tsx) lines 500-535)
prefetches nearby pages after the current page loads. Each prefetch is a full `loadPage` call
that returns to `/api/jobs?page=N&...` — and each of those triggers a server-side
`searchJobs` with its own cache key (because `page` is in the key).

Even with Optimisation 1 (server-side count separation), we can improve the client:

### Strategy

Pass the known `totalPages` from the current page's response to prefetch requests, so
prefetched pages can skip the count entirely:

```typescript
// New optional parameter
// GET /api/jobs?page=2&q=intern&known_total=173120
// If known_total is provided and fresh, skip the COUNT(*) query
```

Or simpler: the server cache for count (Optimisation 1) handles this automatically. The key
insight is that **all prefetched pages share the same filter params**, so the count cache
will be warm after the first page load.

### Current Prefetch Scope

From [`job-pagination.ts`](file:///d:/projects/crawler/frontend/lib/job-pagination.ts) lines 29-52:

```typescript
// Pages prefetched for current page N:
// 1. All visible pagination items (up to 5 page numbers)
// 2. ±1 neighbour of each visible item
// 3. Current page + [-1, +1, +2, +3]
// After dedup: typically 8-12 pages prefetched
```

With Optimisation 1, this means **1 count query** (cached) + **8-12 page queries** instead of
the current **8-12 count queries + 8-12 page queries**.

---

## 10. Optimisation 8 — FTS5 for Filtered Searches

### Why

The current search uses `LOWER(col) LIKE '%term%'` which:
- Wraps the column in a function → prevents index usage
- Uses leading wildcard `%term%` → forces full table scan
- Runs against 3 columns (title, company_name, location_name) per search

### FTS5 Alternative

```sql
-- Schema change (crawler repo)
CREATE VIRTUAL TABLE indexed_jobs_fts USING fts5(
  title,
  company_name,
  location_name,
  content='indexed_jobs',
  content_rowid='rowid',
  tokenize='trigram'  -- preserves substring matching semantics
);

-- Populate
INSERT INTO indexed_jobs_fts(indexed_jobs_fts) VALUES('rebuild');

-- Query
SELECT j.*
FROM indexed_jobs j
INNER JOIN indexed_jobs_fts fts ON j.rowid = fts.rowid
WHERE indexed_jobs_fts MATCH '"intern"'
ORDER BY j.first_published DESC, j.title COLLATE NOCASE
LIMIT 20 OFFSET 0;
```

### Caveats

> [!CAUTION]
> 1. **Turso/libSQL FTS5 support** — Verify that the deployed Turso instance supports FTS5
>    with the trigram tokenizer. Some configurations may not include it.
> 2. **Trigram tokenizer** — Needed to preserve the current substring matching behaviour.
>    Standard FTS5 tokenizers only match at word boundaries.
> 3. **Sync overhead** — The FTS5 table must be kept in sync with `indexed_jobs` via triggers
>    or rebuild after crawler writes.
> 4. **Description search** — The current `GLOB` pattern matching for descriptions is more
>    complex and may not map cleanly to FTS5.

### Recommendation

FTS5 is a **Phase 2** optimisation. Start with Optimisations 1-7 which require no schema
changes (except the covering index) and provide large improvements. Evaluate FTS5 only if
filtered searches remain a bottleneck after the other optimisations.

---

## 11. Migration & Rollout Strategy

### Phase 1 — Quick Wins (No Schema Changes)

```mermaid
flowchart LR
  A["Separate count query<br/>(Opt 1)"] --> B["Exclude description<br/>from SELECT (Opt 6)"]
  B --> C["Client prefetch<br/>dedup (Opt 7)"]
```

| Step | Change | Risk | Effort |
|------|--------|------|--------|
| 1.1 | Separate count into cached function | Low — additive change | ~2 hours |
| 1.2 | Remove `description` from page SELECT | Medium — API contract change | ~3 hours |
| 1.3 | Client dedup is automatic with 1.1 | None | 0 (free) |

**Expected improvement:** 50-70% reduction in database load for prefetch-heavy sessions,
~93% smaller payloads.

### Phase 2 — Index & Query Changes (Schema Changes)

```mermaid
flowchart LR
  D["Add covering index<br/>(Opt 2)"] --> E["Deferred-join<br/>query (Opt 3)"]
  E --> F["Reverse scan for<br/>tail pages (Opt 5)"]
```

| Step | Change | Risk | Effort |
|------|--------|------|--------|
| 2.1 | Add covering index on crawler DB | Low — additive, read-only on frontend | ~1 hour |
| 2.2 | Implement deferred-join query | Medium — query change | ~3 hours |
| 2.3 | Reverse scan for tail pages | Medium — needs count first | ~2 hours |

**Expected improvement:** 10-50x faster deep page queries. Sorting eliminated for
unfiltered queries.

### Phase 3 — Cursor Pagination (API Change)

| Step | Change | Risk | Effort |
|------|--------|------|--------|
| 3.1 | Add cursor parameter to API | Medium — new API surface | ~4 hours |
| 3.2 | Client-side cursor forwarding | Medium — state management | ~4 hours |
| 3.3 | Cursor-based prefetch chaining | Low — enhancement of existing | ~2 hours |

**Expected improvement:** Sequential navigation becomes O(log N) regardless of page depth.

### Phase 4 — FTS5 (If Needed)

Only pursue if filtered searches (`q=intern`) remain slow after Phase 1-3. Requires Turso
FTS5 support verification.

### Validation Checklist

For each optimisation, before deploying:

- [ ] `EXPLAIN QUERY PLAN` confirms expected index usage
- [ ] Benchmark against current query with production data size (~173k rows)
- [ ] Test with all filter combinations (empty, single filter, multi-filter, description search)
- [ ] Test pagination edge cases (page 1, last page, beyond-last-page clamping, single-result)
- [ ] Verify MessagePack encoding still works with any response shape changes
- [ ] Test the `JOB_SEARCH_CACHE_MODE=off` bypass path
- [ ] Verify `isJobSearchResponse` validator still passes (if response shape changes)

---

## 12. Appendix — File Reference

### Files That Need Changes (by Phase)

**Phase 1:**
- [`lib/job-search.ts`](file:///d:/projects/crawler/frontend/lib/job-search.ts) — Separate count, remove description from SELECT
- New file: `lib/job-search-count.ts` — Cached count function
- [`lib/jobs.ts`](file:///d:/projects/crawler/frontend/lib/jobs.ts) — Update `Job` type if description becomes optional
- [`components/job-browser.tsx`](file:///d:/projects/crawler/frontend/components/job-browser.tsx) — Handle missing descriptions in list view

**Phase 2:**
- Crawler repo — Add covering index migration
- [`lib/job-search.ts`](file:///d:/projects/crawler/frontend/lib/job-search.ts) — Deferred-join query, reverse scan logic

**Phase 3:**
- [`lib/job-search-params.ts`](file:///d:/projects/crawler/frontend/lib/job-search-params.ts) — Parse cursor parameter
- [`lib/job-search.ts`](file:///d:/projects/crawler/frontend/lib/job-search.ts) — Cursor-based query branch
- [`app/api/jobs/route.ts`](file:///d:/projects/crawler/frontend/app/api/jobs/route.ts) — Pass cursor through
- [`lib/jobs.ts`](file:///d:/projects/crawler/frontend/lib/jobs.ts) — `CursorJobSearchResponse` type
- [`components/job-browser.tsx`](file:///d:/projects/crawler/frontend/components/job-browser.tsx) — Store and forward cursors

### Glossary

| Term | Definition |
|------|-----------|
| **Covering index** | An index that contains all columns needed by a query, so the database never reads the main table |
| **Deferred join** | Query pattern that finds row IDs from a narrow index first, then fetches full rows only for the needed IDs |
| **Cursor/Keyset pagination** | Using the sort key of the last row on page N as the starting point for page N+1, instead of counting an offset |
| **Reverse scan** | Reading an index from end to start to efficiently access the last pages |
| **FTS5** | SQLite's Full-Text Search extension, version 5 |
| **Trigram tokenizer** | FTS5 tokenizer that indexes all 3-character substrings, enabling substring matching |
| **Batch** | Turso/libSQL feature that sends multiple SQL statements in a single network round trip |
