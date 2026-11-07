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
  Trash2,
  X,
} from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/toast";
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
  bookmarkKey,
  clearBookmarks,
  readBookmarks,
  writeBookmarks,
} from "@/lib/bookmarks";
import {
  providers,
  type Job,
  type JobSearchResponse,
  type Provider,
} from "@/lib/jobs";

type ViewMode = "all" | "saved";
type FilterDraft = {
  location: string;
  provider: string;
  employment: string;
  workplace: string;
  postedAfter: string;
  postedBefore: string;
  includeDescriptions: boolean;
};
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

function countFilters(filters: FilterDraft): number {
  return [
    filters.location,
    filters.provider,
    filters.employment,
    filters.workplace,
    filters.postedAfter,
    filters.postedBefore,
    filters.includeDescriptions,
  ].filter(Boolean).length;
}

function isInvalidDateRange(filters: Pick<FilterDraft, "postedAfter" | "postedBefore">) {
  return Boolean(
    filters.postedAfter &&
      filters.postedBefore &&
      filters.postedAfter > filters.postedBefore,
  );
}

function descriptionMatchesQuery(description: string, query: string): boolean {
  const terms = query.toLowerCase().match(/[a-z0-9]+/g)?.slice(0, 8) ?? [];
  if (terms.length === 0) return false;

  const normalizedDescription = description.toLowerCase();
  return terms.every((term) =>
    new RegExp(`(^|[^a-z0-9])${term}([^a-z0-9]|$)`).test(
      normalizedDescription,
    ),
  );
}

function getBookmarkErrorMessage(error: unknown): string {
  if (error instanceof SyntaxError) {
    return "Saved roles in this browser have an unreadable format.";
  }
  if (error instanceof Error && error.name === "QuotaExceededError") {
    return "This browser's storage is full. Free space or clear saved data, then retry.";
  }
  if (error instanceof Error && error.name === "SecurityError") {
    return "Browser storage is blocked. Check privacy settings, then retry.";
  }
  return error instanceof Error
    ? error.message
    : "Saved roles could not be accessed in this browser.";
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
  const [apiLoading, setApiLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookmarkError, setBookmarkError] = useState("");
  const [bookmarks, setBookmarks] = useState<Job[]>([]);
  const [bookmarksReady, setBookmarksReady] = useState(false);
  const [filterDraft, setFilterDraft] = useState<FilterDraft | null>(null);
  const [busyJobs, setBusyJobs] = useState<Set<string>>(() => new Set());
  const [showClearSavedDialog, setShowClearSavedDialog] = useState(false);
  const showFilters = filterDraft !== null;
  const resultsSummaryRef = useRef<HTMLDivElement>(null);
  const focusResultsAfterChange = useRef(false);
  const submitSearchImmediately = useRef(false);
  const requestSequence = useRef(0);
  const invalidateSearchRequest = () => {
    requestSequence.current += 1;
  };

  useEffect(() => {
    const desktopViewport = window.matchMedia("(min-width: 1024px)");
    const closeFiltersOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setFilterDraft(null);
    };

    desktopViewport.addEventListener("change", closeFiltersOnDesktop);
    return () =>
      desktopViewport.removeEventListener("change", closeFiltersOnDesktop);
  }, []);

  useEffect(() => {
    if (
      !showFilters &&
      !showClearSavedDialog &&
      focusResultsAfterChange.current
    ) {
      focusResultsAfterChange.current = false;
      requestAnimationFrame(() => resultsSummaryRef.current?.focus());
    }
  }, [bookmarks, mode, page, showClearSavedDialog, showFilters]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
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
    const loadBookmarks = () => {
      try {
        setBookmarks(readBookmarks());
        setBookmarkError("");
      } catch (storageError) {
        setBookmarkError(getBookmarkErrorMessage(storageError));
      } finally {
        setBookmarksReady(true);
      }
    };

    loadBookmarks();
    window.addEventListener("storage", loadBookmarks);
    return () => window.removeEventListener("storage", loadBookmarks);
  }, []);

  const bookmarkKeys = useMemo(
    () => new Set(bookmarks.map(bookmarkKey)),
    [bookmarks],
  );

  const filteredBookmarks = useMemo(() => {
    if (mode !== "saved") return [];

    const params = new URLSearchParams(queryString);
    const search = (params.get("q") ?? "").toLocaleLowerCase();
    const locationFilter = (params.get("location") ?? "").toLocaleLowerCase();
    const providerFilter = params.get("provider") ?? "";
    const employmentFilter = (params.get("employment") ?? "").toLocaleLowerCase();
    const workplaceFilter = (params.get("workplace") ?? "").toLocaleLowerCase();
    const postedAfterFilter = params.get("posted_after") ?? "";
    const postedBeforeFilter = params.get("posted_before") ?? "";
    const includeDescription = params.get("details") === "true";

    return bookmarks
      .filter((job) => {
        const searchMatches =
          !search ||
          [job.title, job.company_name, job.location_name].some((value) =>
            value.toLocaleLowerCase().includes(search),
          ) ||
          (includeDescription &&
            descriptionMatchesQuery(job.description, search));
        const published = job.first_published.slice(0, 10);
        const hasPublishedDate = published.length > 0;

        return (
          searchMatches &&
          (!locationFilter ||
            job.location_name.toLocaleLowerCase().includes(locationFilter)) &&
          (!providerFilter || job.provider === providerFilter) &&
          (!employmentFilter ||
            job.employment_type.toLocaleLowerCase().includes(employmentFilter)) &&
          (!workplaceFilter ||
            job.workplace_type.toLocaleLowerCase().includes(workplaceFilter)) &&
          (!postedAfterFilter ||
            (hasPublishedDate && published >= postedAfterFilter)) &&
          (!postedBeforeFilter ||
            (hasPublishedDate && published <= postedBeforeFilter))
        );
      })
      .sort(
        (a, b) =>
          b.first_published.localeCompare(a.first_published) ||
          a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
      );
  }, [bookmarks, mode, queryString]);

  useEffect(() => {
    if (mode === "saved") {
      return;
    }

    const controller = new AbortController();
    const requestId = ++requestSequence.current;
    const timeout = window.setTimeout(async () => {
      submitSearchImmediately.current = false;
      setApiLoading(true);
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
        if (
          controller.signal.aborted ||
          requestId !== requestSequence.current
        ) {
          return;
        }
        setResult(jobResult);
      } catch (requestError) {
        if (
          controller.signal.aborted ||
          requestId !== requestSequence.current
        ) {
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Jobs could not be loaded.",
        );
      } finally {
        if (
          !controller.signal.aborted &&
          requestId === requestSequence.current
        ) {
          setApiLoading(false);
        }
      }
    }, submitSearchImmediately.current ? 0 : 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [mode, queryString, refreshKey]);

  const updateFilter = useCallback((update: () => void, changed = true) => {
    submitSearchImmediately.current = false;
    if (changed) requestSequence.current += 1;
    update();
    setPage(1);
  }, []);

  const resetAppliedFilters = () => {
    submitSearchImmediately.current = false;
    if (
      location ||
      provider ||
      employment ||
      workplace ||
      postedAfter ||
      postedBefore ||
      includeDescriptions
    ) {
      invalidateSearchRequest();
    }
    setLocation("");
    setProvider("");
    setEmployment("");
    setWorkplace("");
    setPostedAfter("");
    setPostedBefore("");
    setIncludeDescriptions(false);
    setPage(1);
  };

  const clearSearchAndFilters = () => {
    if (query) invalidateSearchRequest();
    resetAppliedFilters();
    setQuery("");
  };

  const openFilters = () => {
    setFilterDraft({
      location,
      provider,
      employment,
      workplace,
      postedAfter,
      postedBefore,
      includeDescriptions,
    });
  };

  const updateFilterDraft = <K extends keyof FilterDraft>(
    key: K,
    value: FilterDraft[K],
  ) => {
    setFilterDraft((current) =>
      current ? { ...current, [key]: value } : current,
    );
  };

  const resetFilterDraft = () => {
    setFilterDraft({
      location: "",
      provider: "",
      employment: "",
      workplace: "",
      postedAfter: "",
      postedBefore: "",
      includeDescriptions: false,
    });
  };

  const applyFilterDraft = () => {
    if (!filterDraft || isInvalidDateRange(filterDraft)) return;
    submitSearchImmediately.current = false;
    const changed =
      filterDraft.location !== location ||
      filterDraft.provider !== provider ||
      filterDraft.employment !== employment ||
      filterDraft.workplace !== workplace ||
      filterDraft.postedAfter !== postedAfter ||
      filterDraft.postedBefore !== postedBefore ||
      filterDraft.includeDescriptions !== includeDescriptions;
    if (changed) invalidateSearchRequest();
    setLocation(filterDraft.location);
    setProvider(filterDraft.provider);
    setEmployment(filterDraft.employment);
    setWorkplace(filterDraft.workplace);
    setPostedAfter(filterDraft.postedAfter);
    setPostedBefore(filterDraft.postedBefore);
    setIncludeDescriptions(filterDraft.includeDescriptions);
    setPage(1);
    focusResultsAfterChange.current = true;
    setFilterDraft(null);
  };

  const changeMode = (nextMode: ViewMode) => {
    submitSearchImmediately.current = false;
    if (nextMode !== mode || page !== 1) invalidateSearchRequest();
    focusResultsAfterChange.current = true;
    setMode(nextMode);
    setPage(1);
    window.scrollTo(0, 0);
  };

  const changePage = (nextPage: number) => {
    submitSearchImmediately.current = false;
    if (nextPage !== page) invalidateSearchRequest();
    focusResultsAfterChange.current = true;
    setPage(nextPage);
  };

  const clearSavedData = () => {
    try {
      clearBookmarks();
      if (mode === "saved") focusResultsAfterChange.current = true;
      setBookmarks([]);
      setBookmarkError("");
      setBookmarksReady(true);
      setShowClearSavedDialog(false);
      toast.add({
        title: "Saved roles cleared",
        description: "Saved roles were removed from this browser profile.",
        type: "success",
      });
    } catch (storageError) {
      const message = getBookmarkErrorMessage(storageError);
      setBookmarkError(message);
      setShowClearSavedDialog(false);
      toast.add({
        title: "Couldn't clear saved roles",
        description: message,
        type: "error",
        priority: "high",
      });
    }
  };

  const retryLoading = () => {
    invalidateSearchRequest();
    setRefreshKey((current) => current + 1);
    try {
      const storedBookmarks = readBookmarks();
      if (bookmarkError) writeBookmarks(storedBookmarks);
      setBookmarks(storedBookmarks);
      setBookmarkError("");
    } catch (storageError) {
      setBookmarkError(getBookmarkErrorMessage(storageError));
    }
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
  const activeFilterCount = activeFilters.filter(
    (filter) => filter.id !== "query",
  ).length;
  const invalidFilterDraftDateRange =
    filterDraft !== null && isInvalidDateRange(filterDraft);

  async function toggleBookmark(job: Job) {
    const key = bookmarkKey(job);
    setBusyJobs((current) => new Set(current).add(key));
    try {
      if (bookmarkError) throw new Error(bookmarkError);
      const saved = !bookmarkKeys.has(key);
      const nextBookmarks = saved
        ? [{ ...job, is_bookmarked: 1 }, ...bookmarks]
        : bookmarks.filter((bookmark) => bookmarkKey(bookmark) !== key);
      writeBookmarks(nextBookmarks);
      if (mode === "saved" && !saved) {
        focusResultsAfterChange.current = true;
      }
      setBookmarks(nextBookmarks);
      toast.add({
        title: saved ? "Role saved" : "Role removed",
        description: saved
          ? `${job.title || "This role"} is in Saved on this device.`
          : `${job.title || "This role"} was removed from Saved on this device.`,
        type: "success",
      });
    } catch (requestError) {
      const message = getBookmarkErrorMessage(requestError);
      setBookmarkError(message);
      toast.add({
        title: "Couldn't update saved roles",
        description: message,
        type: "error",
        priority: "high",
      });
    } finally {
      setBusyJobs((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  const total =
    mode === "saved" ? filteredBookmarks.length : result?.total ?? 0;
  const pageSize = mode === "saved" ? 20 : result?.pageSize ?? 20;
  const totalPages =
    mode === "saved"
      ? Math.max(1, Math.ceil(total / pageSize))
      : result?.totalPages ?? 1;
  const currentPage =
    mode === "saved" ? Math.min(page, totalPages) : result?.page ?? page;
  const jobs =
    mode === "saved"
      ? filteredBookmarks
          .slice((currentPage - 1) * pageSize, currentPage * pageSize)
          .map((job) => ({ ...job, is_bookmarked: 1 }))
      : (result?.jobs ?? []).map((job) => ({
          ...job,
          is_bookmarked: bookmarkKeys.has(bookmarkKey(job)) ? 1 : 0,
        }));
  const loading = mode === "saved" ? !bookmarksReady : apiLoading;
  const visibleError = bookmarkError || (mode === "all" ? error : "");
  const firstResult = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastResult = Math.min((currentPage - 1) * pageSize + jobs.length, total);
  const savedNavigationLabel = bookmarkError
    ? "Saved roles, count unavailable"
    : bookmarksReady
      ? `Saved roles, ${bookmarks.length} saved on this device`
      : "Saved roles, count loading";
  const resultsAnnouncement = visibleError
    ? ""
    : loading
      ? `Loading ${mode === "saved" ? "saved" : "open"} roles`
      : `${total} ${mode === "saved" ? "saved" : "open"} roles${
          jobs.length > 0 ? `, showing ${firstResult} to ${lastResult}` : ""
        }, page ${currentPage} of ${totalPages}`;



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
        <aside className="hidden w-full shrink-0 flex-col justify-between border-b border-border/60 bg-card/25 p-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="space-y-4">
            {/* View switcher */}
            <nav aria-label="Job views" className="flex flex-col gap-2.5">
              <Button
                type="button"
                variant={mode === "all" ? "default" : "secondary"}
                onClick={() => changeMode("all")}
                aria-current={mode === "all" ? "page" : undefined}
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
                onClick={() => changeMode("saved")}
                aria-current={mode === "saved" ? "page" : undefined}
                aria-label={savedNavigationLabel}
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
                  onChange={(value) =>
                    updateFilter(() => setProvider(value), value !== provider)
                  }
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
                  onChange={(value) =>
                    updateFilter(
                      () => setEmployment(value),
                      value !== employment,
                    )
                  }
                  options={employmentOptions}
                />
                <FilterCombobox
                  label="Workplace"
                  value={workplace}
                  onChange={(value) =>
                    updateFilter(() => setWorkplace(value), value !== workplace)
                  }
                  options={workplaceOptions}
                />

                <fieldset className="space-y-1.5">
                  <legend className="block text-[11px] font-medium text-muted-foreground/80">
                    Posted between
                  </legend>
                  <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
                    <span>After</span>
                    <input
                      type="date"
                      max={postedBefore || undefined}
                      value={postedAfter}
                      onChange={(event) =>
                        updateFilter(
                          () => setPostedAfter(event.target.value),
                          event.target.value !== postedAfter,
                        )
                      }
                      className="h-9 w-full min-w-0 rounded-lg border border-transparent bg-secondary px-2 text-[11px] font-medium text-secondary-foreground shadow-2xs outline-none transition-colors hover:bg-secondary/80 focus:ring-2 focus:ring-primary/20"
                    />
                  </label>
                  <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
                    <span>Before</span>
                    <input
                      type="date"
                      min={postedAfter || undefined}
                      value={postedBefore}
                      onChange={(event) =>
                        updateFilter(
                          () => setPostedBefore(event.target.value),
                          event.target.value !== postedBefore,
                        )
                      }
                      className="h-9 w-full min-w-0 rounded-lg border border-transparent bg-secondary px-2 text-[11px] font-medium text-secondary-foreground shadow-2xs outline-none transition-colors hover:bg-secondary/80 focus:ring-2 focus:ring-primary/20"
                    />
                  </label>
                </fieldset>

                <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-muted-foreground hover:text-foreground select-none">
                  <Checkbox
                    checked={includeDescriptions}
                    onCheckedChange={(checked) =>
                      updateFilter(
                        () => setIncludeDescriptions(Boolean(checked)),
                        Boolean(checked) !== includeDescriptions,
                      )
                    }
                  />
                  <span>Search within description</span>
                </label>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={activeFilterCount === 0}
                    onClick={resetAppliedFilters}
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
          <Dialog.Root
            open={showFilters}
            onOpenChange={(open) => {
              if (open) openFilters();
              else setFilterDraft(null);
            }}
          >
            {/* Top Header container: Search Bar + Results count & sort (vertically aligned with sidebar) */}
            <div className="sticky top-0 z-20 flex shrink-0 flex-col gap-3 bg-background/95 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] min-[480px]:px-5 md:px-6 backdrop-blur-md">
              <div className="flex items-center justify-between gap-3 lg:hidden">
                <span className="text-sm font-semibold tracking-tight text-foreground">
                  Crawler
                </span>
                <div className="flex items-center gap-2">
                  <nav
                    aria-label="Job views"
                    className="hidden items-center gap-1 rounded-lg bg-secondary p-1 md:flex lg:hidden"
                  >
                    <Button
                      type="button"
                      variant={mode === "all" ? "default" : "ghost"}
                      onClick={() => changeMode("all")}
                      aria-current={mode === "all" ? "page" : undefined}
                      className="h-11 rounded-md px-3 text-xs"
                    >
                      Explore
                    </Button>
                    <Button
                      type="button"
                      variant={mode === "saved" ? "default" : "ghost"}
                      onClick={() => changeMode("saved")}
                      aria-current={mode === "saved" ? "page" : undefined}
                      aria-label={savedNavigationLabel}
                      className="h-11 gap-1.5 rounded-md px-3 text-xs"
                    >
                      Saved
                      {bookmarksReady && !bookmarkError && bookmarks.length > 0 && (
                        <span className="tabular-nums">
                          {bookmarks.length > 99 ? "99+" : bookmarks.length}
                        </span>
                      )}
                    </Button>
                  </nav>
                  <Dialog.Trigger
                    render={
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-11 min-w-11 gap-1.5 rounded-lg border border-transparent bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                      />
                    }
                    aria-label={`Filters, ${activeFilterCount} active`}
                    aria-controls="job-filters"
                  >
                    <SlidersHorizontal aria-hidden="true" className="size-3.5" />
                    <span className="hidden min-[480px]:inline">Filters</span>
                    {activeFilterCount > 0 && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        {activeFilterCount}
                      </span>
                    )}
                  </Dialog.Trigger>
                  <ThemeToggle />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <form
                  className="flex min-w-0 flex-1 items-center gap-2.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    invalidateSearchRequest();
                    setPage(1);
                    if (mode === "all") {
                      submitSearchImmediately.current = true;
                      setRefreshKey((current) => current + 1);
                    }
                  }}
                  role="search"
                  aria-label="Search jobs"
                >
                  {/* Role / Keywords search */}
                  <div className="group flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-border/70 bg-secondary px-3 shadow-xs transition-all focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
                    <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) =>
                        updateFilter(
                          () => setQuery(event.target.value),
                          event.target.value !== query,
                        )
                      }
                      aria-label="Search roles"
                      placeholder="Role title, keywords, or company..."
                      className="h-full w-full bg-transparent text-base text-secondary-foreground outline-none placeholder:text-muted-foreground/60 md:text-sm"
                    />
                  </div>

                  {/* Location search */}
                  <div className="group hidden h-11 flex-1 items-center gap-2.5 rounded-lg border border-border/70 bg-secondary px-3 shadow-xs transition-all lg:flex focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
                    <MapPin aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <input
                      value={location}
                      onChange={(event) =>
                        updateFilter(
                          () => setLocation(event.target.value),
                          event.target.value !== location,
                        )
                      }
                      aria-label="Search by location"
                      placeholder="City, country, or remote..."
                      className="h-full w-full bg-transparent text-xs sm:text-sm text-secondary-foreground outline-none placeholder:text-muted-foreground/60"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="default"
                    className="hidden h-11 shrink-0 rounded-lg px-4 text-xs font-semibold shadow-xs lg:inline-flex"
                  >
                    Search
                  </Button>
                </form>
              </div>

              {/* Results count & active filters inline */}
              <div
                ref={resultsSummaryRef}
                id="results-summary"
                tabIndex={-1}
                className="flex flex-wrap items-center gap-3 pt-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center gap-2 text-xs">
                  {loading ? (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-primary motion-reduce:animate-none" />
                      Fetching roles...
                    </span>
                  ) : (
                    <>
                      {mode === "saved" && bookmarkError ? (
                        <span className="font-medium text-destructive">
                          Saved count unavailable
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
                    </>
                  )}
                </div>

                {mode === "saved" && bookmarks.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowClearSavedDialog(true)}
                    aria-label="Clear all saved roles from this browser"
                    className="min-h-11 rounded-lg px-3 text-xs text-muted-foreground hover:text-destructive lg:min-h-9"
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                    Clear saved
                  </Button>
                )}

                {/* Active filter badges inline */}
                {activeFilters.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
                    {activeFilters.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => removeFilter(filter.id)}
                        aria-label={`Remove ${filter.label} filter`}
                        className="group inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border/70 bg-secondary px-2.5 text-xs text-secondary-foreground transition-all hover:border-destructive/40 hover:bg-secondary/80 lg:min-h-6"
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
              <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {resultsAnnouncement}
              </p>
            </div>

            <main className="flex min-w-0 flex-1 flex-col px-4 pt-1 pb-[calc(4rem+env(safe-area-inset-bottom))] min-[480px]:px-5 sm:pt-1 md:mx-auto md:w-full md:max-w-3xl md:px-6 md:pb-8 lg:mx-0 lg:max-w-none">
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
              {visibleError && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-xs text-destructive"
                >
                  <span className="min-w-0 flex-1">{visibleError}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={retryLoading}
                      className="min-h-11 px-2 text-xs font-semibold text-destructive underline underline-offset-4 hover:text-destructive"
                    >
                      Retry
                    </Button>
                    {bookmarkError && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setShowClearSavedDialog(true)}
                        className="min-h-11 px-3 text-xs font-semibold"
                      >
                        Clear saved data…
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {jobs.map((job) => {
                const key = bookmarkKey(job);
                const isSaved = Number(job.is_bookmarked) === 1;
                const primaryUrl = job.apply_url || job.details_url;
                return (
                  <article
                    key={key}
                    className="relative flex min-w-0 flex-col justify-between [overflow-wrap:anywhere] rounded-xl border border-border/80 bg-secondary p-4 shadow-xs sm:flex-row sm:items-start sm:gap-6"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5">
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-secondary-foreground">
                          <Building2 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="break-words">{job.company_name || job.company_slug}</span>
                        </span>
                        <span aria-hidden="true" className="text-muted-foreground/60">·</span>
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold tracking-wide uppercase ${providerBadgeStyles[job.provider] || "border-border bg-muted text-muted-foreground"}`}>
                          {providerLabels[job.provider]}
                        </span>

                        {Number(job.is_available) !== 1 && (
                          <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
                            Expired
                          </span>
                        )}
                      </div>

                      <h2 className="break-words text-lg font-semibold leading-snug tracking-[-0.015em] text-foreground">
                        {job.title || "Untitled position"}
                      </h2>

                      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground">
                        {job.location_name && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin aria-hidden="true" className="size-3 shrink-0" />
                            <span className="break-words">{job.location_name}</span>
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
                          <summary className="flex min-h-11 cursor-pointer items-center gap-1.5 text-xs font-medium text-secondary-foreground hover:text-foreground select-none lg:min-h-9">
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
                        aria-label={`${isSaved ? "Remove saved role" : "Save role"}: ${job.title || "Untitled role"}${bookmarkError ? " (saving unavailable)" : ""}`}
                        aria-pressed={isSaved}
                        disabled={
                          !bookmarksReady ||
                          Boolean(bookmarkError) ||
                          busyJobs.has(key)
                        }
                        onClick={() => void toggleBookmark(job)}
                        className={`size-11 rounded-lg transition-all lg:size-9 ${
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
                          className="h-11 flex-1 gap-2 rounded-lg px-4 text-xs font-semibold shadow-xs hover:opacity-90 lg:h-9 lg:flex-none"
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
              {!loading && !visibleError && jobs.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-12 text-center">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                    {mode === "saved" ? (
                      <Bookmark aria-hidden="true" className="size-5" />
                    ) : (
                      <Search aria-hidden="true" className="size-5" />
                    )}
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">
                    {mode === "saved"
                      ? bookmarks.length === 0
                        ? "No bookmarks saved"
                        : "No saved roles match your search or filters"
                      : "No roles matched"}
                  </h3>
                  <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
                    {mode === "saved"
                      ? bookmarks.length === 0
                        ? "Saved roles live in this browser profile only; they are not synced or confidential."
                        : "Try a different search or clear your search and filters to see your saved roles."
                      : "Try loosening your keywords, locations, or platform filters to discover more open positions."}
                  </p>
                  {mode === "saved" && bookmarks.length === 0 && (
                    <Button
                      type="button"
                      variant="default"
                      onClick={() => changeMode("all")}
                      className="mt-5 min-h-11 rounded-lg px-4 text-xs font-semibold"
                    >
                      Explore roles
                    </Button>
                  )}
                  {mode === "saved" &&
                    bookmarks.length > 0 &&
                    activeFilters.length > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={clearSearchAndFilters}
                        className="mt-5 min-h-11 rounded-lg border border-border/70 bg-secondary px-4 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                      >
                        Clear search &amp; filters
                      </Button>
                    )}
                  {mode === "all" && activeFilters.length > 0 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={clearSearchAndFilters}
                      className="mt-5 min-h-11 rounded-lg border border-border/70 bg-secondary px-4 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 lg:min-h-9"
                    >
                      Clear search &amp; filters
                    </Button>
                  )}
                </div>
              )}

              {/* Skeleton loading */}
              {loading && jobs.length === 0 && (
                <div className="space-y-3.5" aria-hidden="true">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="space-y-3 rounded-xl border border-border/50 bg-secondary p-4">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-20 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
                        <div className="h-5 w-32 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
                      </div>
                      <div className="h-5 w-2/3 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
                      <div className="h-4 w-1/3 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
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
                  disabled={currentPage <= 1 || loading}
                  onClick={() => changePage(Math.max(1, currentPage - 1))}
                  className="min-h-11 gap-2 rounded-lg border border-border/70 bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-30 lg:min-h-9"
                >
                  <ArrowLeft aria-hidden="true" className="size-3.5" />
                  Previous
                </Button>

                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage >= totalPages || loading}
                  onClick={() => changePage(Math.min(totalPages, currentPage + 1))}
                  className="min-h-11 gap-2 rounded-lg border border-border/70 bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-30 lg:min-h-9"
                >
                  Next
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Button>
              </footer>
            )}
            </main>

            <nav
              aria-label="Job views"
              className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
            >
              <div className="mx-auto flex max-w-lg items-center justify-around gap-3 px-4 py-2">
                <Button
                  type="button"
                  variant={mode === "all" ? "secondary" : "ghost"}
                  onClick={() => changeMode("all")}
                  aria-current={mode === "all" ? "page" : undefined}
                  className="h-11 min-w-28 flex-1 flex-col gap-0.5 rounded-lg text-[11px]"
                >
                  <BriefcaseBusiness aria-hidden="true" className="size-4" />
                  Explore
                </Button>
                <Button
                  type="button"
                  variant={mode === "saved" ? "secondary" : "ghost"}
                  onClick={() => changeMode("saved")}
                  aria-current={mode === "saved" ? "page" : undefined}
                  aria-label={savedNavigationLabel}
                  className="h-11 min-w-28 flex-1 flex-col gap-0.5 rounded-lg text-[11px]"
                >
                  <span className="flex items-center gap-1.5">
                    <Bookmark aria-hidden="true" className="size-4" />
                    Saved
                    {bookmarksReady &&
                      !bookmarkError &&
                      bookmarks.length > 0 && (
                        <span className="tabular-nums">
                          {bookmarks.length > 99 ? "99+" : bookmarks.length}
                        </span>
                      )}
                  </span>
                </Button>
              </div>
            </nav>

            {/* Mobile Filter Sheet */}
            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" />
              <Dialog.Viewport className="fixed inset-0 z-50 flex items-end lg:hidden md:items-stretch md:justify-end md:p-4">
                <Dialog.Popup
                  id="job-filters"
                  aria-labelledby="filter-title"
                  className="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border/80 bg-background shadow-2xl outline-none md:h-full md:max-h-none md:w-[26rem] md:rounded-xl"
                >
                  <div className="flex items-center justify-between border-b border-border/60 px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]">
                    <div>
                      <Dialog.Title
                        id="filter-title"
                        className="text-sm font-semibold tracking-tight"
                      >
                        Filters
                      </Dialog.Title>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Adjust your search, then apply changes.
                      </p>
                    </div>
                    <Dialog.Close
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                        />
                      }
                    >
                      <X aria-hidden="true" className="size-4" />
                      <span className="sr-only">Close filters</span>
                    </Dialog.Close>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto p-5">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="mobile-location-filter"
                        className="block text-xs font-medium text-muted-foreground"
                      >
                        Location
                      </label>
                      <div className="flex h-11 items-center gap-2.5 rounded-lg border border-transparent bg-secondary px-3 text-base shadow-2xs">
                        <MapPin aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        <input
                          id="mobile-location-filter"
                          type="search"
                          value={filterDraft?.location ?? ""}
                          onChange={(event) =>
                            updateFilterDraft("location", event.target.value)
                          }
                          placeholder="City, country, or remote..."
                          className="w-full bg-transparent text-base text-secondary-foreground outline-none placeholder:text-muted-foreground/60"
                        />
                      </div>
                    </div>

                    <FilterCombobox
                      label="Platform"
                      value={filterDraft?.provider ?? provider}
                      onChange={(value) =>
                        updateFilterDraft("provider", value)
                      }
                      touchTargets
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
                      value={filterDraft?.employment ?? employment}
                      onChange={(value) =>
                        updateFilterDraft("employment", value)
                      }
                      touchTargets
                      options={employmentOptions}
                    />
                    <FilterCombobox
                      label="Workplace"
                      value={filterDraft?.workplace ?? workplace}
                      onChange={(value) =>
                        updateFilterDraft("workplace", value)
                      }
                      touchTargets
                      options={workplaceOptions}
                    />

                    <fieldset className="space-y-2">
                      <legend className="block text-xs font-medium text-muted-foreground">
                        Posted between
                      </legend>
                      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 lg:grid-cols-1">
                        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                          <span>After</span>
                          <input
                            aria-invalid={invalidFilterDraftDateRange}
                            aria-describedby={
                              invalidFilterDraftDateRange
                                ? "filter-date-range-error"
                                : undefined
                            }
                            type="date"
                            max={filterDraft?.postedBefore || undefined}
                            value={filterDraft?.postedAfter ?? postedAfter}
                            onChange={(event) =>
                              updateFilterDraft(
                                "postedAfter",
                                event.target.value,
                              )
                            }
                            className="h-11 w-full min-w-0 rounded-lg border border-transparent bg-secondary px-2 text-base font-medium text-secondary-foreground shadow-2xs outline-none transition-colors hover:bg-secondary/80 focus:ring-2 focus:ring-primary/20"
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                          <span>Before</span>
                          <input
                            aria-invalid={invalidFilterDraftDateRange}
                            aria-describedby={
                              invalidFilterDraftDateRange
                                ? "filter-date-range-error"
                                : undefined
                            }
                            type="date"
                            min={filterDraft?.postedAfter || undefined}
                            value={filterDraft?.postedBefore ?? postedBefore}
                            onChange={(event) =>
                              updateFilterDraft(
                                "postedBefore",
                                event.target.value,
                              )
                            }
                            className="h-11 w-full min-w-0 rounded-lg border border-transparent bg-secondary px-2 text-base font-medium text-secondary-foreground shadow-2xs outline-none transition-colors hover:bg-secondary/80 focus:ring-2 focus:ring-primary/20"
                          />
                        </label>
                      </div>
                      {invalidFilterDraftDateRange && (
                        <p
                          id="filter-date-range-error"
                          className="text-xs text-destructive"
                          role="alert"
                        >
                          The start date must be on or before the end date.
                        </p>
                      )}
                    </fieldset>

                    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg py-2 text-xs text-muted-foreground hover:text-foreground select-none">
                      <Checkbox
                        checked={filterDraft?.includeDescriptions ?? false}
                        onCheckedChange={(checked) =>
                          updateFilterDraft(
                            "includeDescriptions",
                            Boolean(checked),
                          )
                        }
                      />
                      <span>Search within description</span>
                    </label>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-border/60 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={!filterDraft || countFilters(filterDraft) === 0}
                      onClick={resetFilterDraft}
                      className="h-11 rounded-lg px-4 text-xs font-medium"
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      disabled={!filterDraft || invalidFilterDraftDateRange}
                      onClick={applyFilterDraft}
                      className="h-11 min-w-36 rounded-lg px-5 text-xs font-semibold shadow-sm"
                    >
                      Apply filters
                      {filterDraft && countFilters(filterDraft) > 0 && (
                        <span className="ml-1 tabular-nums">
                          ({countFilters(filterDraft)})
                        </span>
                      )}
                    </Button>
                  </div>
                </Dialog.Popup>
              </Dialog.Viewport>
            </Dialog.Portal>
          </Dialog.Root>
          <Dialog.Root
            open={showClearSavedDialog}
            onOpenChange={setShowClearSavedDialog}
          >
            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-[60] bg-foreground/30 backdrop-blur-sm" />
              <Dialog.Viewport className="fixed inset-0 z-[70] grid place-items-center p-4">
                <Dialog.Popup
                  role="alertdialog"
                  aria-labelledby="clear-saved-title"
                  aria-describedby="clear-saved-description"
                  className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-2xl outline-none"
                >
                  <Dialog.Title
                    id="clear-saved-title"
                    className="text-sm font-semibold"
                  >
                    Clear saved roles?
                  </Dialog.Title>
                  <p
                    id="clear-saved-description"
                    className="mt-2 text-sm leading-relaxed text-muted-foreground"
                  >
                    This removes every saved role from this browser profile and
                    cannot be undone.
                  </p>
                  <div className="mt-5 flex justify-end gap-2">
                    <Dialog.Close
                      render={
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-11 px-4 text-xs"
                        />
                      }
                    >
                      Cancel
                    </Dialog.Close>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={clearSavedData}
                      className="min-h-11 px-4 text-xs font-semibold"
                    >
                      Clear saved roles
                    </Button>
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
  touchTargets = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  touchTargets?: boolean;
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
          touchTargets={touchTargets}
          className={cn(
            "h-9 w-full rounded-lg border border-transparent bg-secondary px-2.5 text-xs font-medium text-secondary-foreground shadow-2xs transition-colors hover:bg-secondary/80 focus-within:ring-2 focus-within:ring-primary/20",
            touchTargets && "h-11 text-base",
          )}
        />
        <ComboboxContent className="z-50 min-w-[200px] rounded-lg border border-border bg-secondary p-1 shadow-md backdrop-blur-xl">
          <ComboboxEmpty className="py-2 text-center text-xs text-muted-foreground">
            No options found
          </ComboboxEmpty>
          <ComboboxList>
            {(opt) => (
              <ComboboxItem
                key={opt.value}
                value={opt}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-secondary-foreground transition-colors hover:bg-background/40 data-highlighted:bg-background/50",
                  touchTargets && "min-h-11",
                )}
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
