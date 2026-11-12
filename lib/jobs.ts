export const providers = [
  "ashbyhq",
  "greenhouse",
  "lever",
  "levereu",
  "workable",
] as const;

export type Provider = (typeof providers)[number];

export interface Job {
  provider: Provider;
  company_slug: string;
  job_id: string;
  title: string;
  company_name: string;
  location_name: string;
  details_url: string;
  apply_url: string;
  first_published: string;
  employment_type: string;
  workplace_type: string;
  description: string;
  is_bookmarked: number;
  is_available: number;
}

export interface JobSearchResponse {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function isJob(value: unknown): value is Job {
  if (!isRecord(value)) return false;

  return (
    providers.some((provider) => provider === value.provider) &&
    typeof value.company_slug === "string" &&
    typeof value.job_id === "string" &&
    typeof value.title === "string" &&
    typeof value.company_name === "string" &&
    typeof value.location_name === "string" &&
    typeof value.details_url === "string" &&
    typeof value.apply_url === "string" &&
    typeof value.first_published === "string" &&
    typeof value.employment_type === "string" &&
    typeof value.workplace_type === "string" &&
    typeof value.description === "string" &&
    isNonNegativeInteger(value.is_bookmarked) &&
    isNonNegativeInteger(value.is_available)
  );
}

export function isJobSearchResponse(
  value: unknown,
): value is JobSearchResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.jobs) &&
    value.jobs.every(isJob) &&
    isNonNegativeInteger(value.total) &&
    isPositiveInteger(value.page) &&
    isPositiveInteger(value.pageSize) &&
    isNonNegativeInteger(value.totalPages)
  );
}
