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
  updated_at: string;
  first_published: string;
  employment_type: string;
  workplace_type: string;
  department: string;
  education: string;
  experience: string;
  description: string;
  attributes_json: string;
  is_bookmarked: number;
  is_available: number;
}

export interface JobSearchResponse {
  jobs: Job[];
  total: number;
  page: number;
  totalPages: number;
  bookmarkCount: number;
}
