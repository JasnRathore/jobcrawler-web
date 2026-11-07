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
