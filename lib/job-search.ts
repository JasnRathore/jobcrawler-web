import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { Job, JobSearchResponse } from "./jobs";
import { getTursoConnection } from "./turso";
import type { JobSearchParams } from "./job-search-params";

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function toPlainJobs(rows: Job[]): Job[] {
  return rows.map((job) => ({
    provider: job.provider,
    company_slug: job.company_slug,
    job_id: job.job_id,
    title: job.title,
    company_name: job.company_name,
    location_name: job.location_name,
    details_url: job.details_url,
    apply_url: job.apply_url,
    first_published: job.first_published,
    employment_type: job.employment_type,
    workplace_type: job.workplace_type,
    description: job.description,
    is_bookmarked: 0,
    is_available: job.is_available,
  }));
}

export function buildWhere(params: JobSearchParams): {
  where: string;
  args: Array<string | number>;
} {
  const conditions = ["1 = 1"];
  const args: Array<string | number> = [];

  if (params.provider) {
    conditions.push("j.provider = ?");
    args.push(params.provider);
  }
  if (params.query) {
    const pattern = `%${escapeLike(params.query)}%`;
    const searchConditions = [
      "LOWER(j.title) LIKE ? ESCAPE '\\'",
      "LOWER(j.company_name) LIKE ? ESCAPE '\\'",
      "LOWER(j.location_name) LIKE ? ESCAPE '\\'",
    ];
    args.push(pattern, pattern, pattern);

    if (params.includeDescriptions) {
      const terms = params.query.match(/[a-z0-9]+/g)?.slice(0, 8) ?? [];
      if (terms.length) {
        searchConditions.push(
          `(${terms
            .map(
              () =>
                "(LOWER(j.description) GLOB ? OR LOWER(j.description) GLOB ? OR LOWER(j.description) GLOB ? OR LOWER(j.description) GLOB ?)",
            )
            .join(" AND ")})`,
        );
        for (const term of terms) {
          args.push(
            `*[^a-z0-9]${term}[^a-z0-9]*`,
            `${term}[^a-z0-9]*`,
            `*[^a-z0-9]${term}`,
            term,
          );
        }
      }
    }

    conditions.push(`(${searchConditions.join(" OR ")})`);
  }
  if (params.location) {
    conditions.push("LOWER(j.location_name) LIKE ? ESCAPE '\\'");
    args.push(`%${escapeLike(params.location)}%`);
  }
  if (params.postedAfter || params.postedBefore) {
    conditions.push(
      "j.first_published IS NOT NULL AND j.first_published <> ''",
    );
  }
  if (params.postedAfter) {
    conditions.push("j.first_published >= ?");
    args.push(params.postedAfter);
  }
  if (params.postedBefore) {
    conditions.push("j.first_published < date(?, '+1 day')");
    args.push(params.postedBefore);
  }
  if (params.employment) {
    conditions.push("LOWER(j.employment_type) LIKE ? ESCAPE '\\'");
    args.push(`%${escapeLike(params.employment)}%`);
  }
  if (params.workplace) {
    conditions.push("LOWER(j.workplace_type) LIKE ? ESCAPE '\\'");
    args.push(`%${escapeLike(params.workplace)}%`);
  }

  return { where: conditions.join(" AND "), args };
}

// ── Column lists ─────────────────────────────────────────────────────
// Full row: fetched only for the 20 result rows via deferred-join
const JOB_COLUMNS = `
  j.provider, j.company_slug, j.job_id, j.title, j.company_name,
  j.location_name, j.details_url, j.apply_url,
  j.first_published, j.employment_type, j.workplace_type, j.description,
  0 AS is_bookmarked, 1 AS is_available`;

// ── Deferred-join page query (Opt 3) ─────────────────────────────────
// Step 1: scan the narrow covering index to find 20 row IDs
// Step 2: join back to fetch full rows only for those 20 IDs
function buildDeferredJoinPageQuery(
  where: string,
  orderAsc: boolean,
): string {
  const primaryOrder = orderAsc
    ? "j.first_published ASC, j.title COLLATE NOCASE DESC"
    : "j.first_published DESC, j.title COLLATE NOCASE";
  const innerOrder = orderAsc
    ? "inner_j.first_published ASC, inner_j.title COLLATE NOCASE DESC"
    : "inner_j.first_published DESC, inner_j.title COLLATE NOCASE";
  // The inner WHERE uses inner_j alias — replace j. with inner_j.
  const innerWhere = where.replace(/\bj\./g, "inner_j.");

  return `SELECT ${JOB_COLUMNS}
    FROM indexed_jobs j
    INNER JOIN (
      SELECT inner_j.provider, inner_j.company_slug, inner_j.job_id
      FROM indexed_jobs inner_j
      WHERE ${innerWhere}
      ORDER BY ${innerOrder}
      LIMIT ? OFFSET ?
    ) AS page_ids
      ON j.provider = page_ids.provider
      AND j.company_slug = page_ids.company_slug
      AND j.job_id = page_ids.job_id
    ORDER BY ${primaryOrder}`;
}

// ── Separated count cache (Opt 1) ────────────────────────────────────
// Keyed by filter params only (not page), so all prefetched pages of the
// same search share one cached count.

interface CountParams {
  cacheSchemaVersion: string;
  query: string;
  location: string;
  provider: string;
  employment: string;
  workplace: string;
  postedAfter: string;
  postedBefore: string;
  includeDescriptions: boolean;
}

function toCountParams(params: JobSearchParams): CountParams {
  return {
    cacheSchemaVersion: params.cacheSchemaVersion,
    query: params.query,
    location: params.location,
    provider: params.provider,
    employment: params.employment,
    workplace: params.workplace,
    postedAfter: params.postedAfter,
    postedBefore: params.postedBefore,
    includeDescriptions: params.includeDescriptions,
  };
}

async function executeCount(
  where: string,
  args: Array<string | number>,
): Promise<number> {
  const database = getTursoConnection();
  const [result] = await database.batch([
    {
      sql: `SELECT COUNT(*) AS total FROM indexed_jobs j WHERE ${where}`,
      args,
    },
  ]);
  return Number(result.rows?.[0]?.total ?? 0);
}

async function getCachedCount(
  _countParams: CountParams,
  where: string,
  args: Array<string | number>,
): Promise<number> {
  "use cache";
  cacheLife({ revalidate: 60, expire: 600 });
  cacheTag("jobs-count");

  return executeCount(where, args);
}

// ── Reverse scan for tail pages (Opt 5) ──────────────────────────────
// When the requested page is in the second half of total pages, scan from
// the end of the index (ascending order) with a mirrored offset, then
// reverse the result array. This makes the last page as fast as the first.

function computePageScan(
  page: number,
  pageSize: number,
  total: number,
  totalPages: number,
): { offset: number; limit: number; reverseResults: boolean } {
  const useTailScan = page > totalPages / 2 && totalPages > 1;

  if (useTailScan) {
    // Scan from the end: offset is distance from the last row
    const tailOffset = Math.max(0, total - page * pageSize);
    const tailLimit = Math.min(pageSize, total - (page - 1) * pageSize);
    return { offset: tailOffset, limit: tailLimit, reverseResults: true };
  }

  return {
    offset: (page - 1) * pageSize,
    limit: pageSize,
    reverseResults: false,
  };
}

// ── Main search execution ────────────────────────────────────────────

export async function executeJobSearch(
  params: JobSearchParams,
): Promise<JobSearchResponse> {
  const database = getTursoConnection();
  const { where, args } = buildWhere(params);

  // Get count from cache (Opt 1) — shared across all pages of the same search
  const countParams = toCountParams(params);
  const total =
    process.env.JOB_SEARCH_CACHE_MODE?.trim().toLowerCase() === "off"
      ? await executeCount(where, args)
      : await getCachedCount(countParams, where, args);

  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  const page = Math.min(params.page, totalPages);

  // Compute scan direction and offset (Opt 5)
  const scan = computePageScan(page, params.pageSize, total, totalPages);
  const useReverseOrder = scan.reverseResults;

  // Build deferred-join query (Opt 3) with appropriate sort direction
  const pageQuery = buildDeferredJoinPageQuery(where, useReverseOrder);

  const [jobsResult] = await database.batch([
    {
      sql: pageQuery,
      args: [...args, scan.limit, scan.offset],
    },
  ]);

  let jobs = toPlainJobs(jobsResult.rows as Job[]);

  // Reverse results if we used a tail scan (Opt 5)
  if (useReverseOrder) {
    jobs.reverse();
  }

  return { jobs, total, page, pageSize: params.pageSize, totalPages };
}

export async function getCachedJobSearch(
  params: JobSearchParams,
): Promise<JobSearchResponse> {
  "use cache";
  cacheLife({ revalidate: 60, expire: 600 });
  cacheTag("jobs");

  return executeJobSearch(params);
}

export async function searchJobs(
  params: JobSearchParams,
): Promise<JobSearchResponse> {
  if (process.env.JOB_SEARCH_CACHE_MODE?.trim().toLowerCase() === "off") {
    return executeJobSearch(params);
  }

  return getCachedJobSearch(params);
}
