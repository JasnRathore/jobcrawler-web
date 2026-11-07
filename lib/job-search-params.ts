import { providers, type Provider } from "./jobs.ts";

export const jobSearchCacheSchemaVersion = "jobs-v1";
export const jobSearchPageSize = 20;

export interface JobSearchParams {
  cacheSchemaVersion: string;
  query: string;
  location: string;
  provider: Provider | "";
  employment: string;
  workplace: string;
  postedAfter: string;
  postedBefore: string;
  includeDescriptions: boolean;
  page: number;
  pageSize: number;
}

export type ParsedJobSearchParams =
  | { ok: true; params: JobSearchParams }
  | { ok: false; error: string };

const validDate = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
  if (!validDate.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function dateParam(value: string | null): string | null {
  if (!value) return "";
  if (!isValidDate(value)) return null;
  return value;
}

export function parseJobSearchParams(
  searchParams: URLSearchParams,
): ParsedJobSearchParams {
  const providerInput = searchParams.get("provider") ?? "";
  if (
    providerInput &&
    !providers.includes(providerInput as Provider)
  ) {
    return { ok: false, error: "Unknown job provider." };
  }

  const postedAfter = dateParam(searchParams.get("posted_after"));
  if (postedAfter === null) {
    return { ok: false, error: "Invalid start date." };
  }

  const postedBefore = dateParam(searchParams.get("posted_before"));
  if (postedBefore === null) {
    return { ok: false, error: "Invalid end date." };
  }

  const pageInput = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageInput)
    ? Math.max(1, Math.min(pageInput, 1_000_000))
    : 1;

  return {
    ok: true,
    params: {
      cacheSchemaVersion: jobSearchCacheSchemaVersion,
      query: (searchParams.get("q") ?? "").trim().slice(0, 200).toLowerCase(),
      location: (searchParams.get("location") ?? "")
        .trim()
        .slice(0, 120)
        .toLowerCase(),
      provider: providerInput as Provider | "",
      employment: (searchParams.get("employment") ?? "")
        .trim()
        .slice(0, 80)
        .toLowerCase(),
      workplace: (searchParams.get("workplace") ?? "")
        .trim()
        .slice(0, 80)
        .toLowerCase(),
      postedAfter,
      postedBefore,
      includeDescriptions: searchParams.get("details") === "true",
      page,
      pageSize: jobSearchPageSize,
    },
  };
}
