"use client";

// Onboarding: edit-job mirrors `add-job-dialog.tsx` but preserves the current
// job selection and sends updates to
// `app/(jobsyte-app)/(app)/projects/[id]/actions.ts`.
import { editJob } from "@/app/(jobsyte-app)/projects/[id]/actions";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CreatableCombobox,
  type ComboboxItem,
} from "@/components/projects/createable-combobox";
import {
  CompletedByCombobox,
  type CompletedByOption,
} from "@/components/jobs/completed-by-combobox";
import type { JobRow } from "@/components/jobs/jobs-table";
import { toast } from "sonner";
import { useCompany } from "@/lib/company-context";
import {
  addDismissedId,
  getDismissedIds,
  removeDismissedId,
} from "@/lib/dismissed-suggestions";

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toTitleCase(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";

  return normalized.replace(/[A-Za-z]+/g, (segment) => {
    return segment[0].toUpperCase() + segment.slice(1).toLowerCase();
  });
}

function normalizeName(value: string) {
  return toTitleCase(value);
}

function upsertOptions(
  prev: ComboboxItem[],
  nextOption: ComboboxItem,
): ComboboxItem[] {
  if (prev.some((p) => p.id === nextOption.id)) return prev;
  return [...prev, nextOption].sort((a, b) => a.name.localeCompare(b.name));
}

function toComboboxItem(value: string): ComboboxItem {
  const normalized = normalizeName(value);
  return { id: normalized.toLowerCase(), name: normalized };
}

function toOptions(values: Array<string | null>): ComboboxItem[] {
  const seen = new Set<string>();
  const options: ComboboxItem[] = [];

  for (const value of values) {
    const normalized = normalizeName(value ?? "");
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ id: key, name: normalized });
  }

  return options.sort((a, b) => a.name.localeCompare(b.name));
}

function centsToPriceInput(cents: number) {
  return (cents / 100).toFixed(2);
}

function parsePriceToCents(input: string) {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const numberValue = Number(cleaned);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  return Math.round(numberValue * 100);
}

function toPriceOption(cents: number): ComboboxItem {
  return {
    id: String(cents),
    name: centsToPriceInput(cents),
  };
}

type JobSeedRow = {
  title: string | null;
  superintendent: string | null;
  price_cents: number | null;
};

type EmployeeSeedRow = {
  id: string;
  name: string;
  company_id: string | null;
};

type CrewSeedRow = {
  id: string;
  name: string;
};

export function EditJobDialog({
  job,
  projectId,
  open,
  onOpenChange,
}: {
  job: JobRow;
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { activeCompany, companies } = useCompany();
  const activeCompanyId = activeCompany?.id ?? null;
  const companyNameById = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies],
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showUnassignedConfirm, setShowUnassignedConfirm] = useState(false);

  const [titleOptions, setTitleOptions] = useState<ComboboxItem[]>([]);
  const [priceOptions, setPriceOptions] = useState<ComboboxItem[]>([]);
  const [defaultPriceByTitleId, setDefaultPriceByTitleId] = useState<
    Record<string, ComboboxItem>
  >({});
  const [superintendentOptions, setSuperintendentOptions] = useState<
    ComboboxItem[]
  >([]);

  const [title, setTitle] = useState<ComboboxItem | null>(
    toComboboxItem(job.title),
  );
  const [selectedPrice, setSelectedPrice] = useState<ComboboxItem | null>(
    toPriceOption(job.price_cents),
  );
  const [price, setPrice] = useState(centsToPriceInput(job.price_cents));
  const [scheduled, setScheduled] = useState(job.scheduled_completion ?? "");
  const [superintendent, setSuperintendent] = useState<ComboboxItem | null>(
    job.superintendent ? toComboboxItem(job.superintendent) : null,
  );
  const [employees, setEmployees] = useState<CompletedByOption[]>([]);
  const [crews, setCrews] = useState<CrewSeedRow[]>([]);
  const [completedByValue, setCompletedByValue] = useState(() =>
    job.completed_by_type && job.completed_by_id
      ? `${job.completed_by_type}:${job.completed_by_id}`
      : "",
  );
  const canSubmit = Boolean(title?.name.trim() && price.trim());

  useEffect(() => {
    if (!open) return;
    if (!activeCompanyId) return;

    let isActive = true;

    (async () => {
      const [jobsRes, employeesRes, crewsRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("title, superintendent, price_cents")
          .eq("company_id", activeCompanyId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("employees")
          .select("id, name, company_id")
          .is("deleted_at", null)
          .order("company_id", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("crews")
          .select("id, name")
          .is("deleted_at", null)
          .order("name", { ascending: true }),
      ]);

      if (!isActive || !jobsRes.data) return;

      const rows = jobsRes.data as JobSeedRow[];
      const dismissedTitleIds = getDismissedIds(activeCompanyId, "job-title");
      const dismissedPriceIds = getDismissedIds(activeCompanyId, "job-price");
      const dismissedSuperintendentIds = getDismissedIds(
        activeCompanyId,
        "job-superintendent",
      );
      const currentTitleId = toComboboxItem(job.title).id;
      const currentPriceId = String(job.price_cents);
      const currentSuperintendentId = job.superintendent
        ? toComboboxItem(job.superintendent).id
        : null;
      const nextTitleOptions = toOptions(rows.map((row) => row.title)).filter(
        (option) =>
          option.id === currentTitleId || !dismissedTitleIds.has(option.id),
      );
      const nextSuperintendentOptions = toOptions(
        rows.map((row) => row.superintendent),
      ).filter(
        (option) =>
          option.id === currentSuperintendentId ||
          !dismissedSuperintendentIds.has(option.id),
      );

      const priceOptionMap = new Map<string, ComboboxItem>();
      const priceDefaultsByTitle: Record<string, ComboboxItem> = {};

      for (const row of rows) {
        if (typeof row.price_cents !== "number") continue;
        const option = toPriceOption(row.price_cents);
        if (
          option.id !== currentPriceId &&
          dismissedPriceIds.has(option.id)
        ) {
          continue;
        }
        if (!priceOptionMap.has(option.id)) {
          priceOptionMap.set(option.id, option);
        }

        const titleOption = toComboboxItem(row.title ?? "");
        if (!titleOption.name) continue;
        if (
          titleOption.id !== currentTitleId &&
          dismissedTitleIds.has(titleOption.id)
        ) {
          continue;
        }
        if (!priceDefaultsByTitle[titleOption.id]) {
          priceDefaultsByTitle[titleOption.id] = option;
        }
      }

      const nextPriceOptions = Array.from(priceOptionMap.values()).sort(
        (a, b) => Number(a.id) - Number(b.id),
      );

      setTitleOptions(nextTitleOptions);
      setPriceOptions(nextPriceOptions);
      setDefaultPriceByTitleId(priceDefaultsByTitle);
      setSuperintendentOptions(nextSuperintendentOptions);
      setEmployees(
        ((employeesRes.data ?? []) as EmployeeSeedRow[]).map((employee) => ({
          id: employee.id,
          name: employee.name,
          companyId: employee.company_id,
          companyName: employee.company_id
            ? companyNameById.get(employee.company_id) ?? null
            : null,
        })),
      );
      setCrews((crewsRes.data ?? []) as CrewSeedRow[]);
    })();

    return () => {
      isActive = false;
    };
  }, [open, supabase, activeCompanyId, companyNameById]);

  async function createTitle(name: string) {
    const option = toComboboxItem(name);
    removeDismissedId(activeCompanyId, "job-title", option.id);
    setTitleOptions((prev) => upsertOptions(prev, option));
    return option;
  }

  async function createSuperintendent(name: string) {
    const option = toComboboxItem(name);
    removeDismissedId(activeCompanyId, "job-superintendent", option.id);
    setSuperintendentOptions((prev) => upsertOptions(prev, option));
    return option;
  }

  async function createPrice(value: string) {
    const cents = parsePriceToCents(value);
    if (cents === null) throw new Error("Enter a valid price.");

    const option = toPriceOption(cents);
    removeDismissedId(activeCompanyId, "job-price", option.id);
    setPriceOptions((prev) => upsertOptions(prev, option));
    setPrice(option.name);
    setSelectedPrice(option);
    return option;
  }

  function handleTitleChange(nextTitle: ComboboxItem | null) {
    setTitle(nextTitle);
    if (!nextTitle) return;

    const defaultPrice = defaultPriceByTitleId[nextTitle.id];
    if (!defaultPrice) return;

    setSelectedPrice(defaultPrice);
    setPrice(defaultPrice.name);
  }

  function handlePriceChange(nextPrice: ComboboxItem | null) {
    setSelectedPrice(nextPrice);
    setPrice(nextPrice?.name ?? "");
  }

  function submit(forceUnassigned = false) {
    setError(null);

    const [completedByType, completedById] = completedByValue.split(":");
    const hasAssignee = Boolean(completedByType && completedById);

    if (!hasAssignee && !forceUnassigned) {
      setShowUnassignedConfirm(true);
      return;
    }

    const completedByName = hasAssignee
      ? completedByType === "crew"
        ? crews.find((crew) => crew.id === completedById)?.name ?? ""
        : employees.find((employee) => employee.id === completedById)?.name ?? ""
      : "";

    const fd = new FormData();
    fd.set("job_id", job.id);
    fd.set("title", toTitleCase(title?.name ?? ""));
    fd.set("price", price);
    fd.set("scheduled_completion", scheduled);
    fd.set("superintendent", toTitleCase(superintendent?.name ?? ""));
    fd.set("completed_by_type", hasAssignee ? completedByType : "");
    fd.set("completed_by_id", hasAssignee ? completedById : "");
    fd.set("completed_by_name", hasAssignee ? completedByName : "");

    startTransition(async () => {
      const res = await editJob(fd);
      if (!res.ok) {
        const message = res.message || "Failed to edit job.";
        setError(message);
        toast.error(message);
        return;
      }
      toast.success("Job updated successfully.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Job</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (isPending || !canSubmit) return;
            submit();
          }}
        >
          <CreatableCombobox
            label="Job Title"
            placeholder="Select or create job title..."
            items={titleOptions}
            value={title}
            onChange={handleTitleChange}
            onCreate={createTitle}
            onDelete={(item) => {
              addDismissedId(activeCompanyId, "job-title", item.id);
              setTitleOptions((prev) =>
                prev.filter((entry) => entry.id !== item.id),
              );
              setDefaultPriceByTitleId((prev) => {
                const next = { ...prev };
                delete next[item.id];
                return next;
              });
            }}
          />

          <div className="space-y-2">
            <CreatableCombobox
              label="Job Price"
              placeholder="Select or create project price..."
              items={priceOptions}
              value={selectedPrice}
              onChange={handlePriceChange}
              onCreate={createPrice}
              onDelete={(item) => {
                addDismissedId(activeCompanyId, "job-price", item.id);
                setPriceOptions((prev) =>
                  prev.filter((entry) => entry.id !== item.id),
                );
              }}
            />
            <p className="text-xs text-muted-foreground">
              Prices are suggested from all projects in this company.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">
              Scheduled Completion (Optional)
            </div>
            <DatePicker
              value={scheduled}
              onChange={setScheduled}
              placeholder="Pick a completion date"
            />
          </div>

          <div className="space-y-2">
            <CompletedByCombobox
              value={completedByValue}
              onChange={setCompletedByValue}
              employees={employees}
              crews={crews}
              helperText="Assigning this job keeps payroll records linked to the right person or crew."
            />
          </div>

          <div className="space-y-2">
            <CreatableCombobox
              label="Superintendent / General Contractor (Optional)"
              placeholder="Select or create contractor name..."
              items={superintendentOptions}
              value={superintendent}
              onChange={setSuperintendent}
              onCreate={createSuperintendent}
              onDelete={(item) => {
                addDismissedId(activeCompanyId, "job-superintendent", item.id);
                setSuperintendentOptions((prev) =>
                  prev.filter((entry) => entry.id !== item.id),
                );
              }}
            />
            {superintendent && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-muted-foreground hover:text-foreground"
                onClick={() => setSuperintendent(null)}
              >
                Clear contractor
              </Button>
            )}
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !canSubmit}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
      </Dialog>

      <AlertDialog
        open={showUnassignedConfirm}
        onOpenChange={setShowUnassignedConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No one is assigned to this job</AlertDialogTitle>
            <AlertDialogDescription>
              This job has no employee or crew assigned. Do you want to
              continue and save it as unassigned?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={() => submit(true)}
            >
              {isPending ? "Saving..." : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
