import assert from "node:assert/strict";
import test from "node:test";

import { parseJobSearchParams } from "./job-search-params.ts";

test("normalizes equivalent search inputs into a stable cache argument", () => {
  const first = parseJobSearchParams(
    new URLSearchParams(
      "q=%20DESIGN%20&location=Remote&provider=lever&page=2&details=true",
    ),
  );
  const reordered = parseJobSearchParams(
    new URLSearchParams(
      "details=true&page=2&provider=lever&location=remote&q=design",
    ),
  );

  assert.equal(first.ok, true);
  assert.equal(reordered.ok, true);
  if (!first.ok || !reordered.ok) return;

  assert.deepEqual(first.params, reordered.params);
  assert.deepEqual(Object.keys(first.params), [
    "cacheSchemaVersion",
    "query",
    "location",
    "provider",
    "employment",
    "workplace",
    "postedAfter",
    "postedBefore",
    "includeDescriptions",
    "page",
    "pageSize",
  ]);
});

test("preserves existing input bounds and parseInt page behavior", () => {
  const parsed = parseJobSearchParams(
    new URLSearchParams(
      `q=${"A".repeat(205)}&location=${"B".repeat(125)}&page=2junk`,
    ),
  );

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  assert.equal(parsed.params.query.length, 200);
  assert.equal(parsed.params.query, "a".repeat(200));
  assert.equal(parsed.params.location.length, 120);
  assert.equal(parsed.params.location, "b".repeat(120));
  assert.equal(parsed.params.page, 2);
});

test("keeps every result-affecting filter and page in the cache arguments", () => {
  const baseline = parseJobSearchParams(new URLSearchParams());
  assert.equal(baseline.ok, true);
  if (!baseline.ok) return;

  const variants = [
    "q=engineer",
    "location=remote",
    "provider=lever",
    "employment=full-time",
    "workplace=hybrid",
    "posted_after=2025-01-01",
    "posted_before=2025-01-31",
    "details=true",
    "page=2",
  ];

  for (const variant of variants) {
    const parsed = parseJobSearchParams(new URLSearchParams(variant));
    assert.equal(parsed.ok, true, variant);
    if (!parsed.ok) continue;

    assert.notDeepEqual(parsed.params, baseline.params, variant);
    assert.equal(
      parsed.params.cacheSchemaVersion,
      baseline.params.cacheSchemaVersion,
    );
    assert.equal(parsed.params.pageSize, baseline.params.pageSize);
  }
});

test("rejects unknown providers and invalid dates", () => {
  assert.deepEqual(
    parseJobSearchParams(new URLSearchParams("provider=unknown")),
    { ok: false, error: "Unknown job provider." },
  );
  assert.deepEqual(
    parseJobSearchParams(new URLSearchParams("posted_after=2025-02-30")),
    { ok: false, error: "Invalid start date." },
  );
  assert.deepEqual(
    parseJobSearchParams(new URLSearchParams("posted_before=2025-01-01")),
    {
      ok: true,
      params: {
        cacheSchemaVersion: "jobs-v1",
        query: "",
        location: "",
        provider: "",
        employment: "",
        workplace: "",
        postedAfter: "",
        postedBefore: "2025-01-01",
        includeDescriptions: false,
        page: 1,
        pageSize: 20,
      },
    },
  );
});
