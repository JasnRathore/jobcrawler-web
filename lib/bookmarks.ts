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
    typeof bookmark.company_slug === "string" &&
    bookmark.company_slug.length > 0 &&
    typeof bookmark.job_id === "string" &&
    bookmark.job_id.length > 0 &&
    (bookmark.is_bookmarked === 0 || bookmark.is_bookmarked === 1) &&
    (bookmark.is_available === 0 || bookmark.is_available === 1)
  );
}

function validateBookmarks(bookmarks: unknown): bookmarks is Job[] {
  if (!Array.isArray(bookmarks) || !bookmarks.every(isBookmark)) return false;

  const keys = new Set(bookmarks.map(bookmarkKey));
  return keys.size === bookmarks.length;
}

export function readBookmarks(): Job[] {
  const storedBookmarks = window.localStorage.getItem(storageKey);
  if (storedBookmarks === null) return [];

  const parsed: unknown = JSON.parse(storedBookmarks);
  if (!validateBookmarks(parsed)) {
    throw new Error("Saved roles in this browser have an invalid format.");
  }
  return parsed;
}

export function writeBookmarks(bookmarks: Job[]): void {
  if (!validateBookmarks(bookmarks)) {
    throw new Error("Saved roles in this browser have an invalid format.");
  }
  window.localStorage.setItem(storageKey, JSON.stringify(bookmarks));
}

export function clearBookmarks(): void {
  window.localStorage.removeItem(storageKey);
}
