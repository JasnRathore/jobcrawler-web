import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptsMessagePack,
  createMessagePackResponse,
  decodeApiResponse,
  isApiErrorPayload,
  MESSAGEPACK_MEDIA_TYPE,
} from "./api-payload.ts";
import { isJobSearchResponse, type JobSearchResponse } from "./jobs.ts";

const jobSearchResponse: JobSearchResponse = {
  jobs: [
    {
      provider: "lever",
      company_slug: "example",
      job_id: "job-1",
      title: "Software Engineer",
      company_name: "Example Co",
      location_name: "Remote",
      details_url: "https://example.com/jobs/job-1",
      apply_url: "https://example.com/jobs/job-1/apply",
      first_published: "2025-01-01",
      employment_type: "full-time",
      workplace_type: "remote",
      description: "Build useful software.",
      is_bookmarked: 0,
      is_available: 1,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

test("opts into MessagePack only when it is explicitly accepted", () => {
  const cases: Array<[string | null, boolean]> = [
    [null, false],
    ["", false],
    ["*/*", false],
    ["application/json", false],
    ["application/msgpack", true],
    ["application/msgpack, application/json;q=0.8", true],
    ["application/msgpack;q=0.8, application/json;q=0.8", true],
    ["application/msgpack;q=0.5, application/json;q=0.8", false],
    ["application/msgpack;q=0", false],
    ["application/msgpack;q=1.1", false],
    ["application/msgpack;q=0.8, */*;q=1", false],
    ["APPLICATION/MSGPACK;Q=0.9, application/json;q=0.7", true],
  ];

  for (const [accept, expected] of cases) {
    assert.equal(acceptsMessagePack(accept), expected, String(accept));
  }
});

test("MessagePack responses preserve payloads and vary on Accept", async () => {
  const response = createMessagePackResponse(jobSearchResponse, {
    headers: {
      "Cache-Control": "no-store",
      Vary: "Origin",
    },
  });

  assert.equal(response.headers.get("Content-Type"), MESSAGEPACK_MEDIA_TYPE);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Vary"), "Origin, Accept");
  assert.deepEqual(await decodeApiResponse(response), jobSearchResponse);

  const emptyResponse = createMessagePackResponse({
    ...jobSearchResponse,
    jobs: [],
    total: 0,
    totalPages: 1,
  });
  assert.deepEqual(await decodeApiResponse(emptyResponse), {
    ...jobSearchResponse,
    jobs: [],
    total: 0,
    totalPages: 1,
  });
});

test("decodes JSON fallback responses and rejects unknown media types", async () => {
  const jsonResponse = new Response(JSON.stringify(jobSearchResponse), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
  assert.deepEqual(await decodeApiResponse(jsonResponse), jobSearchResponse);

  const unknownResponse = new Response("payload", {
    headers: { "Content-Type": "text/plain" },
  });
  await assert.rejects(
    decodeApiResponse(unknownResponse),
    /Unsupported API response content type/,
  );

  const malformedMessagePack = new Response(Uint8Array.of(0xc1), {
    headers: { "Content-Type": MESSAGEPACK_MEDIA_TYPE },
  });
  await assert.rejects(decodeApiResponse(malformedMessagePack));
});

test("validates decoded search and error response shapes", () => {
  assert.equal(isJobSearchResponse(jobSearchResponse), true);
  assert.equal(
    isJobSearchResponse({
      ...jobSearchResponse,
      jobs: [{ ...jobSearchResponse.jobs[0], provider: "unknown" }],
    }),
    false,
  );
  assert.equal(
    isJobSearchResponse({ ...jobSearchResponse, page: Number.NaN }),
    false,
  );

  assert.equal(isApiErrorPayload({ error: "Invalid query." }), true);
  assert.equal(isApiErrorPayload({ error: 500 }), false);
  assert.equal(isApiErrorPayload(null), false);
});
