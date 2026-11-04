"use client";

import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import {
  providers,
  type Job,
  type JobSearchResponse,
  type Provider,
} from "@/lib/jobs";

type ViewMode = "all" | "saved";
type FilterId =
  | "query"
  | "location"
  | "provider"
  | "employment"
  | "workplace"
  | "postedAfter"
  | "postedBefore"
  | "includeDescriptions";

const providerLabels: Record<Provider, string> = {
  ashbyhq: "Ashby",
  greenhouse: "Greenhouse",
  lever: "Lever",
  levereu: "Lever EU",
  workable: "Workable",
};

const providerBadgeStyles: Record<Provider, string> = {
  ashbyhq: "border-purple-500/20 bg-purple-500/10 text-purple-400 dark:text-purple-300",
  greenhouse: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 dark:text-emerald-300",
  lever: "border-blue-500/20 bg-blue-500/10 text-blue-400 dark:text-blue-300",
  levereu: "border-sky-500/20 bg-sky-500/10 text-sky-400 dark:text-sky-300",
  workable: "border-amber-500/20 bg-amber-500/10 text-amber-400 dark:text-amber-300",
};

const employmentOptions = [
  { value: "", label: "Any type" },
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

const workplaceOptions = [
  { value: "", label: "Any workplace" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

function jobKey(job: Job): string {
  return `${job.provider}:${job.company_slug}:${job.job_id}`;
}

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value,
  );
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
  const [showFilters, setShowFilters] = useState(false);
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
    const requestedPage = Number(searchParams.get("page") ?? "1");
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
        const jobResult = payload as JobSearchResponse;
        setResult(jobResult);
        if (jobResult.page !== requestedPage) {
          setPage(jobResult.page);
        }
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

  const activeFilters: { id: FilterId; label: string }[] = [];
  if (query.trim()) activeFilters.push({ id: "query", label: `“${query.trim()}”` });
  if (location.trim()) activeFilters.push({ id: "location", label: location.trim() });
  if (provider) {
    activeFilters.push({
      id: "provider",
      label: providerLabels[provider as Provider],
    });
  }
  if (employment) {
    activeFilters.push({ id: "employment", label: formatLabel(employment) });
  }
  if (workplace) {
    activeFilters.push({ id: "workplace", label: formatLabel(workplace) });
  }
  if (postedAfter) {
    activeFilters.push({ id: "postedAfter", label: `After ${formatDate(postedAfter)}` });
  }
  if (postedBefore) {
    activeFilters.push({ id: "postedBefore", label: `Before ${formatDate(postedBefore)}` });
  }
  if (includeDescriptions) {
    activeFilters.push({ id: "includeDescriptions", label: "Description search" });
  }

  const removeFilter = (id: FilterId) => {
    const updates: Record<FilterId, () => void> = {
      query: () => setQuery(""),
      location: () => setLocation(""),
      provider: () => setProvider(""),
      employment: () => setEmployment(""),
      workplace: () => setWorkplace(""),
      postedAfter: () => setPostedAfter(""),
      postedBefore: () => setPostedBefore(""),
      includeDescriptions: () => setIncludeDescriptions(false),
    };
    updateFilter(updates[id]);
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
  const pageSize = result?.pageSize ?? 20;
  const bookmarkCount = result?.bookmarkCount ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const firstResult = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = Math.min((page - 1) * pageSize + jobs.length, total);

  const filterPanel = (closeControl?: ReactNode, title?: ReactNode) => (
    <div className="rounded-lg border border-border/80 bg-card p-4 sm:p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        {title ?? (
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal aria-hidden="true" className="size-4 text-primary" />
            Refine search
          </h2>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={activeFilters.length === 0}
            className="inline-flex min-h-10 items-center rounded-md px-2 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            onClick={clearFilters}
          >
            Clear
          </button>
          {closeControl}
        </div>
      </div>

      <div className="space-y-5">
        <FilterSelect
          label="Platform"
          value={provider}
          onChange={(value) => updateFilter(() => setProvider(value))}
          options={[
            { value: "", label: "All platforms" },
            ...providers.map((item) => ({
              value: item,
              label: providerLabels[item],
            })),
          ]}
        />
        <FilterSelect
          label="Employment"
          value={employment}
          onChange={(value) => updateFilter(() => setEmployment(value))}
          options={employmentOptions}
        />
        <FilterSelect
          label="Workplace"
          value={workplace}
          onChange={(value) => updateFilter(() => setWorkplace(value))}
          options={workplaceOptions}
        />

        <fieldset>
          <legend className="mb-2 block text-xs font-medium text-muted-foreground">
            Posted between
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <label className="min-w-0">
              <span className="sr-only">Posted after</span>
              <input
                aria-label="Posted after"
                type="date"
                value={postedAfter}
                onChange={(event) =>
                  updateFilter(() => setPostedAfter(event.target.value))
                }
                className="h-10 w-full min-w-0 rounded-md border border-input/60 bg-input/40 px-2 text-xs font-medium text-foreground outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label className="min-w-0">
              <span className="sr-only">Posted before</span>
              <input
                aria-label="Posted before"
                type="date"
                value={postedBefore}
                onChange={(event) =>
                  updateFilter(() => setPostedBefore(event.target.value))
                }
                className="h-10 w-full min-w-0 rounded-md border border-input/60 bg-input/40 px-2 text-xs font-medium text-foreground outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>
        </fieldset>

        <label className="flex min-h-10 cursor-pointer items-start gap-2.5 border-t border-border/70 pt-4 text-xs leading-5 text-muted-foreground">
          <input
            type="checkbox"
            checked={includeDescriptions}
            onChange={(event) =>
              updateFilter(() => setIncludeDescriptions(event.target.checked))
            }
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          Search inside job descriptions
        </label>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#results"
        className="sr-only z-50 rounded-md border bg-background px-3 py-2 text-sm shadow-md focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to job results
      </a>

      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-3 sm:gap-5 sm:px-7 lg:px-10">
          <nav aria-label="Job views" className="flex h-full items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setMode("all");
                setPage(1);
              }}
              aria-pressed={mode === "all"}
              className={`relative inline-flex h-full items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${
                mode === "all"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Explore
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("saved");
                setPage(1);
              }}
              aria-pressed={mode === "saved"}
              className={`relative inline-flex h-full items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${
                mode === "saved"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Saved
              {bookmarkCount > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums transition-colors ${
                  mode === "saved"
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {bookmarkCount}
                </span>
              )}
            </button>
          </nav>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-5 sm:px-7 sm:pt-10 lg:px-10">
        <Dialog.Root open={showFilters} onOpenChange={setShowFilters}>
        <h1 className="sr-only">
          {mode === "saved" ? "Saved roles" : "Search roles"}
        </h1>

        <form
          className="grid gap-2 rounded-lg border border-border/80 bg-card p-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.24)] sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto] sm:items-center sm:p-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setRefreshKey((current) => current + 1);
          }}
          role="search"
          aria-label="Search jobs"
        >
          <label className="relative block min-w-0">
            <span className="sr-only">Keywords</span>
            <Search
              aria-hidden="true"
              className="absolute left-4 top-1/2 size-[17px] -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => updateFilter(() => setQuery(event.target.value))}
              placeholder="Role, skill, or company"
              className="h-11 w-full rounded-md border border-input/60 bg-input/40 pl-11 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20 sm:h-12"
            />
          </label>
          <label className="relative block min-w-0">
            <span className="sr-only">Location</span>
            <MapPin
              aria-hidden="true"
              className="absolute left-4 top-1/2 size-[17px] -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={location}
              onChange={(event) => updateFilter(() => setLocation(event.target.value))}
              placeholder="City, country, or remote"
              className="h-11 w-full rounded-md border border-input/60 bg-input/40 pl-11 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20 sm:h-12"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:h-12"
          >
            <Search aria-hidden="true" className="size-4" />
            Search roles
          </button>
        </form>

        <div className="mb-3 mt-4 flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/70 pb-2 sm:mb-4 sm:mt-7 sm:pb-4">
          <p className="text-sm text-muted-foreground" aria-live="polite" aria-atomic="true">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                Updating results
              </span>
            ) : (
              <>
                <span className="font-semibold tabular-nums text-foreground">
                  {total.toLocaleString()}
                </span>{" "}
                {total === 1 ? "open role" : "open roles"}
                {jobs.length > 0 && (
                  <span className="ml-2 text-muted-foreground/80">
                    · Showing {firstResult}–{lastResult}
                  </span>
                )}
              </>
            )}
          </p>

          <div className="flex items-center gap-3">
            <Dialog.Trigger
              aria-controls="job-filters"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border/80 bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted lg:hidden"
            >
              <SlidersHorizontal aria-hidden="true" className="size-3.5" />
              Filters
              {activeFilters.length > 0 && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                  {activeFilters.length}
                </span>
              )}
            </Dialog.Trigger>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowDownUp aria-hidden="true" className="size-3.5" />
              Newest first
            </span>
          </div>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-8">
          <aside
            id="job-filters"
            aria-label="Job filters"
            className="hidden min-w-0 lg:sticky lg:top-20 lg:block"
          >
            {filterPanel()}
          </aside>

          <section
            id="results"
            tabIndex={-1}
            aria-label="Job results"
            aria-busy={loading}
            className="min-w-0"
          >
            {activeFilters.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
                <span className="mr-1 text-xs text-muted-foreground">Filtered by</span>
                {activeFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => removeFilter(filter.id)}
                    aria-label={`Remove ${filter.label} filter`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-2.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
                  >
                    {filter.label}
                    <X aria-hidden="true" className="size-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              >
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setRefreshKey((current) => current + 1)}
                  className="font-semibold underline underline-offset-4"
                >
                  Try again
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
                    className="group relative rounded-lg border border-border/70 bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:bg-card/90 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.35)] sm:p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${providerBadgeStyles[job.provider] || "border-border bg-muted text-muted-foreground"}`}>
                            {providerLabels[job.provider]}
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground/90">
                            <Building2 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">
                              {job.company_name || job.company_slug}
                            </span>
                          </span>
                          {Number(job.is_available) !== 1 && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              No longer listed
                            </span>
                          )}
                        </div>

                        <h2 className="text-[17px] font-semibold leading-snug tracking-[-0.02em] text-foreground group-hover:text-primary transition-colors sm:text-[18px]">
                          {job.title || "Untitled role"}
                        </h2>

                        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
                          {job.location_name && (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin aria-hidden="true" className="size-3.5 text-muted-foreground/80" />
                              {job.location_name}
                            </span>
                          )}
                          {job.employment_type && (
                            <span className="inline-flex items-center gap-1.5">
                              <BriefcaseBusiness aria-hidden="true" className="size-3.5 text-muted-foreground/80" />
                              {job.employment_type}
                            </span>
                          )}
                          {job.workplace_type && (
                            <span className="inline-flex items-center rounded bg-secondary/80 px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
                              {formatLabel(job.workplace_type)}
                            </span>
                          )}
                          {job.first_published && (
                            <span className="inline-flex items-center gap-1.5 tabular-nums">
                              <CalendarDays aria-hidden="true" className="size-3.5 text-muted-foreground/80" />
                              {formatDate(job.first_published)}
                            </span>
                          )}
                        </div>

                        {(job.department || job.experience || job.education) && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {[job.department, job.experience, job.education]
                              .filter(Boolean)
                              .map((item) => (
                                <span
                                  key={item}
                                  className="rounded-md border border-border/70 bg-secondary/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                                >
                                  {item}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>

                      <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:pt-0.5">
                        <button
                          type="button"
                          aria-label={`${isSaved ? "Remove saved role" : "Save role"}: ${job.title || "Untitled role"}`}
                          aria-pressed={isSaved}
                          disabled={busyJobs.has(key)}
                          onClick={() => void toggleBookmark(job)}
                          className={`inline-flex size-10 shrink-0 items-center justify-center rounded-md border transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50 ${
                            isSaved
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-border/70 bg-card text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Bookmark
                            aria-hidden="true"
                            className={`size-4 ${isSaved ? "fill-primary" : ""}`}
                          />
                        </button>
                        {primaryUrl && (
                          <a
                            href={primaryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:flex-none"
                          >
                            {job.apply_url ? "Apply" : "View role"}
                            <ExternalLink aria-hidden="true" className="size-3.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    {job.description && (
                      <details className="group/description mt-3 border-t border-border/70 pt-1">
                        <summary className="flex min-h-8 w-fit cursor-pointer list-none items-center gap-1.5 rounded text-xs font-medium text-muted-foreground marker:hidden hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                          Job description
                          <ChevronDown
                            aria-hidden="true"
                            className="size-3.5 transition-transform group-open/description:rotate-180"
                          />
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {job.description}
                        </p>
                      </details>
                    )}
                  </article>
                );
              })}

              {!loading && !error && jobs.length === 0 && (
                <div className="px-6 py-14 text-center sm:py-16">
                  <span className="mx-auto mb-4 flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {mode === "saved" ? (
                      <Bookmark aria-hidden="true" className="size-4" />
                    ) : (
                      <Search aria-hidden="true" className="size-4" />
                    )}
                  </span>
                  <h2 className="text-sm font-semibold">
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
                      className="mt-4 inline-flex h-10 items-center justify-center rounded-md border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}

              {loading && jobs.length === 0 && (
                <div className="space-y-3" aria-hidden="true">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="min-h-56 space-y-4 rounded-lg border border-border/80 bg-card px-4 py-5 sm:px-5">
                      <div className="h-3 w-36 animate-pulse rounded bg-muted" />
                      <div className="h-5 w-3/5 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
                      <div className="h-10 w-28 animate-pulse rounded-md bg-muted" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {jobs.length > 0 && (
              <nav
                aria-label="Job results pages"
                className="mt-4 flex items-center justify-between gap-2"
              >
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="inline-flex h-10 items-center gap-2 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft aria-hidden="true" className="size-3.5" />
                  Previous
                </button>
                <span className="text-xs tabular-nums text-muted-foreground">
                  Page {result?.page ?? page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </button>
              </nav>
            )}
          </section>
        </div>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[2px] lg:hidden" />
          <Dialog.Viewport className="fixed inset-0 z-50 flex items-end lg:hidden">
            <Dialog.Popup
              aria-label="Refine job search"
              className="w-full max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-t-2xl border border-border/80 bg-background p-3 shadow-[0_-16px_48px_color-mix(in_oklch,var(--foreground)_16%,transparent)] outline-none sm:mx-auto sm:max-w-xl sm:rounded-2xl"
            >
              {filterPanel(
                <Dialog.Close
                  type="button"
                  className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Done
                  <X aria-hidden="true" className="size-3.5" />
                </Dialog.Close>,
                <Dialog.Title className="flex items-center gap-2 text-sm font-semibold">
                  <SlidersHorizontal aria-hidden="true" className="size-4 text-primary" />
                  Refine search
                </Dialog.Title>,
              )}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
        </Dialog.Root>
      </main>
    </div>
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
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-md border border-input/60 bg-input/40 pl-3 pr-9 text-xs font-medium text-foreground outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
      </span>
    </label>
  );
}
