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
import { useCallback, useEffect, useMemo, useState } from "react";

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



  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-foreground">
      <a
        href="#results"
        className="sr-only z-50 rounded-xl border bg-background px-4 py-2 text-sm shadow-lg focus:not-sr-only focus:fixed focus:left-6 focus:top-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to job results
      </a>

      {/* Main Apple/Ive floating workspace layout */}
      <div className="mx-auto flex min-h-screen max-w-[1520px] flex-col p-3 sm:p-5 lg:flex-row lg:gap-6 lg:p-8">
        
        {/* Left Sidebar Navigation & Controls */}
        <aside className="mb-4 flex w-full shrink-0 flex-col justify-between rounded-2xl border border-border/60 bg-card/70 p-5 backdrop-blur-xl lg:mb-0 lg:w-72 lg:rounded-3xl lg:p-7">
          <div className="space-y-6">
            {/* Top header navigation */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground/80">
                Job Search
              </span>
              <ThemeToggle />
            </div>

            {/* View switcher */}
            <nav aria-label="Job views" className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setMode("all");
                  setPage(1);
                }}
                aria-pressed={mode === "all"}
                className={`flex h-11 items-center justify-between rounded-xl px-3.5 text-sm font-medium transition-all ${
                  mode === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <BriefcaseBusiness aria-hidden="true" className="size-4" />
                  Explore roles
                </span>
                <span className="text-xs opacity-75 tabular-nums">
                  {total > 0 ? total.toLocaleString() : ""}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("saved");
                  setPage(1);
                }}
                aria-pressed={mode === "saved"}
                className={`flex h-11 items-center justify-between rounded-xl px-3.5 text-sm font-medium transition-all ${
                  mode === "saved"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Bookmark aria-hidden="true" className="size-4" />
                  Saved roles
                </span>
                {bookmarkCount > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                    mode === "saved"
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}>
                    {bookmarkCount}
                  </span>
                )}
              </button>
            </nav>

            {/* Desktop Filters section in sidebar */}
            <div className="hidden lg:block lg:border-t lg:border-border/60 lg:pt-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                  <SlidersHorizontal aria-hidden="true" className="size-3.5 text-primary" />
                  Filter Search
                </span>
                {activeFilters.length > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="space-y-4">
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

                <fieldset className="space-y-1.5">
                  <legend className="block text-xs font-medium text-muted-foreground">
                    Posted between
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      aria-label="Posted after"
                      type="date"
                      value={postedAfter}
                      onChange={(event) =>
                        updateFilter(() => setPostedAfter(event.target.value))
                      }
                      className="h-9 w-full rounded-xl border border-input bg-input/40 px-2 text-xs font-medium text-foreground outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
                    />
                    <input
                      aria-label="Posted before"
                      type="date"
                      value={postedBefore}
                      onChange={(event) =>
                        updateFilter(() => setPostedBefore(event.target.value))
                      }
                      className="h-9 w-full rounded-xl border border-input bg-input/40 px-2 text-xs font-medium text-foreground outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </fieldset>

                <label className="flex cursor-pointer items-center gap-2.5 pt-2 text-xs text-muted-foreground hover:text-foreground">
                  <input
                    type="checkbox"
                    checked={includeDescriptions}
                    onChange={(event) =>
                      updateFilter(() => setIncludeDescriptions(event.target.checked))
                    }
                    className="size-4 rounded-md accent-[#A8DADC]"
                  />
                  Search within description
                </label>
              </div>
            </div>
          </div>

          <div className="hidden border-t border-border/50 pt-4 text-[11px] text-muted-foreground/60 lg:block">
            <span>Powered by Turso Database</span>
          </div>
        </aside>

        {/* Right Main Content Canvas */}
        <main className="flex min-w-0 flex-1 flex-col rounded-2xl border border-border/60 bg-card/50 p-4 backdrop-blur-xl sm:p-6 lg:rounded-3xl lg:p-8">
          <Dialog.Root open={showFilters} onOpenChange={setShowFilters}>
            <h1 className="sr-only">
              {mode === "saved" ? "Saved roles" : "Search roles"}
            </h1>

            {/* Apple-style Unified Search Pill */}
            <form
              className="group flex flex-col gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all focus-within:border-primary/60 focus-within:shadow-[0_4px_24px_rgba(0,0,0,0.1)] sm:flex-row sm:items-center sm:gap-3 sm:rounded-full sm:p-2 sm:pl-5"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                setRefreshKey((current) => current + 1);
              }}
              role="search"
              aria-label="Search jobs"
            >
              <div className="flex flex-1 items-center gap-3">
                <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => updateFilter(() => setQuery(event.target.value))}
                  placeholder="Role title, keywords, or company..."
                  className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </div>

              <div className="hidden h-5 w-px bg-border/80 sm:block" />

              <div className="flex flex-1 items-center gap-3 px-1 sm:px-0">
                <MapPin aria-hidden="true" className="size-4 shrink-0 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  value={location}
                  onChange={(event) => updateFilter(() => setLocation(event.target.value))}
                  placeholder="City, country, or remote..."
                  className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </div>

              <div className="flex items-center gap-2 pt-1 sm:pt-0">
                <Dialog.Trigger
                  aria-controls="job-filters"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border/80 bg-secondary/60 px-3.5 text-xs font-medium text-foreground transition-all hover:bg-secondary lg:hidden"
                >
                  <SlidersHorizontal aria-hidden="true" className="size-3.5" />
                  Filters
                  {activeFilters.length > 0 && (
                    <span className="rounded-full bg-primary px-1.5 py-0.2 text-[10px] font-semibold text-primary-foreground">
                      {activeFilters.length}
                    </span>
                  )}
                </Dialog.Trigger>

                <button
                  type="submit"
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 hover:shadow-md sm:w-auto"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Stats row & active filters */}
            <div className="mb-4 mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-primary" />
                    Fetching roles...
                  </span>
                ) : (
                  <>
                    <span className="font-semibold tabular-nums text-foreground">
                      {total.toLocaleString()}
                    </span>
                    <span>open positions</span>
                    {jobs.length > 0 && (
                      <span className="text-muted-foreground/60">
                        (showing {firstResult}–{lastResult})
                      </span>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ArrowDownUp aria-hidden="true" className="size-3.5" />
                <span>Most recent first</span>
              </div>
            </div>

            {/* Active filter badges */}
            {activeFilters.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
                <span className="text-xs text-muted-foreground/75">Active:</span>
                {activeFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => removeFilter(filter.id)}
                    aria-label={`Remove ${filter.label} filter`}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 text-xs text-foreground transition-all hover:border-primary/40 hover:bg-secondary/40"
                  >
                    <span>{filter.label}</span>
                    <X aria-hidden="true" className="size-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {/* Job results stream */}
            <section
              id="results"
              tabIndex={-1}
              aria-label="Job results"
              aria-busy={loading}
              className="flex-1 space-y-3.5"
            >
              {error && (
                <div
                  role="alert"
                  className="flex items-center justify-between rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-xs text-destructive"
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

              {jobs.map((job) => {
                const key = jobKey(job);
                const isSaved = Number(job.is_bookmarked) === 1;
                const primaryUrl = job.apply_url || job.details_url;
                return (
                  <article
                    key={key}
                    className="group relative flex flex-col justify-between rounded-2xl border border-border/60 bg-card/90 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] sm:flex-row sm:items-center sm:gap-6"
                  >
                    <div className="min-w-0 flex-1">
                      {/* Top meta tags */}
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${providerBadgeStyles[job.provider] || "border-border bg-muted text-muted-foreground"}`}>
                          {providerLabels[job.provider]}
                        </span>

                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                          <Building2 aria-hidden="true" className="size-3.5 text-muted-foreground" />
                          <span className="truncate">{job.company_name || job.company_slug}</span>
                        </span>

                        {job.workplace_type && (
                          <span className="inline-flex items-center rounded-full bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                            {formatLabel(job.workplace_type)}
                          </span>
                        )}

                        {Number(job.is_available) !== 1 && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Expired
                          </span>
                        )}
                      </div>

                      {/* Role title */}
                      <h2 className="text-base font-semibold leading-snug tracking-[-0.015em] text-foreground transition-colors group-hover:text-primary sm:text-lg">
                        {job.title || "Untitled position"}
                      </h2>

                      {/* Supporting location & date */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        {job.location_name && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin aria-hidden="true" className="size-3.5 text-muted-foreground/70" />
                            {job.location_name}
                          </span>
                        )}
                        {job.employment_type && (
                          <span className="inline-flex items-center gap-1.5">
                            <BriefcaseBusiness aria-hidden="true" className="size-3.5 text-muted-foreground/70" />
                            {job.employment_type}
                          </span>
                        )}
                        {job.first_published && (
                          <span className="inline-flex items-center gap-1.5 tabular-nums">
                            <CalendarDays aria-hidden="true" className="size-3.5 text-muted-foreground/70" />
                            {formatDate(job.first_published)}
                          </span>
                        )}
                      </div>

                      {/* Skill tags */}
                      {(job.department || job.experience || job.education) && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {[job.department, job.experience, job.education]
                            .filter(Boolean)
                            .map((item) => (
                              <span
                                key={item}
                                className="rounded-full border border-border/50 bg-secondary/30 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                              >
                                {item}
                              </span>
                            ))}
                        </div>
                      )}

                      {/* Expandable description */}
                      {job.description && (
                        <details className="group/desc mt-3 border-t border-border/40 pt-2">
                          <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground/80 hover:text-foreground">
                            <span>Job brief</span>
                            <ChevronDown className="size-3.5 transition-transform group-open/desc:rotate-180" />
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                            {job.description}
                          </p>
                        </details>
                      )}
                    </div>

                    {/* Right action controls */}
                    <div className="mt-4 flex items-center gap-2 sm:mt-0 sm:shrink-0">
                      <button
                        type="button"
                        aria-label={`${isSaved ? "Remove saved role" : "Save role"}: ${job.title || "Untitled role"}`}
                        aria-pressed={isSaved}
                        disabled={busyJobs.has(key)}
                        onClick={() => void toggleBookmark(job)}
                        className={`inline-flex size-10 items-center justify-center rounded-full border transition-all disabled:opacity-40 ${
                          isSaved
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
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
                          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 hover:shadow-md sm:flex-none"
                        >
                          <span>{job.apply_url ? "Apply" : "View"}</span>
                          <ExternalLink aria-hidden="true" className="size-3.5" />
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}

              {/* Empty state */}
              {!loading && !error && jobs.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 p-12 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-secondary/80 text-muted-foreground">
                    {mode === "saved" ? (
                      <Bookmark aria-hidden="true" className="size-5" />
                    ) : (
                      <Search aria-hidden="true" className="size-5" />
                    )}
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">
                    {mode === "saved" ? "No bookmarks saved" : "No roles matched"}
                  </h3>
                  <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
                    {mode === "saved"
                      ? "Tap the bookmark icon on any job card to save it for quick reference later."
                      : "Try loosening your keywords, locations, or platform filters to discover more open positions."}
                  </p>
                  {mode === "all" && activeFilters.length > 0 && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-5 inline-flex h-9 items-center justify-center rounded-full bg-secondary px-4 text-xs font-medium text-foreground transition-all hover:bg-secondary/80"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              )}

              {/* Skeleton loading */}
              {loading && jobs.length === 0 && (
                <div className="space-y-3.5" aria-hidden="true">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="space-y-3 rounded-2xl border border-border/50 bg-card/60 p-5">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                        <div className="h-5 w-32 animate-pulse rounded-full bg-muted" />
                      </div>
                      <div className="h-5 w-2/3 animate-pulse rounded-full bg-muted" />
                      <div className="h-4 w-1/3 animate-pulse rounded-full bg-muted" />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Apple style Pagination footer */}
            {jobs.length > 0 && (
              <footer className="mt-6 flex items-center justify-between border-t border-border/40 pt-4">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-border/70 bg-card px-4 text-xs font-medium text-foreground transition-all hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowLeft aria-hidden="true" className="size-3.5" />
                  Previous
                </button>

                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  Page {result?.page ?? page} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-border/70 bg-card px-4 text-xs font-medium text-foreground transition-all hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Next
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </button>
              </footer>
            )}

            {/* Mobile Filter Sheet Modal */}
            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" />
              <Dialog.Viewport className="fixed inset-0 z-50 flex items-end lg:hidden">
                <Dialog.Popup
                  aria-label="Refine job search"
                  className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl border border-border/80 bg-background p-6 shadow-2xl outline-none"
                >
                  <div className="mb-6 flex items-center justify-between">
                    <Dialog.Title className="text-sm font-semibold tracking-tight">
                      Filter Jobs
                    </Dialog.Title>
                    <Dialog.Close
                      type="button"
                      className="inline-flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </Dialog.Close>
                  </div>

                  <div className="space-y-4">
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

                    <fieldset className="space-y-1.5">
                      <legend className="block text-xs font-medium text-muted-foreground">
                        Posted between
                      </legend>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          aria-label="Posted after"
                          type="date"
                          value={postedAfter}
                          onChange={(event) =>
                            updateFilter(() => setPostedAfter(event.target.value))
                          }
                          className="h-10 w-full rounded-xl border border-input bg-input/40 px-2 text-xs font-medium text-foreground outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
                        />
                        <input
                          aria-label="Posted before"
                          type="date"
                          value={postedBefore}
                          onChange={(event) =>
                            updateFilter(() => setPostedBefore(event.target.value))
                          }
                          className="h-10 w-full rounded-xl border border-input bg-input/40 px-2 text-xs font-medium text-foreground outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </fieldset>

                    <label className="flex cursor-pointer items-center gap-2.5 pt-2 text-xs text-muted-foreground hover:text-foreground">
                      <input
                        type="checkbox"
                        checked={includeDescriptions}
                        onChange={(event) =>
                          updateFilter(() => setIncludeDescriptions(event.target.checked))
                        }
                        className="size-4 rounded-md accent-[#A8DADC]"
                      />
                      Search within description
                    </label>

                    <div className="pt-4">
                      <Dialog.Close
                        type="button"
                        className="flex h-11 w-full items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm"
                      >
                        Apply Filters
                      </Dialog.Close>
                    </div>
                  </div>
                </Dialog.Popup>
              </Dialog.Viewport>
            </Dialog.Portal>
          </Dialog.Root>
        </main>
      </div>
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
