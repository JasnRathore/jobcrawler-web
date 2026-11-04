"use client";

import {
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { cn } from "cn";
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
  ashbyhq: "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  greenhouse: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  lever: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  levereu: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  workable: "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300",
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

  const queryString = useMemo(() => {
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
    return params.toString();
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
        const response = await fetch(`/api/jobs?${queryString}`, {
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
    }, 150);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [queryString, refreshKey]);

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
  const totalPages = result?.totalPages ?? 1;
  const firstResult = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = Math.min((page - 1) * pageSize + jobs.length, total);



  return (
    <div className="flex min-h-screen w-full bg-background text-foreground antialiased selection:bg-primary/20 selection:text-foreground">
      <a
        href="#results"
        className="sr-only z-50 rounded-xl border bg-background px-4 py-2 text-sm shadow-lg focus:not-sr-only focus:fixed focus:left-6 focus:top-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to job results
      </a>

      {/* Full-bleed workspace — sidebar + content separated by a structural border */}
      <div className="flex min-h-screen w-full flex-col lg:flex-row">
        {/* Left Sidebar */}
        <aside className="flex w-full shrink-0 flex-col justify-between border-b border-border/60 bg-card/25 p-4 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="space-y-4">
            {/* View switcher */}
            <nav aria-label="Job views" className="flex flex-col gap-2.5">
              <Button
                type="button"
                variant={mode === "all" ? "default" : "secondary"}
                onClick={() => {
                  setMode("all");
                  setPage(1);
                }}
                aria-pressed={mode === "all"}
                className={cn(
                  "h-10 w-full justify-start gap-2.5 rounded-lg px-3 text-xs font-medium transition-all",
                  mode === "all"
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:text-foreground"
                )}
              >
                <BriefcaseBusiness aria-hidden="true" className="size-4" />
                <span>Explore roles</span>
              </Button>

              <Button
                type="button"
                variant={mode === "saved" ? "default" : "secondary"}
                onClick={() => {
                  setMode("saved");
                  setPage(1);
                }}
                aria-pressed={mode === "saved"}
                className={cn(
                  "h-10 w-full justify-start gap-2.5 rounded-lg px-3 text-xs font-medium transition-all",
                  mode === "saved"
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:text-foreground"
                )}
              >
                <Bookmark aria-hidden="true" className="size-4" />
                <span>Saved roles</span>
              </Button>
            </nav>

            {/* Filters Section (Desktop) */}
            <div className="hidden lg:block lg:pt-1">
              <div className="space-y-3">
                <FilterCombobox
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
                <FilterCombobox
                  label="Employment"
                  value={employment}
                  onChange={(value) => updateFilter(() => setEmployment(value))}
                  options={employmentOptions}
                />
                <FilterCombobox
                  label="Workplace"
                  value={workplace}
                  onChange={(value) => updateFilter(() => setWorkplace(value))}
                  options={workplaceOptions}
                />

                <fieldset className="space-y-1">
                  <legend className="block text-[11px] font-medium text-muted-foreground/80">
                    Posted between
                  </legend>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      aria-label="Posted after"
                      type="date"
                      value={postedAfter}
                      onChange={(event) =>
                        updateFilter(() => setPostedAfter(event.target.value))
                      }
                      className="h-9 w-full min-w-0 rounded-lg border border-transparent bg-secondary px-2 text-[11px] font-medium text-secondary-foreground shadow-2xs outline-none transition-colors hover:bg-secondary/80 focus:ring-2 focus:ring-primary/20"
                    />
                    <input
                      aria-label="Posted before"
                      type="date"
                      value={postedBefore}
                      onChange={(event) =>
                        updateFilter(() => setPostedBefore(event.target.value))
                      }
                      className="h-9 w-full min-w-0 rounded-lg border border-transparent bg-secondary px-2 text-[11px] font-medium text-secondary-foreground shadow-2xs outline-none transition-colors hover:bg-secondary/80 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </fieldset>

                <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-muted-foreground hover:text-foreground select-none">
                  <Checkbox
                    checked={includeDescriptions}
                    onCheckedChange={(checked) =>
                      updateFilter(() => setIncludeDescriptions(Boolean(checked)))
                    }
                  />
                  <span>Search within description</span>
                </label>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={activeFilters.length === 0}
                    onClick={clearFilters}
                    className="h-9 w-full rounded-lg border border-transparent bg-secondary text-xs font-medium text-secondary-foreground transition-all hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                  >
                    Reset filters
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Footer with Theme Toggle */}
          <div className="hidden lg:flex items-center justify-center pt-3">
            <ThemeToggle />
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Dialog.Root open={showFilters} onOpenChange={setShowFilters}>
            {/* Top Header container: Search Bar + Results count & sort (vertically aligned with sidebar) */}
            <div className="sticky top-0 z-20 flex shrink-0 flex-col gap-2.5 bg-background/95 p-4 sm:px-6 backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <form
                  className="flex flex-1 items-center gap-2.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setPage(1);
                    setRefreshKey((current) => current + 1);
                  }}
                  role="search"
                  aria-label="Search jobs"
                >
                  {/* Role / Keywords search */}
                  <div className="group flex h-10 flex-1 items-center gap-2.5 rounded-lg border border-border/70 bg-secondary px-3 shadow-xs transition-all focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
                    <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => updateFilter(() => setQuery(event.target.value))}
                      placeholder="Role title, keywords, or company..."
                      className="h-full w-full bg-transparent text-xs sm:text-sm text-secondary-foreground outline-none placeholder:text-muted-foreground/60"
                    />
                  </div>

                  {/* Location search */}
                  <div className="group hidden h-10 flex-1 items-center gap-2.5 rounded-lg border border-border/70 bg-secondary px-3 shadow-xs transition-all sm:flex focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
                    <MapPin aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <input
                      value={location}
                      onChange={(event) => updateFilter(() => setLocation(event.target.value))}
                      placeholder="City, country, or remote..."
                      className="h-full w-full bg-transparent text-xs sm:text-sm text-secondary-foreground outline-none placeholder:text-muted-foreground/60"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="default"
                    className="h-10 shrink-0 rounded-lg px-4 text-xs font-semibold shadow-xs"
                  >
                    Search
                  </Button>
                </form>

                {/* Mobile controls */}
                <div className="flex items-center gap-2 lg:hidden">
                  <Dialog.Trigger
                    render={
                      <Button
                        variant="secondary"
                        className="h-10 gap-1.5 rounded-lg border border-transparent bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                      />
                    }
                    aria-controls="job-filters"
                  >
                    <SlidersHorizontal aria-hidden="true" className="size-3.5" />
                    <span className="hidden sm:inline">Filters</span>
                    {activeFilters.length > 0 && (
                      <span className="rounded-full bg-primary px-1.5 py-0.2 text-[10px] font-semibold text-primary-foreground">
                        {activeFilters.length}
                      </span>
                    )}
                  </Dialog.Trigger>

                  <ThemeToggle />
                </div>
              </div>

              {/* Results count & active filters inline */}
              <div className="flex flex-wrap items-center gap-3 pt-0.5">
                <div className="flex items-center gap-2 text-xs">
                  {loading ? (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-primary" />
                      Fetching roles...
                    </span>
                  ) : (
                    <>
                      <span className="font-semibold tabular-nums text-foreground">
                        {total.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground">
                        {mode === "saved" ? "saved positions" : "open positions"}
                      </span>
                      {jobs.length > 0 && (
                        <>
                          <span className="text-border" aria-hidden="true">•</span>
                          <span className="text-muted-foreground/75 tabular-nums">
                            Showing {firstResult}–{lastResult}
                          </span>
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* Active filter badges inline */}
                {activeFilters.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
                    {activeFilters.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => removeFilter(filter.id)}
                        aria-label={`Remove ${filter.label} filter`}
                        className="group inline-flex h-6 items-center gap-1.5 rounded-md border border-border/70 bg-secondary px-2.5 text-xs text-secondary-foreground transition-all hover:border-destructive/40 hover:bg-secondary/80"
                      >
                        <span>{filter.label}</span>
                        <X
                          aria-hidden="true"
                          className="size-3 text-muted-foreground transition-colors group-hover:text-destructive"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <main className="flex min-w-0 flex-1 flex-col px-4 pt-1 pb-6 sm:px-6 sm:pt-1 sm:pb-8">
              <h1 className="sr-only">
                {mode === "saved" ? "Saved roles" : "Open roles"}
              </h1>

            {/* Job results stream */}
            <section
              id="results"
              tabIndex={-1}
              aria-label="Job results"
              aria-busy={loading}
              className="flex-1 space-y-3"
            >
              {error && (
                <div
                  role="alert"
                  className="flex items-center justify-between rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-xs text-destructive"
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
                    className="relative flex flex-col justify-between rounded-xl border border-border/80 bg-secondary p-5 shadow-xs sm:flex-row sm:items-start sm:gap-6"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5">
                        <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-secondary-foreground">
                          <Building2 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{job.company_name || job.company_slug}</span>
                        </span>
                        <span aria-hidden="true" className="text-muted-foreground/60">·</span>
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${providerBadgeStyles[job.provider] || "border-border bg-muted text-muted-foreground"}`}>
                          {providerLabels[job.provider]}
                        </span>

                        {Number(job.is_available) !== 1 && (
                          <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
                            Expired
                          </span>
                        )}
                      </div>

                      <h2 className="text-base font-semibold leading-snug tracking-[-0.015em] text-foreground sm:text-lg">
                        {job.title || "Untitled position"}
                      </h2>

                      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground">
                        {job.location_name && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin aria-hidden="true" className="size-3 shrink-0" />
                            {job.location_name}
                          </span>
                        )}
                        {job.employment_type && (
                          <span className="inline-flex items-center gap-1">
                            <BriefcaseBusiness aria-hidden="true" className="size-3 shrink-0" />
                            {job.employment_type}
                          </span>
                        )}
                        {job.workplace_type && (
                          <span className="font-medium text-secondary-foreground">
                            {formatLabel(job.workplace_type)}
                          </span>
                        )}
                        {job.first_published && (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <CalendarDays aria-hidden="true" className="size-3 shrink-0" />
                            {formatDate(job.first_published)}
                          </span>
                        )}
                      </div>

                      {/* Tags */}
                      {(job.department || job.experience || job.education) && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {[job.department, job.experience, job.education]
                            .filter(Boolean)
                            .map((item) => (
                              <span
                                key={item}
                                className="rounded-md border border-border/70 px-2 py-1 text-[11px] font-medium text-secondary-foreground"
                              >
                                {item}
                              </span>
                            ))}
                        </div>
                      )}

                      {/* Expandable description */}
                      {job.description && (
                        <details className="group/desc mt-3 border-t border-border/60 pt-2">
                          <summary className="flex min-h-9 cursor-pointer items-center gap-1.5 text-xs font-medium text-secondary-foreground hover:text-foreground select-none">
                            <ChevronDown className="size-3 transition-transform group-open/desc:rotate-180" />
                            <span>Job brief</span>
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-secondary-foreground">
                            {job.description}
                          </p>
                        </details>
                      )}
                    </div>

                    {/* Right action controls */}
                    <div className="mt-3 flex items-center gap-2 sm:mt-1 sm:shrink-0">
                      <Button
                        type="button"
                        variant={isSaved ? "default" : "secondary"}
                        size="icon"
                        aria-label={`${isSaved ? "Remove saved role" : "Save role"}: ${job.title || "Untitled role"}`}
                        aria-pressed={isSaved}
                        disabled={busyJobs.has(key)}
                        onClick={() => void toggleBookmark(job)}
                        className={`size-9 rounded-lg transition-all ${
                          isSaved
                            ? "border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30"
                            : "border border-border/70 bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        <Bookmark
                          aria-hidden="true"
                          className={`size-4 ${isSaved ? "fill-primary" : ""}`}
                        />
                      </Button>

                      {primaryUrl && (
                        <Button
                          nativeButton={false}
                          render={<a href={primaryUrl} target="_blank" rel="noopener noreferrer" />}
                          variant="default"
                          className="h-9 flex-1 gap-2 rounded-lg px-4 text-xs font-semibold shadow-xs hover:opacity-90 sm:flex-none"
                        >
                          <span>{job.apply_url ? "Apply" : "View"}</span>
                          <ExternalLink aria-hidden="true" className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}

              {/* Empty state */}
              {!loading && !error && jobs.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-12 text-center">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
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
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={clearFilters}
                      className="mt-5 h-8.5 rounded-lg border border-border/70 bg-secondary px-4 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                    >
                      Clear all filters
                    </Button>
                  )}
                </div>
              )}

              {/* Skeleton loading */}
              {loading && jobs.length === 0 && (
                <div className="space-y-3.5" aria-hidden="true">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="space-y-3 rounded-xl border border-border/50 bg-secondary p-5">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
                        <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
                      </div>
                      <div className="h-5 w-2/3 animate-pulse rounded-md bg-muted" />
                      <div className="h-4 w-1/3 animate-pulse rounded-md bg-muted" />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Pagination footer */}
            {jobs.length > 0 && (
              <footer className="mt-6 flex items-center justify-between">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="h-8.5 gap-2 rounded-lg border border-border/70 bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowLeft aria-hidden="true" className="size-3.5" />
                  Previous
                </Button>

                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  Page {result?.page ?? page} of {totalPages}
                </span>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  className="h-8.5 gap-2 rounded-lg border border-border/70 bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Next
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Button>
              </footer>
            )}
            </main>

            {/* Mobile Filter Sheet Modal */}
            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" />
              <Dialog.Viewport className="fixed inset-0 z-50 flex items-end lg:hidden">
                <Dialog.Popup
                  aria-label="Refine job search"
                  className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-border/80 bg-background p-6 shadow-2xl outline-none"
                >
                  <div className="mb-6 flex items-center justify-between">
                    <Dialog.Title className="text-sm font-semibold tracking-tight">
                      Filters
                    </Dialog.Title>
                    <Dialog.Close
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-8 rounded-md bg-secondary text-muted-foreground hover:text-foreground"
                        />
                      }
                    >
                      <X aria-hidden="true" className="size-4" />
                    </Dialog.Close>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5 sm:hidden">
                      <span className="block text-xs font-medium text-muted-foreground">
                        Location
                      </span>
                      <div className="flex h-10 items-center gap-2.5 rounded-lg border border-transparent bg-secondary px-3 text-xs shadow-2xs">
                        <MapPin aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        <input
                          value={location}
                          onChange={(event) => updateFilter(() => setLocation(event.target.value))}
                          placeholder="City, country, or remote..."
                          className="w-full bg-transparent text-secondary-foreground outline-none placeholder:text-muted-foreground/60"
                        />
                      </div>
                    </div>

                    <FilterCombobox
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
                    <FilterCombobox
                      label="Employment"
                      value={employment}
                      onChange={(value) => updateFilter(() => setEmployment(value))}
                      options={employmentOptions}
                    />
                    <FilterCombobox
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
                          className="h-9 w-full rounded-lg border border-transparent bg-secondary px-2 text-xs font-medium text-secondary-foreground shadow-2xs outline-none transition-colors hover:bg-secondary/80 focus:ring-2 focus:ring-primary/20"
                        />
                        <input
                          aria-label="Posted before"
                          type="date"
                          value={postedBefore}
                          onChange={(event) =>
                            updateFilter(() => setPostedBefore(event.target.value))
                          }
                          className="h-9 w-full rounded-lg border border-transparent bg-secondary px-2 text-xs font-medium text-secondary-foreground shadow-2xs outline-none transition-colors hover:bg-secondary/80 focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </fieldset>

                    <label className="flex cursor-pointer items-center gap-2.5 pt-2 text-xs text-muted-foreground hover:text-foreground select-none">
                      <Checkbox
                        checked={includeDescriptions}
                        onCheckedChange={(checked) =>
                          updateFilter(() => setIncludeDescriptions(Boolean(checked)))
                        }
                      />
                      <span>Search within description</span>
                    </label>

                    <div className="pt-4">
                      <Dialog.Close
                        render={
                          <Button
                            variant="default"
                            className="h-10 w-full rounded-lg text-xs font-semibold shadow-sm"
                          />
                        }
                      >
                        Apply Filters
                      </Dialog.Close>
                    </div>
                  </div>
                </Dialog.Popup>
              </Dialog.Viewport>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </div>
  );
}

type FilterOption = { value: string; label: string };

function FilterCombobox({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
}) {
  const selected = options.find((opt) => opt.value === value) ?? options[0];

  return (
    <div className="space-y-1">
      <span className="block text-[11px] font-medium text-muted-foreground/80">
        {label}
      </span>
      <Combobox<FilterOption>
        items={options}
        value={selected}
        onValueChange={(item) => {
          if (item) {
            onChange(item.value);
          }
        }}
        itemToStringLabel={(item) => (item ? item.label : "")}
        itemToStringValue={(item) => (item ? item.value : "")}
      >
        <ComboboxInput
          placeholder={options[0].label}
          aria-label={label}
          className="h-9 w-full rounded-lg border border-transparent bg-secondary px-2.5 text-xs font-medium text-secondary-foreground shadow-2xs transition-colors hover:bg-secondary/80 focus-within:ring-2 focus-within:ring-primary/20"
        />
        <ComboboxContent className="z-50 min-w-[200px] rounded-lg border border-border bg-secondary p-1 shadow-md backdrop-blur-xl">
          <ComboboxEmpty className="py-2 text-center text-xs text-muted-foreground">
            No options found
          </ComboboxEmpty>
          <ComboboxList>
            {(opt) => (
              <ComboboxItem
                value={opt}
                className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-secondary-foreground transition-colors hover:bg-background/40 data-highlighted:bg-background/50"
              >
                <span>{opt.label}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
