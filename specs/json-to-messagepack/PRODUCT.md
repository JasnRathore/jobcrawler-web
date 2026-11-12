# JSON-to-MessagePack API Payloads

Status: Proposed

## Summary

Use MessagePack for successful job-search API responses to reduce transferred
bytes and improve end-to-end response time, while retaining JSON as the
compatibility format. This is a transport change: search behavior and the
`JobSearchResponse` data contract remain unchanged.

## Goals

- Reduce the on-wire size of representative `/api/jobs` responses.
- Measure whether smaller responses improve end-to-end response time; do not
  claim a speed improvement without benchmark evidence.
- Let the current frontend opt into MessagePack while requests without that
  explicit preference continue to receive JSON.
- Preserve the current search results, pagination, filtering, and error
  semantics.

## Non-goals

- Changing the crawler, database schema, SQL query behavior, or search
  parameters.
- Encoding request query parameters or introducing request bodies.
- Migrating bookmarks, browser storage, or other persisted JSON.
- Changing job-search caching or promising a particular hosting-level
  compression behavior.
- Replacing JSON for unrelated routes or external integrations.

## Behavior invariants

**B1.** A search returns the same `JobSearchResponse` fields and values for the
same query, regardless of response encoding.

**B2.** When the rollout flag is enabled, the frontend explicitly requests
MessagePack and decodes a successful response according to its `Content-Type`.
The flag is off by default until the B8 performance gates pass. The frontend
continues to accept JSON for older deployments and JSON fallback responses.

**B3.** A request without an explicit positive preference for
`application/msgpack` receives JSON. A request that explicitly disables
MessagePack also receives JSON; the route does not require clients to support
the new format.

**B4.** Existing query validation, same-origin checks, HTTP status codes, and
error envelope (`{ "error": string }`) are preserved. Error responses remain
JSON, including when a client requested MessagePack.

**B5.** The response representation varies by `Accept`; responses identify
that with `Vary: Accept`. Existing non-cacheable API behavior is preserved.

**B6.** GET query-string semantics do not change. No MessagePack request body is
introduced.

**B7.** Browser-local bookmarks remain JSON in local storage and retain their
current validation and persistence behavior.

**B8.** MessagePack is adopted for the frontend only if representative
measurements show at least a 10% median reduction in compressed response-body
bytes without a p95 end-to-end latency regression greater than 5%. Any speed-up
claim is based on measured results, not the encoding choice alone.

## Acceptance criteria

- The frontend can load and display a job-search response encoded as
  MessagePack without changing visible search behavior.
- `NEXT_PUBLIC_JOB_SEARCH_MESSAGEPACK` defaults to `false`; enabling it makes
  the frontend opt into MessagePack only after the B8 rollout gates pass.
- JSON fallback and JSON error handling continue to work.
- Benchmarks compare representative pages with descriptions enabled and
  disabled, including the actual deployment compression path where available.
- The rollout report records baseline and MessagePack bytes plus p50/p95
  end-to-end latency. Enable MessagePack for the frontend by default only when
  the B8 size and latency gates pass. Treat the 10% / 5% thresholds as proposed
  rollout gates and record any evidence-based adjustment before implementation.
