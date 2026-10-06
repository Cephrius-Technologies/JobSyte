"use client";

import { useEffect, useState } from "react";
import { Bug, ChevronDown, History, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  LATEST_RELEASE,
  RELEASE_NOTES,
  type ReleaseNote,
} from "@/lib/release-notes";

const LAST_SEEN_RELEASE_KEY = "jobsyte:last-seen-release-version";
const SUMMARY_COUNT = 2;

type Category = "features" | "fixes";

function CategorySection({
  category,
  items,
}: {
  category: Category;
  items: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const isFeatures = category === "features";
  const title = isFeatures ? "Features" : "Bug Fixes";
  const Icon = isFeatures ? Sparkles : Bug;
  const headerAccent = isFeatures
    ? "text-primary"
    : "text-amber-700 dark:text-amber-400";
  const bulletAccent = isFeatures
    ? "bg-primary"
    : "bg-amber-500 dark:bg-amber-400";
  const countAccent = isFeatures
    ? "bg-primary/10 text-primary"
    : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";

  const summary = items.slice(0, SUMMARY_COUNT);
  const rest = items.slice(SUMMARY_COUNT);
  const shown = expanded ? items : summary;

  return (
    <div className="space-y-1.5 sm:space-y-2">
      <div
        className={cn(
          "flex items-center gap-1.5 text-[12px] sm:text-[13px] font-semibold tracking-tight",
          headerAccent,
        )}
      >
        <Icon className="size-3.5 shrink-0" />
        <span>{title}</span>
        <span
          className={cn(
            "rounded-full px-1.5 py-[1px] text-[10px] font-semibold tabular-nums",
            countAccent,
          )}
        >
          {items.length}
        </span>
      </div>
      <ul className="space-y-1 pl-0.5">
        {shown.map((item) => (
          <li
            key={item}
            className="flex gap-2 text-[12px] sm:text-[13px] leading-snug text-foreground/80"
          >
            <span
              className={cn(
                "mt-[6px] sm:mt-[7px] size-1.5 shrink-0 rounded-full",
                bulletAccent,
              )}
            />
            <span className="break-words">{item}</span>
          </li>
        ))}
      </ul>
      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-3.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition hover:text-primary"
        >
          <ChevronDown
            className={cn(
              "size-3 transition-transform",
              expanded && "rotate-180",
            )}
          />
          {expanded
            ? "Hide developer details"
            : `See more (${rest.length} developer detail${rest.length === 1 ? "" : "s"})`}
        </button>
      )}
    </div>
  );
}

function ReleaseCard({
  release,
  latest = false,
}: {
  release: ReleaseNote;
  latest?: boolean;
}) {
  const features = [...(release.majorAdditions ?? []), ...release.changes];
  const fixes = release.bugFixes;

  return (
    <section
      className={cn(
        "rounded-lg border p-3 sm:p-3.5",
        latest
          ? "border-border bg-primary/5 dark:bg-primary/10"
          : "border-border bg-muted/30 dark:bg-muted/10",
      )}
    >
      <div className="mb-2.5 sm:mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] sm:text-base font-semibold text-foreground">
            {release.version}
          </span>
          {latest && (
            <Badge className="h-4 bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              Latest
            </Badge>
          )}
        </div>
        <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {release.releasedOn}
        </span>
      </div>

      <div className="space-y-2.5 sm:space-y-3">
        <CategorySection category="features" items={features} />
        <CategorySection category="fixes" items={fixes} />
        {features.length === 0 && fixes.length === 0 && (
          <div className="text-xs italic text-muted-foreground">
            No notable changes in this release.
          </div>
        )}
      </div>
    </section>
  );
}

export function VersionChangelogDialog({ collapsed }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const previousReleases = RELEASE_NOTES.slice(1);

  useEffect(() => {
    try {
      const lastSeenVersion = window.localStorage.getItem(
        LAST_SEEN_RELEASE_KEY,
      );
      if (lastSeenVersion === LATEST_RELEASE.version) return;

      window.localStorage.setItem(
        LAST_SEEN_RELEASE_KEY,
        LATEST_RELEASE.version,
      );
      const timer = window.setTimeout(() => setOpen(true), 500);
      return () => window.clearTimeout(timer);
    } catch {
      // Ignore storage errors and keep default closed state.
    }
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;

    try {
      window.localStorage.setItem(
        LAST_SEEN_RELEASE_KEY,
        LATEST_RELEASE.version,
      );
    } catch {
      // Ignore storage errors.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "cursor-pointer rounded-md px-1 py-0.5 transition bg-gray-500 text-white hover:bg-primary/80 hover:text-primary-foreground",
            collapsed && "mx-auto",
          )}
          aria-label={`Open release notes (${LATEST_RELEASE.version})`}
        >
          {LATEST_RELEASE.version}
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[92dvh] sm:max-h-[85dvh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-[560px] sm:max-w-[560px] gap-0 overflow-hidden p-0 bg-card grid-rows-[auto_minmax(0,1fr)]">
        <DialogHeader className="border-b border-border bg-muted/40 dark:bg-muted/20 px-3 py-2.5 pr-10 sm:px-4 sm:py-3 sm:pr-12 text-left">
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-primary">
            <History className="size-3" />
            Release Notes
          </div>
          <DialogTitle className="text-[15px] sm:text-base font-semibold tracking-tight">
            What&apos;s New in JobSyte
          </DialogTitle>
          <DialogDescription className="text-[11px] sm:text-xs leading-snug">
            A quick look at what&apos;s new. Tap &ldquo;See more&rdquo; for the
            full developer-level breakdown.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 h-full">
          <div className="space-y-2.5 sm:space-y-3 p-3 pb-5 sm:p-4 sm:pb-6">
            <ReleaseCard release={LATEST_RELEASE} latest />

            {previousReleases.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Previous Versions
                </div>
                {previousReleases.map((release) => (
                  <ReleaseCard key={release.version} release={release} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
