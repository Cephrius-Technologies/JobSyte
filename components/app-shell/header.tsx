"use client";

// Onboarding: this header owns global search, mobile navigation controls, and
// account actions. Search suggestions come from `app/api/search/suggest/route.ts`,
// while persistent recent searches live in `components/search/recent-searches.tsx`.
import Link from "next/link";
import {
  Briefcase,
  Calculator,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  FolderKanban,
  LogOutIcon,
  Plus,
  Search,
  DollarSign,
  Receipt,
  Users,
  UserRound,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBreadcrumbs } from "./breadcrumb-context";
import { createClient } from "@/lib/supabase/client";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { cn } from "@/lib/utils";
import { useSidebarState } from "./sidebar-state";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { MobileSidebar } from "./mobile-sidebar";

type SuggestionType = "project" | "job" | "invoice" | "accounting" | "employee" | "crew" | "payment" | "expense";

type SearchSuggestion = {
  id: string;
  type: SuggestionType;
  title: string;
  subtitle: string | null;
  href: string;
};

const PROJECT_STORAGE_KEYS_TO_CLEAR_ON_SIGN_OUT = [
  "projects:selected-project-id",
  "projects:expanded-subdivisions",
  "projects:expanded-builders",
];

function suggestionTypeLabel(type: SuggestionType) {
  if (type === "project") return "Project";
  if (type === "job") return "Job";
  if (type === "invoice") return "Invoice";
  if (type === "accounting") return "Accounting";
  if (type === "employee") return "Employee";
  if (type === "crew") return "Crew";
  if (type === "payment") return "Payment";
  if (type === "expense") return "Expense";
  else return "No suggestions found...";
}

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function splitAddressFromQuery(value: string) {
  const normalized = normalizeQuery(value);
  if (!normalized) return { houseNumber: "", streetAddress: "" };

  // Handles: "13104Steel Road" -> "13104" + "Steel Road"
  const compactMatch = normalized.match(/^(\d+)\s*([A-Za-z].*)$/);
  if (compactMatch) {
    return {
      houseNumber: compactMatch[1],
      streetAddress: compactMatch[2].trim(),
    };
  }

  const [firstPart, ...restParts] = normalized.split(" ");
  if (/^\d+$/.test(firstPart)) {
    return {
      houseNumber: firstPart,
      streetAddress: restParts.join(" "),
    };
  }

  return { houseNumber: "", streetAddress: normalized };
}

function formatProjectQueryPreview(value: string) {
  const { houseNumber, streetAddress } = splitAddressFromQuery(value);
  if (houseNumber && streetAddress) {
    return `${houseNumber} ${streetAddress}`;
  }
  if (houseNumber) return houseNumber;
  return normalizeQuery(value);
}

export function Header() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { crumbs, rightSlot } = useBreadcrumbs();
  const { collapsed, toggleCollapsed } = useSidebarState();
  const currentQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(currentQuery);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectSeed, setNewProjectSeed] = useState(0);
  const [newProjectHouseNumber, setNewProjectHouseNumber] = useState("");
  const [newProjectStreetAddress, setNewProjectStreetAddress] = useState("");
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(currentQuery);
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
    setIsSearchFocused(false);
  }, [pathname, currentQuery]);

  useEffect(() => {
    function handleOutsideMouseDown(event: MouseEvent) {
      if (!searchContainerRef.current) return;
      if (searchContainerRef.current.contains(event.target as Node)) return;
      setIsSearchFocused(false);
      setActiveSuggestionIndex(-1);
    }

    document.addEventListener("mousedown", handleOutsideMouseDown);
    return () =>
      document.removeEventListener("mousedown", handleOutsideMouseDown);
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      setActiveSuggestionIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const response = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(normalized)}`,
          {
            method: "GET",
            signal: controller.signal,
            cache: "no-store",
          },
        );

        if (!response.ok) {
          setSuggestions([]);
          setActiveSuggestionIndex(-1);
          return;
        }

        const payload = (await response.json()) as {
          suggestions?: SearchSuggestion[];
        };
        const nextSuggestions = Array.isArray(payload.suggestions)
          ? payload.suggestions
          : [];

        setSuggestions(nextSuggestions);
        setActiveSuggestionIndex(-1);
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") {
          setSuggestions([]);
          setActiveSuggestionIndex(-1);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSuggestions(false);
        }
      }
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  const handleSignOut = async () => {
    for (const key of PROJECT_STORAGE_KEYS_TO_CLEAR_ON_SIGN_OUT) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  function selectSuggestion(suggestion: SearchSuggestion) {
    setIsSearchFocused(false);
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
    router.push(suggestion.href);
  }

  function openNewProjectFromQuery(rawQuery: string) {
    const { houseNumber, streetAddress } = splitAddressFromQuery(rawQuery);

    setNewProjectHouseNumber(houseNumber);
    setNewProjectStreetAddress(streetAddress);
    setNewProjectSeed((current) => current + 1);
    setNewProjectOpen(true);
    setIsSearchFocused(false);
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    const canCreateProject = query.trim().length >= 2;
    const optionCount = suggestions.length + (canCreateProject ? 1 : 0);
    const canNavigate = isSearchFocused && optionCount > 0;
    if (!canNavigate) {
      if (event.key === "Escape") {
        setIsSearchFocused(false);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((current) => {
        if (current < 0) return 0;
        return (current + 1) % optionCount;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((current) => {
        if (current < 0) return optionCount - 1;
        return current === 0 ? optionCount - 1 : current - 1;
      });
      return;
    }

    if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      if (activeSuggestionIndex < suggestions.length) {
        const selected = suggestions[activeSuggestionIndex];
        if (selected) selectSuggestion(selected);
        return;
      }
      if (canCreateProject) {
        openNewProjectFromQuery(query);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsSearchFocused(false);
      setActiveSuggestionIndex(-1);
    }
  }

  const handleGlobalSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = query.trim();
    setIsSearchFocused(false);
    setActiveSuggestionIndex(-1);

    if (!normalized) {
      router.push("/search");
      return;
    }
    router.push(`/search?q=${encodeURIComponent(normalized)}`);
  };

  const showSuggestions = isSearchFocused && query.trim().length >= 2;
  const canCreateProject = query.trim().length >= 2;
  const suggestionsTransitionKey = isLoadingSuggestions
    ? "loading"
    : suggestions.length === 0
      ? `empty-${query.trim().toLowerCase()}`
      : `results-${suggestions.map((suggestion) => `${suggestion.type}:${suggestion.id}`).join("|")}`;

  return (
    <header
      data-app-shell-header
      className="sticky top-2 z-40 mx-2 mt-2 shrink-0 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur supports-backdrop-filter:bg-card/90 sm:px-6"
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3 md:grid-cols-[minmax(0,1fr)_minmax(10rem,24rem)_auto]">
        <div className="hidden min-w-0 items-center gap-2 md:flex">
          {/* Dashboard Collapse Component */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 cursor-pointer"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight className="size-4" />
            ) : (
              <ChevronsLeft className="size-4" />
            )}
          </Button>

          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm text-muted-foreground">
            {crumbs.map((c, idx) => {
              const isLast = idx === crumbs.length - 1;
              return (
                <div
                  key={`${c.label}-${idx}`}
                  className="flex min-w-0 items-center gap-2"
                >
                  {c.href && !isLast ? (
                    <Link
                      className="max-w-[12rem] truncate hover:text-primary hover:underline"
                      href={c.href}
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span
                      aria-current={isLast ? "page" : undefined}
                      className={cn(
                        "max-w-[12rem] truncate",
                        isLast
                          ? "font-medium text-foreground"
                          : "text-muted-foreground",
                      )}
                      title={c.label}
                    >
                      {c.label}
                    </span>
                  )}
                  {!isLast && <span aria-hidden="true">/</span>}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="col-start-1 row-start-1 flex w-full min-w-0 items-center gap-2 md:col-start-2 md:justify-self-center md:max-w-[30rem] lg:max-w-[34rem] xl:max-w-[40rem]">
          <div className="md:hidden shrink-0">
            <MobileSidebar />
          </div>
          <form
            onSubmit={handleGlobalSearch}
            className="flex w-full min-w-0 items-center gap-2"
          >
          <div
            className="relative min-w-0 flex-1"
            ref={searchContainerRef}
          >
            {/* Search Bar Component */}
            <Input
              name="q"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setIsSearchFocused(true);
                setActiveSuggestionIndex(-1);
              }}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search projects, jobs, invoices, employees and more..."
              className="h-9 text-xs placeholder:text-xs sm:text-sm sm:placeholder:text-sm border-border focus-visible:ring-primary/30"
              aria-label="Global search"
              autoComplete="off"
            />

            {showSuggestions && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-background shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150">
                <div
                  key={suggestionsTransitionKey}
                  className="animate-in fade-in-0 slide-in-from-top-1 duration-200"
                >
                  {isLoadingSuggestions ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground animate-pulse">
                      Searching...
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No matches found.
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto py-1">
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          className={cn(
                            "flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm transition-colors",
                            activeSuggestionIndex === index
                              ? "bg-primary/10"
                              : "hover:bg-muted/50",
                          )}
                          onClick={() => selectSuggestion(suggestion)}
                        >
                          <div className="flex min-w-0 items-start gap-2">
                            {suggestion.type === "project" && (
                              <FolderKanban className="mt-0.5 size-4 shrink-0 text-primary" />
                            )}
                            {suggestion.type === "job" && (
                              <Briefcase className="mt-0.5 size-4 shrink-0 text-primary" />
                            )}
                            {suggestion.type === "invoice" && (
                              <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                            )}
                            {suggestion.type === "accounting" && (
                              <Calculator className="mt-0.5 size-4 shrink-0 text-primary" />
                            )}
                            {suggestion.type === "employee" && (
                              <UserRound className="mt-0.5 size-4 shrink-0 text-primary" />
                            )}
                            {suggestion.type === "crew" && (
                              <Users className="mt-0.5 size-4 shrink-0 text-primary" />
                            )}
                            {suggestion.type === "payment" && (
                              <DollarSign className="mt-0.5 size-4 shrink-0 text-primary" />
                            )}
                            {suggestion.type === "expense" && (
                              <Receipt className="mt-0.5 size-4 shrink-0 text-primary" />
                            )}
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {suggestion.title}
                              </div>
                              {suggestion.subtitle && (
                                <div className="truncate text-xs text-muted-foreground">
                                  {suggestion.subtitle}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="rounded border border-border bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                            {suggestionTypeLabel(suggestion.type)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {canCreateProject && (
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-start justify-between gap-3 border-t border-border px-3 py-2 text-left text-sm transition-colors",
                      activeSuggestionIndex === suggestions.length
                        ? "bg-primary/10"
                        : "hover:bg-muted/50",
                    )}
                    onClick={() => openNewProjectFromQuery(query)}
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <Plus className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          Create New Project
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          Prefill from: {formatProjectQueryPreview(query)}
                        </div>
                      </div>
                    </div>
                    <div className="rounded border border-border  bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                      Action
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
          <Button
            type="submit"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 cursor-pointer border-border hover:bg-muted"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Button>
        </form>        </div>
        <div className="col-start-2 row-start-1 ml-auto flex min-w-0 items-center justify-end gap-2 md:col-start-3">
          <div className="hidden min-w-0 max-w-[16rem] overflow-hidden lg:block">
            {rightSlot}
          </div>
          <div className="hidden lg:block">
            <ThemeSwitcher />
          </div>
          <Button
            variant="destructive"
            size="icon"
            className="cursor-pointer lg:hidden"
            aria-label="Sign out"
            onClick={handleSignOut}
          >
            <LogOutIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            className="hidden cursor-pointer lg:inline-flex"
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </div>
      </div>

      <NewProjectDialog
        key={`header-new-project-${newProjectSeed}`}
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        initialBuilders={[]}
        initialSubdivisions={[]}
        initialHouseNumber={newProjectHouseNumber}
        initialStreetAddress={newProjectStreetAddress}
      />
    </header>
  );
}
