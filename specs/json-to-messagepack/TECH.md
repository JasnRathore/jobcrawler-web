# JSON-to-MessagePack API Payloads - Technical Spec

Status: Proposed

Related behavior: [PRODUCT.md](./PRODUCT.md)

Repository revision researched: `f154694099861ae9a155ccfc6d16bfc6af7e4e7e`

## Context

The job-search API is a same-origin Next.js route. At the researched revision,
[`app/api/jobs/route.ts:1-33`](https://github.com/JasnRathore/jobcrawler-web/blob/f154694099861ae9a155ccfc6d16bfc6af7e4e7e/app/api/jobs/route.ts#L1-L33)
checks the request origin, parses query parameters, calls `searchJobs`, and
serializes the successful result with `NextResponse.json`. The result is
marked `Cache-Control: no-store`; validation and database failures use the
existing JSON `{ error }` response shape.

[`components/job-browser.tsx:250-340`](https://github.com/JasnRathore/jobcrawler-web/blob/f154694099861ae9a155ccfc6d16bfc6af7e4e7e/components/job-browser.tsx#L250-L340)
owns the browser request flow. `loadPage` fetches `/api/jobs`, parses JSON,
surfaces API errors, deduplicates in-flight requests, and keeps a bounded
in-memory page cache. The component is the only client boundary that needs to
opt in and decode the new representation.

[`lib/jobs.ts:1-35`](https://github.com/JasnRathore/jobcrawler-web/blob/f154694099861ae9a155ccfc6d16bfc6af7e4e7e/lib/jobs.ts#L1-L35)
defines the shared `Job` and `JobSearchResponse` shapes. Keep this logical
contract identical in JSON and MessagePack; both encodings carry the same
plain-object result.

The server-side search and cache boundary in
[`lib/job-search.ts:160-176`](https://github.com/JasnRathore/jobcrawler-web/blob/f154694099861ae9a155ccfc6d16bfc6af7e4e7e/lib/job-search.ts#L160-L176)
returns the domain response before HTTP serialization. Keep encoding at the
route boundary so the cache remains representation-independent.

Bookmarks are a separate browser-persistence concern:
[`lib/bookmarks.ts:40-68`](https://github.com/JasnRathore/jobcrawler-web/blob/f154694099861ae9a155ccfc6d16bfc6af7e4e7e/lib/bookmarks.ts#L40-L68)
validates and stores them using JSON in `localStorage`. That format is
explicitly out of scope.

## Proposed changes

### 1. Keep the migration at the HTTP boundary

Add the `@msgpack/msgpack` runtime dependency and use its `encode` / `decode`
functions. Do not change SQL rows, `Job`, `JobSearchResponse`, the cache key,
or the cached server function.

Add a small shared transport helper (for example, `lib/api-payload.ts`) for
the media-type constants and `Accept` negotiation. Keep it independent of
Next.js request types so its negotiation behavior can be unit tested. Treat an
absent `Accept`, `*/*`, JSON-only preference, or explicit
`application/msgpack;q=0` as JSON. Select MessagePack only when the header
explicitly accepts `application/msgpack` with a positive quality value and
does not prefer JSON more highly. Do not return `406`; JSON remains the
compatibility fallback.

### 2. Negotiate the successful route response

In `app/api/jobs/route.ts`, preserve origin validation, parameter parsing,
database calls, and all current status codes. For a successful search:

- If MessagePack was negotiated, encode the unchanged `JobSearchResponse` and
  return its bytes with `Content-Type: application/msgpack`.
- Otherwise, retain `NextResponse.json` and the existing JSON contract.
- Add `Vary: Accept` to both success variants so an intermediary cannot reuse
  one representation for a request asking for the other. Preserve the current
  `Cache-Control: no-store` behavior.

Keep all error responses JSON, including 400, 403, and 500 responses. This
preserves the current error envelope and avoids requiring the frontend to
decode binary errors before it can report a failure. Ensure `Vary: Accept` is
also present on route errors if a response-building helper is introduced.
Do not manually set `Content-Length`; allow the Next.js runtime and deployment
compression layer to own transfer framing.

### 3. Opt the frontend in and decode by response type

Update `loadPage` in `components/job-browser.tsx` to send an explicit
preference such as `Accept: application/msgpack, application/json;q=0.8` only
when `NEXT_PUBLIC_JOB_SEARCH_MESSAGEPACK=true`. Keep the flag false by default;
operators enable it after the B8 performance gates pass. Document that the
public build-time variable requires a server restart or rebuild after changes.
Inspect the returned `Content-Type` before decoding:

- For `application/msgpack`, read `arrayBuffer()` and decode with
  `@msgpack/msgpack`.
- For JSON (including errors and fallback responses), continue to use
  `response.json()`.
- Preserve the current `response.ok` check, error message behavior, request
  deduplication, page-cache generation guard, and 20-entry page cache.

Treat decode failures and unexpected content types as load errors; do not
silently reinterpret malformed bytes as JSON or fall back to a success-shaped
empty result. If the decoded value is not a valid job-search response, report
the same user-visible load failure rather than inserting it in the page cache.
Use a focused type guard for the response envelope if required by the codec's
`unknown` decode result; avoid weakening the existing `JobSearchResponse`
types.

### 4. Keep representation and data concerns separate

Do not modify `lib/bookmarks.ts`, local-storage keys, query-string
construction, search filtering, or the server cache. Do not encode only
selected fields or introduce integer-key maps: that would create a second
schema and make JSON fallback harder to compare. The wire object should retain
the existing field names and values.

### 5. Benchmark before treating the change as an optimization

Capture a JSON baseline and compare it with MessagePack using the same
representative search results:

- descriptions off and on;
- empty, typical, and large result pages;
- raw body bytes and compressed transfer bytes using the production
  compression path (or gzip and Brotli locally when that path is unavailable);
- server encode time, client decode time, and end-to-end p50/p95 latency.

Record fixture/query identity, page size, runtime, warm/cold state, compression
settings, and repeated-run methodology so results are comparable. The
`package.json` at the researched revision exposes `lint` and `build` scripts
but no test script; check for an existing test runner before choosing the
smallest focused test setup and adding a `test` script. Do not add production
compression middleware as part of this migration.

Use the proposed rollout gate in `PRODUCT.md`: at least 10% median reduction in
compressed response-body bytes and no more than 5% p95 end-to-end latency
regression. Record the measurements and any justified threshold adjustment.

### Local benchmark status

A synthetic 20-job page with repeated descriptions measured 37,389 JSON bytes
versus 36,334 MessagePack bytes (2.8% smaller raw). After local gzip, the sizes
were 977 and 1,056 bytes respectively; after Brotli, 504 and 543 bytes. This
fixture is not production data and does not measure latency, but it does not
pass the compressed-size gate. Keep `NEXT_PUBLIC_JOB_SEARCH_MESSAGEPACK=false`
until a representative workload and the deployment compression path show the
gate is met.

## End-to-end flow

```mermaid
sequenceDiagram
    participant UI as JobBrowser
    participant API as GET /api/jobs
    participant Search as searchJobs
    UI->>API: GET query + Accept: application/msgpack, application/json;q=0.8
    API->>API: Validate origin and parse query
    API->>Search: Validated search parameters
    Search-->>API: JobSearchResponse
    API-->>UI: MessagePack bytes + Content-Type + Vary: Accept
    UI->>UI: Decode by Content-Type; validate; cache typed result
```

For callers that do not explicitly request MessagePack, the final API response
uses JSON. Error responses continue to use JSON for all callers.

## Testing and validation

Map verification to the product invariants in `PRODUCT.md`:

| Invariant | Verification |
| --- | --- |
| B1 | Round-trip representative `JobSearchResponse` values through MessagePack and compare every field with the JSON result. Include empty and non-empty job arrays. |
| B2 | Client tests cover MessagePack success, JSON success fallback, JSON API errors, and malformed MessagePack; verify errors never enter the page cache. |
| B3 | Negotiation tests cover missing `Accept`, wildcard, JSON-only, explicit MessagePack, lower MessagePack quality, and `q=0`. |
| B4 | Route tests verify origin rejection, invalid query, database failure, status codes, and the unchanged JSON error envelope. |
| B5 | Route tests verify `Vary: Accept` for both successful representations and applicable errors; verify successful responses remain `no-store`. |
| B6 | Existing query construction and parser tests continue to pass without request-body changes. |
| B7 | Existing bookmark validation/read/write tests remain unchanged and continue to persist JSON. |
| B8 | Run the before/after benchmark above. Do not claim a latency improvement unless measured end-to-end results support it; do not roll out by default if compressed bytes fail to improve meaningfully or p95 regresses materially. |

Also run `npm run lint` and `npm run build`. Exercise a manual browser search with
descriptions both off and on, page navigation, a JSON fallback response, and an
API error. Confirm the UI and pagination are unchanged.

## Risks and mitigations

- **Compression can erase the raw-size advantage.** Compare compressed transfer
  sizes using the hosting path, not only `JSON.stringify` length.
- **Encoding/decoding CPU can offset network savings.** Record codec and
  end-to-end timings; retain JSON fallback and gate rollout on measured results.
- **Representation caching can mix formats.** Send `Vary: Accept`; keep the
  route's `no-store` behavior.
- **Codec output can be mistaken for JSON by clients.** Always send and inspect
  `Content-Type`; handle malformed or unknown formats as errors.
- **Deploys can temporarily pair new clients with an old route, or vice versa.**
  Keep JSON as the default and fallback. An older route that ignores `Accept`
  still returns JSON, which the new client can decode; deploy route support
  before client opt-in when deployment sequencing allows.

## Implementer handoff

1. Establish baseline fixtures and measurements before adding the codec.
2. Add the codec dependency and focused negotiation/codec tests.
3. Implement route response negotiation while keeping JSON as the default.
4. Update the frontend decoder behind the opt-in flag; preserve request and
   page caching behavior.
5. Run tests, lint, build, and the comparative benchmark; record results and
   enable the MessagePack flag only when the measurements support the product
   goal.
