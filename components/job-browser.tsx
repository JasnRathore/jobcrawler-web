"use client";

import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ExternalLink,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { GlassButton } from "@/components/ui/opaline/glass-button";
import {
  providers,
  type Job,
  type JobSearchResponse,
  type Provider,
} from "@/lib/jobs";

type ViewMode = "all" | "saved";

const providerLabels: Record<Provider, string> = {
  ashbyhq: "Ashby",
  greenhouse: "Greenhouse",
  lever: "Lever",
  levereu: "Lever EU",
  workable: "Workable",
};

function jobKey(job: Job): string {
  return `${job.provider}:${job.company_slug}:${job.job_id}`;
}

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function JobBrowser() {
  const [mode, setMode] = useState<ViewMode>("all");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [provider, setProvider] = useState("");
  const [employment, setEmployment] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [postedAfter, setPostedAfter] = useState("");
  const [postedBefore, setPostedBefore] = useState("");
  const [includeDescriptions, setIncludeDescriptions] = useState(false);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState<JobSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyJobs, setBusyJobs] = useState<Set<string>>(() => new Set());

  const searchParams = useMemo(() => {
    const params = new URLSearchParams({
      saved: String(mode === "saved"),
      page: String(page),
      details: String(includeDescriptions),
    });
    if (query.trim()) params.set("q", query.trim());
    if (location.trim()) params.set("location", location.trim());
    if (provider) params.set("provider", provider);
    if (employment) params.set("employment", employment);
    if (workplace) params.set("workplace", workplace);
    if (postedAfter) params.set("posted_after", postedAfter);
    if (postedBefore) params.set("posted_before", postedBefore);
    return params;
  }, [
    mode,
    page,
    query,
    location,
    provider,
    employment,
    workplace,
    postedAfter,
    postedBefore,
    includeDescriptions,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/jobs?${searchParams.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | JobSearchResponse
          | { error?: string };
        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "Jobs could not be loaded.",
          );
        }
        setResult(payload as JobSearchResponse);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Jobs could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [searchParams, refreshKey]);

  const updateFilter = useCallback((update: () => void) => {
    update();
    setPage(1);
  }, []);

  const activeFilters = [
    query.trim() && `“${query.trim()}”`,
    location.trim() && location.trim(),
    provider && providerLabels[provider as Provider],
    employment && formatLabel(employment),
    workplace && formatLabel(workplace),
    postedAfter && `After ${formatDate(postedAfter)}`,
    postedBefore && `Before ${formatDate(postedBefore)}`,
    includeDescriptions && "Description search",
  ].filter((filter): filter is string => Boolean(filter));

  const clearFilters = () => {
    setQuery("");
    setLocation("");
    setProvider("");
    setEmployment("");
    setWorkplace("");
    setPostedAfter("");
    setPostedBefore("");
    setIncludeDescriptions(false);
    setPage(1);
  };

  async function toggleBookmark(job: Job) {
    const key = jobKey(job);
    setBusyJobs((current) => new Set(current).add(key));
    setError("");
    try {
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: job.provider,
          companySlug: job.company_slug,
          jobId: job.job_id,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        saved?: boolean;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Bookmark could not be updated.");
      }
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Bookmark could not be updated.",
      );
    } finally {
      setBusyJobs((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  const jobs = result?.jobs ?? [];
  const total = result?.total ?? 0;
  const bookmarkCount = result?.bookmarkCount ?? 0;
  const totalPages = result?.totalPages ?? 1;

  return (
    <main className="min-h-screen px-4 pb-14 pt-5 sm:px-7 lg:px-10">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_6%_0%,oklch(0.88_0.09_75_/_32%),transparent_37%),radial-gradient(ellipse_at_100%_25%,oklch(0.86_0.08_35_/_18%),transparent_34%)]"
      />
      <div className="mx-auto max-w-7xl">
        <header className="sticky top-3 z-20 mb-8">
          <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/85 px-4 py-3 shadow-sm backdrop-blur-2xl sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Sparkles aria-hidden="true" className="size-4" />
              </span>
              <span className="text-sm font-bold tracking-tight">
                Crawler <span className="font-medium text-muted-foreground">/ Jobs</span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Across five job platforms
              </span>
              <GlassButton
                asChild
                size="sm"
                variant={mode === "saved" ? "prominent" : "default"}
                onClick={() => {
                  setMode((current) => (current === "all" ? "saved" : "all"));
                  setPage(1);
                }}
                aria-pressed={mode === "saved"}
                aria-label={`${mode === "saved" ? "Show all jobs" : "Show saved jobs"} (${bookmarkCount})`}
              >
                <button type="button">
                  <Bookmark aria-hidden="true" className="size-4" />
                  {mode === "saved" ? "All jobs" : "Saved"}
                  <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[11px]">
                    {bookmarkCount}
                  </span>
                </button>
              </GlassButton>
            </div>
          </div>
        </header>

        <section className="mb-8 overflow-hidden rounded-[1.75rem] border border-border/60 bg-background/75 px-5 py-7 shadow-sm backdrop-blur-xl sm:px-8 sm:py-9">
          <div className="mx-auto max-w-4xl">
            <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
              A better next step
            </p>
            <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
              Find a role that feels right.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Explore fresh openings from five trusted job platforms, all in one place.
            </p>
            <form
              className="mt-6 grid gap-3 rounded-2xl border border-border/70 bg-background p-3 shadow-sm sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] sm:items-center"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
              }}
              role="search"
              aria-label="Search jobs"
            >
              <label className="relative block min-w-0">
                <span className="sr-only">Keywords</span>
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => updateFilter(() => setQuery(event.target.value))}
                  placeholder="Job title, skill, or company"
                  className="h-11 w-full rounded-xl border-0 bg-muted/50 pl-10 pr-3 text-sm outline-none transition placeholder:text-muted-foreground/80 focus:bg-background focus:ring-2 focus:ring-ring/30"
                />
              </label>
              <label className="relative block min-w-0">
                <span className="sr-only">Location</span>
                <MapPin
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={location}
                  onChange={(event) => updateFilter(() => setLocation(event.target.value))}
                  placeholder="City, region, or remote"
                  className="h-11 w-full rounded-xl border-0 bg-muted/50 pl-10 pr-3 text-sm outline-none transition placeholder:text-muted-foreground/80 focus:bg-background focus:ring-2 focus:ring-ring/30"
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Search aria-hidden="true" className="size-4" />
                Search jobs
              </button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              Search across Greenhouse, Lever, Lever EU, Workable, and Ashby.
            </p>
          </div>
        </section>

        <section className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-7">
          <aside className="rounded-2xl border border-border/70 bg-background/75 p-4 shadow-sm backdrop-blur-xl sm:p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal aria-hidden="true" className="size-4" />
                Refine results
              </h2>
              <button
                type="button"
                disabled={activeFilters.length === 0}
                className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                onClick={clearFilters}
              >
                Clear all
              </button>
            </div>

            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
              }}
            >
              <FilterSelect
                label="Platform"
                value={provider}
                onChange={(value) =>
                  updateFilter(() => setProvider(value))
                }
                options={[
                  ["", "All platforms"],
                  ...providers.map((item) => [item, providerLabels[item]]),
                ]}
              />
              <FilterSelect
                label="Employment"
                value={employment}
                onChange={(value) =>
                  updateFilter(() => setEmployment(value))
                }
                options={[
                  ["", "Any type"],
                  ["full-time", "Full-time"],
                  ["part-time", "Part-time"],
                  ["contract", "Contract"],
                  ["internship", "Internship"],
                ]}
              />
              <FilterSelect
                label="Workplace"
                value={workplace}
                onChange={(value) =>
                  updateFilter(() => setWorkplace(value))
                }
                options={[
                  ["", "Any workplace"],
                  ["remote", "Remote"],
                  ["hybrid", "Hybrid"],
                  ["onsite", "On-site"],
                ]}
              />

              <div>
                <span className="mb-2 block text-xs font-medium text-muted-foreground">
                  Posted between
                </span>
                <div className="grid gap-2">
                  <input
                    aria-label="Posted after"
                    type="date"
                    value={postedAfter}
                    onChange={(event) =>
                      updateFilter(() => setPostedAfter(event.target.value))
                    }
                    className="h-10 min-w-0 rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                  <input
                    aria-label="Posted before"
                    type="date"
                    value={postedBefore}
                    onChange={(event) =>
                      updateFilter(() => setPostedBefore(event.target.value))
                    }
                    className="h-10 min-w-0 rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={includeDescriptions}
                  onChange={(event) =>
                    updateFilter(() =>
                      setIncludeDescriptions(event.target.checked),
                    )
                  }
                  className="mt-1 accent-primary"
                />
                Include job descriptions in keyword search
              </label>
            </form>
          </aside>

          <div className="min-w-0">
            <div className="mb-3 flex min-h-10 flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground" aria-live="polite" aria-atomic="true">
                {loading ? (
                  "Finding your next opportunity…"
                ) : (
                  <>
                    <span className="font-semibold text-foreground">
                      {total.toLocaleString()}
                    </span>{" "}
                    {total === 1 ? "role" : "roles"} {mode === "saved" ? "saved" : "to explore"}
                  </>
                )}
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowDownUp aria-hidden="true" className="size-3.5" />
                Newest first
              </span>
            </div>

            {activeFilters.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
                <span className="text-xs font-medium text-muted-foreground">Searching:</span>
                {activeFilters.map((filter) => (
                  <span
                    key={filter}
                    className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground"
                  >
                    {filter}
                  </span>
                ))}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              >
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setRefreshKey((current) => current + 1)}
                  className="font-semibold underline underline-offset-4"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="space-y-3" aria-busy={loading}>
              {jobs.map((job) => {
                const key = jobKey(job);
                const isSaved = Number(job.is_bookmarked) === 1;
                const primaryUrl = job.apply_url || job.details_url;
                return (
                  <article
                    key={key}
                    className="group rounded-2xl border border-border/70 bg-background/85 p-5 shadow-sm backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-semibold text-primary">
                            {providerLabels[job.provider]}
                          </span>
                          {Number(job.is_available) !== 1 && (
                            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                              No longer listed
                            </span>
                          )}
                        </div>
                        <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
                          {job.title || "Untitled role"}
                        </h2>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Building2 aria-hidden="true" className="size-3.5" />
                          {job.company_name || job.company_slug}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          aria-label={isSaved ? "Remove saved job" : "Save job"}
                          aria-pressed={isSaved}
                          disabled={busyJobs.has(key)}
                          onClick={() => void toggleBookmark(job)}
                          className={`flex size-10 items-center justify-center rounded-xl border transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50 ${
                            isSaved
                              ? "border-primary/20 bg-primary/8 text-primary"
                              : "bg-background text-muted-foreground"
                          }`}
                        >
                          {isSaved ? (
                            <Check aria-hidden="true" className="size-4" />
                          ) : (
                            <Bookmark aria-hidden="true" className="size-4" />
                          )}
                        </button>
                        {primaryUrl && (
                          <a
                            href={primaryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            {job.apply_url ? "Apply" : "View role"}
                            <ExternalLink aria-hidden="true" className="size-3.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                      {job.location_name && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin aria-hidden="true" className="size-3.5" />
                          {job.location_name}
                        </span>
                      )}
                      {job.employment_type && (
                        <span className="inline-flex items-center gap-1.5">
                          <BriefcaseBusiness
                            aria-hidden="true"
                            className="size-3.5"
                          />
                          {job.employment_type}
                        </span>
                      )}
                      {job.workplace_type && (
                        <span>{formatLabel(job.workplace_type)}</span>
                      )}
                      {job.first_published && (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays aria-hidden="true" className="size-3.5" />
                          Posted {formatDate(job.first_published)}
                        </span>
                      )}
                    </div>

                    {(job.department || job.experience || job.education) && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {[job.department, job.experience, job.education]
                          .filter(Boolean)
                          .map((item) => (
                            <span
                              key={item}
                              className="rounded-lg border bg-background px-2.5 py-1 text-[11px] text-muted-foreground"
                            >
                              {item}
                            </span>
                          ))}
                      </div>
                    )}

                    {job.description && (
                      <details className="mt-4 border-t pt-3">
                        <summary className="w-fit cursor-pointer rounded-md text-xs font-medium text-muted-foreground marker:text-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          Read job description
                        </summary>
                        <p className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {job.description}
                        </p>
                      </details>
                    )}
                  </article>
                );
              })}

              {!loading && !error && jobs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-background/65 px-6 py-14 text-center sm:py-16">
                  <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted">
                    <Search
                      aria-hidden="true"
                      className="size-5 text-muted-foreground"
                    />
                  </span>
                  <h2 className="font-semibold">
                    {mode === "saved" ? "No saved roles yet" : "No roles found"}
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    {mode === "saved"
                      ? "Save a role from your search and it will be waiting here."
                      : "Try another keyword or loosen a filter to see more results."}
                  </p>
                  {mode === "all" && activeFilters.length > 0 && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-5 inline-flex h-10 items-center justify-center rounded-xl border bg-background px-4 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}

              {loading && jobs.length === 0 && (
                <div className="space-y-3" aria-hidden="true">
                  {[0, 1, 2].map((item) => (
                    <div
                      key={item}
                      className="h-44 animate-pulse rounded-2xl border border-border/70 bg-background/65"
                    />
                  ))}
                </div>
              )}
            </div>

            {jobs.length > 0 && (
              <nav
                aria-label="Job results pages"
                className="mt-6 flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-background/75 px-2 py-2 backdrop-blur sm:px-4 sm:py-3"
              >
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Previous
                </button>
                <span className="text-xs text-muted-foreground">
                  Page {result?.page ?? page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ArrowRight aria-hidden="true" className="size-4" />
                </button>
              </nav>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
