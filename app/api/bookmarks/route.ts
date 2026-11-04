import { NextResponse } from "next/server";

import { providers, type Provider } from "@/lib/jobs";
import { getTursoConnection } from "@/lib/turso";

interface BookmarkRequest {
  provider?: unknown;
  companySlug?: unknown;
  jobId?: unknown;
}

export async function POST(request: Request) {
  let body: BookmarkRequest;
  try {
    body = (await request.json()) as BookmarkRequest;
  } catch {
    return NextResponse.json({ error: "Expected a JSON request body." }, { status: 400 });
  }

  const { provider, companySlug, jobId } = body;
  if (
    typeof provider !== "string" ||
    !providers.includes(provider as Provider) ||
    typeof companySlug !== "string" ||
    !companySlug.trim() ||
    companySlug.length > 200 ||
    typeof jobId !== "string" ||
    !jobId.trim() ||
    jobId.length > 200
  ) {
    return NextResponse.json({ error: "Invalid bookmark details." }, { status: 400 });
  }

  try {
    const database = getTursoConnection();
    const toggle = database.transactionAsync(async (transaction) => {
      const existing = await transaction.get(
        `SELECT 1 AS saved
        FROM indexed_bookmarks
        WHERE provider = ? AND company_slug = ? AND job_id = ?`,
        provider,
        companySlug.trim(),
        jobId.trim(),
      );
      if (existing) {
        await transaction.run(
          `DELETE FROM indexed_bookmarks
          WHERE provider = ? AND company_slug = ? AND job_id = ?`,
          provider,
          companySlug.trim(),
          jobId.trim(),
        );
        return false;
      }

      const result = await transaction.run(
        `INSERT INTO indexed_bookmarks (
          provider, company_slug, job_id, title, company_name, location_name,
          location_json, details_url, apply_url, updated_at, first_published,
          employment_type, workplace_type, department, education, experience,
          description, attributes_json, is_available
        )
        SELECT provider, company_slug, job_id, title, company_name, location_name,
          location_json, details_url, apply_url, updated_at, first_published,
          employment_type, workplace_type, department, education, experience,
          description, attributes_json, 1
        FROM indexed_jobs
        WHERE provider = ? AND company_slug = ? AND job_id = ?`,
        provider,
        companySlug.trim(),
        jobId.trim(),
      );
      if (Number(result?.rowsAffected ?? 0) === 0) {
        throw new Error("The job is no longer available to save.");
      }
      return true;
    });

    const saved = await toggle.immediate();
    const count = await database.get(
      "SELECT COUNT(*) AS total FROM indexed_bookmarks",
    );
    return NextResponse.json({
      saved,
      bookmarkCount: Number(count?.total ?? 0),
    });
  } catch (error) {
    console.error("Could not update Turso bookmark:", error);
    const message =
      error instanceof Error && error.message === "The job is no longer available to save."
        ? error.message
        : "Bookmark could not be updated. Try again.";
    return NextResponse.json(
      { error: message },
      { status: message.startsWith("The job") ? 404 : 500 },
    );
  }
}
