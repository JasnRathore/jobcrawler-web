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

function buildWhere(params: JobSearchParams): {
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

export async function executeJobSearch(
  params: JobSearchParams,
): Promise<JobSearchResponse> {
  const database = getTursoConnection();
  const { where, args } = buildWhere(params);
  const requestedOffset = (params.page - 1) * params.pageSize;
  const [countResult, jobsResult] = await database.batch([
    {
      sql: `SELECT COUNT(*) AS total FROM indexed_jobs j WHERE ${where}`,
      args,
    },
    {
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
    },
  ]);

  const total = Number(countResult.rows?.[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  const page = Math.min(params.page, totalPages);
  const offset = (page - 1) * params.pageSize;

  let jobs = toPlainJobs(jobsResult.rows as Job[]);
  if (offset !== requestedOffset) {
    const pagedResult = await database.all(
      `SELECT
        j.provider, j.company_slug, j.job_id, j.title, j.company_name,
        j.location_name, j.details_url, j.apply_url,
        j.first_published, j.employment_type, j.workplace_type, j.description,
        0 AS is_bookmarked, 1 AS is_available
      FROM indexed_jobs j
      WHERE ${where}
      ORDER BY j.first_published DESC, j.title COLLATE NOCASE
      LIMIT ? OFFSET ?`,
      ...args,
      params.pageSize,
      offset,
    );
    jobs = toPlainJobs(pagedResult as Job[]);
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
