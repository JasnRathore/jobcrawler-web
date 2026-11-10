import assert from "node:assert/strict";
import test from "node:test";

import {
  getPagesToPrefetch,
  getPaginationItems,
} from "./job-pagination.ts";

test("reveals the next page when the current page reaches three", () => {
  assert.deepEqual(getPaginationItems(3, 8_682), [
    1,
    2,
    3,
    4,
    "ellipsis",
    8_682,
  ]);
});

test("moves the numbered window with the current page", () => {
  assert.deepEqual(getPaginationItems(4, 8_682), [
    1,
    "ellipsis",
    3,
    4,
    5,
    "ellipsis",
    8_682,
  ]);
});

test("prefetches only the nearby pages and visible page links", () => {
  assert.deepEqual(
    getPagesToPrefetch(50, 100, [1, 50, 100]),
    [1, 2, 49, 51, 52, 53, 99, 100],
  );
});

test("prefetches immediate neighbors of every visible page number", () => {
  const visiblePages = getPaginationItems(6, 8_682).filter(
    (item): item is number => typeof item === "number",
  );

  assert.deepEqual(visiblePages, [1, 5, 6, 7, 8_682]);
  assert.deepEqual(
    getPagesToPrefetch(6, 8_682, visiblePages),
    [1, 2, 4, 5, 7, 8, 9, 8_681, 8_682],
  );
});

test("bounds prefetching for large result sets", () => {
  const pages = getPagesToPrefetch(500, 100_000, [1, 500, 100_000]);

  assert.deepEqual(pages, [
    1,
    2,
    499,
    501,
    502,
    503,
    99_999,
    100_000,
  ]);
  assert.ok(pages.length <= 10);
  assert.ok(pages.length < 100_000);
});

test("deduplicates visible and adjacent pages and respects result boundaries", () => {
  assert.deepEqual(getPagesToPrefetch(1, 4, [1, 2, 4]), [2, 3, 4]);
  assert.deepEqual(getPagesToPrefetch(4, 4, [1, 3, 4]), [1, 2, 3]);
});
