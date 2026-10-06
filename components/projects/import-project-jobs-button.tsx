"use client";

// Onboarding: bulk project/job import UI. Parsing and writes happen in
// `app/(jobsyte-app)/(app)/projects/actions.ts`; this component only handles
// file selection, preview state, and user confirmation.
import { useRef, useState, useTransition } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { importProjectsJobsCsv } from "@/app/(jobsyte-app)/projects/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ImportPreviewProject = {
  projectAddress: string;
  builderName: string;
  subdivisionName: string;
  isNew: boolean;
  jobs: {
    title: string;
    priceCents: number;
    scheduledCompletion: string | null;
    superintendent: string | null;
    isDuplicate: boolean;
  }[];
};

type ImportSummary = {
  dryRun: boolean;
  rowsRead: number;
  buildersCreated: number;
  subdivisionsCreated: number;
  projectsCreated: number;
  jobsCreated: number;
  jobsSkippedDuplicate: number;
  rowsSkippedInvalid: number;
  rowErrors: string[];
  preview: ImportPreviewProject[];
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatScheduled(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ImportProjectJobsButton({
  className,
}: {
  className?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [defaultBuilder, setDefaultBuilder] = useState("");
  const [defaultSubdivision, setDefaultSubdivision] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);

  // Two-phase flow: validate first (dry run), then confirm or reupload.
  // `summary?.dryRun === true` means we are in the preview phase.
  const inPreview = summary?.dryRun === true;

  function resetForm() {
    setFile(null);
    setDefaultBuilder("");
    setDefaultSubdivision("");
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function clearForReupload() {
    // Keep the selected file and defaults so the user can tweak inputs and
    // re-validate without picking the file again.
    setSummary(null);
  }

  function runImport(dryRun: boolean) {
    if (!file) {
      toast.error("Select a CSV file first.");
      return;
    }

    const fd = new FormData();
    fd.set("file", file);
    if (defaultBuilder.trim()) fd.set("default_builder", defaultBuilder.trim());
    if (defaultSubdivision.trim()) {
      fd.set("default_subdivision", defaultSubdivision.trim());
    }
    fd.set("dry_run", dryRun ? "true" : "false");

    startTransition(async () => {
      const result = await importProjectsJobsCsv(fd);
      if (!result.ok) {
        toast.error(result.message || "Import failed.");
        return;
      }

      setSummary(result.summary);
      if (result.summary.dryRun) {
        toast.success("Preview ready. Review the summary, then confirm or reupload.");
      } else {
        toast.success("Import complete.");
        router.refresh();
        setOpen(false);
        resetForm();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen && !isPending) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("gap-2", className)}
        >
          <Upload className="size-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Projects and Jobs</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a CSV of projects and jobs. Column headers can be in any
            format — the importer will sort the fields automatically. We&apos;ll
            preview the results first so you can confirm before anything is
            saved.
          </p>

          <div className="space-y-2">
            <Label htmlFor="projects-jobs-import-file">CSV File</Label>
            {/* Hide the native file input and present a styled drop zone /
                pill instead so the picker matches the rest of the UI. */}
            <Input
              id="projects-jobs-import-file"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              disabled={isPending}
              className="sr-only"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setFile(nextFile);
                setSummary(null);
              }}
            />
            {file ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-primary/5 px-3 py-2.5 text-sm">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                    <FileSpreadsheet className="size-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB · Ready to import
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 cursor-pointer"
                    disabled={isPending}
                    onClick={() => fileRef.current?.click()}
                  >
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 cursor-pointer text-muted-foreground hover:text-destructive"
                    disabled={isPending}
                    aria-label="Remove file"
                    onClick={() => {
                      setFile(null);
                      setSummary(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={() => fileRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!isPending) setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  if (isPending) return;
                  const dropped = event.dataTransfer.files?.[0] ?? null;
                  if (!dropped) return;
                  const isCsv =
                    dropped.type === "text/csv" ||
                    dropped.name.toLowerCase().endsWith(".csv");
                  if (!isCsv) {
                    toast.error("Please drop a CSV file.");
                    return;
                  }
                  setFile(dropped);
                  setSummary(null);
                }}
                className={cn(
                  "group relative flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 px-4 py-8 text-center transition-colors",
                  "hover:border-primary/60 hover:bg-muted/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  isDragging && "border-primary bg-primary/10",
                )}
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-105">
                  <Upload className="size-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">
                    <span className="text-primary">Click to choose a file</span>{" "}
                    <span className="text-muted-foreground">or drag and drop</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    CSV files only · Max 10MB
                  </div>
                </div>
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="projects-jobs-default-builder">
                Default Builder (Optional)
              </Label>
              <Input
                id="projects-jobs-default-builder"
                value={defaultBuilder}
                onChange={(event) => setDefaultBuilder(event.target.value)}
                placeholder="Acme Homes"
                disabled={isPending || inPreview}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projects-jobs-default-subdivision">
                Default Subdivision (Optional)
              </Label>
              <Input
                id="projects-jobs-default-subdivision"
                value={defaultSubdivision}
                onChange={(event) => setDefaultSubdivision(event.target.value)}
                placeholder="North Ridge"
                disabled={isPending || inPreview}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {inPreview ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={isPending}
                  onClick={clearForReupload}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={isPending || (summary?.jobsCreated ?? 0) === 0}
                  onClick={() => runImport(false)}
                >
                  {isPending ? "Importing..." : "Confirm Import"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={isPending}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={isPending || !file}
                  onClick={() => runImport(true)}
                >
                  {isPending ? "Validating..." : "Validate & Preview"}
                </Button>
              </>
            )}
          </div>

          {summary && (
            <Card className="space-y-3 p-4">
              <div className="text-sm font-medium">
                {summary.dryRun ? "Preview Summary" : "Import Summary"}
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>Rows read: {summary.rowsRead}</div>
                <div>Builders created: {summary.buildersCreated}</div>
                <div>Subdivisions created: {summary.subdivisionsCreated}</div>
                <div>Projects created: {summary.projectsCreated}</div>
                <div>Jobs created: {summary.jobsCreated}</div>
                <div>Duplicates skipped: {summary.jobsSkippedDuplicate}</div>
                <div>Rows with problems: {summary.rowsSkippedInvalid}</div>
              </div>

              {summary.dryRun && summary.preview.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">
                    Projects and Jobs to Import
                  </div>
                  <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border p-3 text-sm">
                    {summary.preview.map((project) => (
                      <div
                        key={`${project.projectAddress}-${project.builderName}-${project.subdivisionName}`}
                        className="space-y-1"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {project.projectAddress}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs",
                              project.isNew
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {project.isNew ? "New project" : "Existing project"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {project.builderName} · {project.subdivisionName}
                        </div>
                        <ul className="ml-4 list-disc space-y-0.5">
                          {project.jobs.map((job, idx) => (
                            <li
                              key={`${project.projectAddress}-${job.title}-${idx}`}
                              className={cn(
                                "text-sm",
                                job.isDuplicate && "text-muted-foreground",
                              )}
                            >
                              <span className="font-medium">{job.title}</span>
                              {" — "}
                              {formatPrice(job.priceCents)}
                              {" · "}
                              {formatScheduled(job.scheduledCompletion)}
                              {job.superintendent && ` · ${job.superintendent}`}
                              {job.isDuplicate && " (already exists)"}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary.rowErrors.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-destructive">
                    Rows we couldn&apos;t import
                  </div>
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
                    {summary.rowErrors.map((message) => (
                      <div key={message} className="wrap-break-word text-destructive">
                        {message}
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Fix these rows in your file and reupload, or continue and
                    only the valid rows will be imported.
                  </div>
                </div>
              )}

              {summary.dryRun && (summary.jobsCreated ?? 0) === 0 && (
                <div className="text-xs text-muted-foreground">
                  Nothing to import. Adjust the CSV and reupload.
                </div>
              )}
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
