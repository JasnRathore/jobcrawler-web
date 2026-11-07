import { NextResponse, type NextRequest } from "next/server";

import { parseJobSearchParams } from "@/lib/job-search-params";
import { searchJobs } from "@/lib/job-search";

export async function GET(request: NextRequest) {
  const parsed = parseJobSearchParams(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await searchJobs(parsed.params);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Could not load jobs from Turso:", error);
    return NextResponse.json(
      { error: "Jobs could not be loaded. Check the Turso connection and try again." },
      { status: 500 },
    );
  }
}
