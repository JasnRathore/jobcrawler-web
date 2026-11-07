import { NextResponse, type NextRequest } from "next/server";

import { providers, type Job } from "@/lib/jobs";
import { getTursoConnection } from "@/lib/turso";

const pageSize = 20;
const validDate = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
  if (!validDate.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function dateParam(value: string | null, name: string): string | null {
  if (!value) return "";
  if (!isValidDate(value)) throw new Error(`Invalid ${name} date.`);
  return value;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 200);
  const location = (params.get("location") ?? "").trim().slice(0, 120);
  const employment = (params.get("employment") ?? "").trim().slice(0, 80);
  const workplace = (params.get("workplace") ?? "").trim().slice(0, 80);
  const provider = params.get("provider") ?? "";
  const includeDescriptions = params.get("details") === "true";
  const pageInput = Number.parseInt(params.get("page") ?? "1", 10);
  const requestedPage = Number.isFinite(pageInput)
    ? Math.max(1, Math.min(pageInput, 1_000_000))
    : 1;

  if (provider && !providers.includes(provider as (typeof providers)[number])) {
    return NextResponse.json({ error: "Unknown job provider." }, { status: 400 });
  }

  let postedAfter: string;
  let postedBefore: string;
  try {
    postedAfter = dateParam(params.get("posted_after"), "start") ?? "";
    postedBefore = dateParam(params.get("posted_before"), "end") ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid date filter.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const conditions = ["1 = 1"];
  const args: Array<string | number> = [];

  if (provider) {
    conditions.push("j.provider = ?");
    args.push(provider);
  }
  if (query) {
    const pattern = `%${query.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
    const searchConditions = [
      "LOWER(j.title) LIKE ? ESCAPE '\\'",
      "LOWER(j.company_name) LIKE ? ESCAPE '\\'",
      "LOWER(j.location_name) LIKE ? ESCAPE '\\'",
    ];
    args.push(pattern, pattern, pattern);

    if (includeDescriptions) {
      const terms = query.toLowerCase().match(/[a-z0-9]+/g)?.slice(0, 8) ?? [];
      if (terms.length) {
        searchConditions.push(
          `(${terms
            .map(() => "(LOWER(j.description) GLOB ? OR LOWER(j.description) GLOB ? OR LOWER(j.description) GLOB ? OR LOWER(j.description) GLOB ?)")
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
  if (location) {
    conditions.push("LOWER(j.location_name) LIKE ? ESCAPE '\\'");
    args.push(`%${location.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`);
  }
  if (postedAfter || postedBefore) {
    conditions.push(
      "j.first_published IS NOT NULL AND j.first_published <> ''",
    );
  }
  if (postedAfter) {
    conditions.push("j.first_published >= ?");
    args.push(postedAfter);
  }
  if (postedBefore) {
    conditions.push("j.first_published < date(?, '+1 day')");
    args.push(postedBefore);
  }
  if (employment) {
    conditions.push("LOWER(j.employment_type) LIKE ? ESCAPE '\\'");
    args.push(`%${employment.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`);
  }
  if (workplace) {
    conditions.push("LOWER(j.workplace_type) LIKE ? ESCAPE '\\'");
    args.push(`%${workplace.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`);
  }

  const where = conditions.join(" AND ");

  try {
    const database = getTursoConnection();
    const requestedOffset = (requestedPage - 1) * pageSize;
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
        args: [...args, pageSize, requestedOffset],
      },
    ]);

    const total = Number(countResult.rows?.[0]?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const offset = (page - 1) * pageSize;

    let jobs = jobsResult.rows as Job[];
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
        pageSize,
        offset,
      );
      jobs = pagedResult as Job[];
    }

    return NextResponse.json(
      {
        jobs,
        total,
        page,
        pageSize,
        totalPages,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not load jobs from Turso:", error);
    return NextResponse.json(
      { error: "Jobs could not be loaded. Check the Turso connection and try again." },
      { status: 500 },
    );
  }
}
