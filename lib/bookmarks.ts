import { providers, type Job } from "@/lib/jobs";

const storageKey = "jobcrawler.bookmarks.v1";

export function bookmarkKey(job: Pick<Job, "provider" | "company_slug" | "job_id">): string {
  return `${job.provider}:${job.company_slug}:${job.job_id}`;
}

function isBookmark(value: unknown): value is Job {
  if (!value || typeof value !== "object") return false;

  const bookmark = value as Record<string, unknown>;
  const stringFields = [
    "company_slug",
    "job_id",
    "title",
    "company_name",
    "location_name",
    "details_url",
    "apply_url",
    "updated_at",
    "first_published",
    "employment_type",
    "workplace_type",
    "department",
    "education",
    "experience",
    "description",
    "attributes_json",
  ];

  return (
    typeof bookmark.provider === "string" &&
    providers.some((provider) => provider === bookmark.provider) &&
    stringFields.every((field) => typeof bookmark[field] === "string") &&
    typeof bookmark.is_bookmarked === "number" &&
    typeof bookmark.is_available === "number"
  );
}

export function readBookmarks(): Job[] {
  const storedBookmarks = window.localStorage.getItem(storageKey);
  if (!storedBookmarks) return [];

  const parsed: unknown = JSON.parse(storedBookmarks);
  if (!Array.isArray(parsed) || !parsed.every(isBookmark)) {
    throw new Error("Saved roles in this browser have an invalid format.");
  }
  return parsed;
}

export function writeBookmarks(bookmarks: Job[]): void {
  window.localStorage.setItem(storageKey, JSON.stringify(bookmarks));
}
