import assert from "node:assert/strict";
import test from "node:test";

import { isSameOriginRequest } from "./same-origin-request.ts";

const appOrigin = "https://jobs.example.com";

test("accepts same-origin browser metadata", () => {
  assert.equal(
    isSameOriginRequest(
      new Headers({ "sec-fetch-site": "same-origin" }),
      appOrigin,
    ),
    true,
  );
  assert.equal(
    isSameOriginRequest(
      new Headers({ origin: appOrigin }),
      appOrigin,
    ),
    true,
  );
  assert.equal(
    isSameOriginRequest(
      new Headers({ referer: `${appOrigin}/` }),
      appOrigin,
    ),
    true,
  );
});

test("rejects cross-origin, cross-site, and missing browser metadata", () => {
  assert.equal(
    isSameOriginRequest(
      new Headers({
        "sec-fetch-site": "cross-site",
        origin: appOrigin,
      }),
      appOrigin,
    ),
    false,
  );
  assert.equal(
    isSameOriginRequest(
      new Headers({ origin: "https://attacker.example" }),
      appOrigin,
    ),
    false,
  );
  assert.equal(
    isSameOriginRequest(
      new Headers({ referer: "not a URL" }),
      appOrigin,
    ),
    false,
  );
  assert.equal(isSameOriginRequest(new Headers(), appOrigin), false);
});
