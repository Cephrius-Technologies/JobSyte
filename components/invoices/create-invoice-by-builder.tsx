"use client";

// Onboarding: builder-scoped invoice wizard. It queries eligible jobs client-side
// for interactive selection, then calls `createInvoiceForBuilder` in
// `app/(jobsyte-app)/(app)/invoices/actions.ts`.
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { createInvoiceForBuilder } from "@/app/(jobsyte-app)/invoices/actions";
import { cn } from "@/lib/utils";
import { suggestDueDate } from "@/lib/settings/preferences";
import {
  CreatableCombobox,
  type ComboboxItem,
} from "../projects/createable-combobox";

type Contractor = { company_name: string; address: string; phone: string };

type Builder = { id: string; name: string };

type ContractorPreset = {
  id: string;
  name: string;
  address: string;
  phone: string;
};

type BillToPreset = {
  id: string;
  name: string;
  address: string;
  email?: string;
};

type EligibleJob = {
  id: string;
  title: string;
  price_cents: number;
  project_id: string;
  project_address: string;
  subdivision: string | null;
};

type InvoicedItemRow = { job_id: string | null };

const CONTRACTOR_PRESETS_STORAGE_KEY = "invoice:contractor-presets";
const BILL_TO_PRESETS_STORAGE_KEY = "invoice:bill-to-presets";

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function makePresetId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readStorageArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function CreateInvoiceByBuilder({
  builders,
  initialContractor,
  defaultDueDays,
}: {
  builders: Builder[];
  initialContractor: Contractor;
  defaultDueDays: number;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [builder, setBuilder] = useState<ComboboxItem | null>(null);

  const [contractorName, setContractorName] = useState(
    initialContractor.company_name,
  );
  const [contractorAddress, setContractorAddress] = useState(
    initialContractor.address,
  );
  const [contractorPhone, setContractorPhone] = useState(
    initialContractor.phone,
  );

  const [billToName, setBillToName] = useState("");
  const [billToAddress, setBillToAddress] = useState("");
  const [billToEmail, setBillToEmail] = useState("");
  const [contractorPresets, setContractorPresets] = useState<
    ContractorPreset[]
  >([]);
  const [billToPresets, setBillToPresets] = useState<BillToPreset[]>([]);
  const [selectedContractorPreset, setSelectedContractorPreset] =
    useState<ComboboxItem | null>(null);
  const [selectedBillToPreset, setSelectedBillToPreset] =
    useState<ComboboxItem | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState(
    suggestDueDate(today, defaultDueDays) ?? "",
  );
  const [dueDateManuallyEdited, setDueDateManuallyEdited] = useState(false);

  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobs, setJobs] = useState<EligibleJob[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [jobQuery, setJobQuery] = useState("");

  const builderItems: ComboboxItem[] = useMemo(
    () => builders.map((b) => ({ id: b.id, name: b.name })),
    [builders],
  );
  const contractorPresetItems: ComboboxItem[] = useMemo(
    () =>
      [...contractorPresets]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((preset) => ({ id: preset.id, name: preset.name })),
    [contractorPresets],
  );
  const billToPresetItems: ComboboxItem[] = useMemo(
    () =>
      [...billToPresets]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((preset) => ({ id: preset.id, name: preset.name })),
    [billToPresets],
  );

  useEffect(() => {
    setContractorPresets(
      readStorageArray<ContractorPreset>(CONTRACTOR_PRESETS_STORAGE_KEY),
    );
    setBillToPresets(readStorageArray<BillToPreset>(BILL_TO_PRESETS_STORAGE_KEY));
  }, []);

  function persistContractorPresets(next: ContractorPreset[]) {
    setContractorPresets(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        CONTRACTOR_PRESETS_STORAGE_KEY,
        JSON.stringify(next),
      );
    }
  }

  function persistBillToPresets(next: BillToPreset[]) {
    setBillToPresets(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(BILL_TO_PRESETS_STORAGE_KEY, JSON.stringify(next));
    }
  }

  function upsertContractorPreset(input: {
    name: string;
    address: string;
    phone: string;
  }) {
    const name = normalizeText(input.name);
    if (!name) return null;

    const address = normalizeText(input.address);
    const phone = normalizeText(input.phone);
    const existing = contractorPresets.find(
      (preset) => preset.name.toLowerCase() === name.toLowerCase(),
    );
    const saved: ContractorPreset = {
      id: existing?.id ?? makePresetId(),
      name,
      address,
      phone,
    };
    const next = existing
      ? contractorPresets.map((preset) =>
          preset.id === existing.id ? saved : preset,
        )
      : [...contractorPresets, saved];

    persistContractorPresets(next);
    return saved;
  }

  function upsertBillToPreset(input: {
    name: string;
    address: string;
    email: string;
  }) {
    const name = normalizeText(input.name);
    if (!name) return null;

    const address = normalizeText(input.address);
    const email = normalizeText(input.email);
    const existing = billToPresets.find(
      (preset) => preset.name.toLowerCase() === name.toLowerCase(),
    );
    const saved: BillToPreset = {
      id: existing?.id ?? makePresetId(),
      name,
      address,
      email,
    };
    const next = existing
      ? billToPresets.map((preset) =>
          preset.id === existing.id ? saved : preset,
        )
      : [...billToPresets, saved];

    persistBillToPresets(next);
    return saved;
  }

  function saveCurrentContractorPreset() {
    const saved = upsertContractorPreset({
      name: contractorName,
      address: contractorAddress,
      phone: contractorPhone,
    });
    if (!saved) {
      toast.error("Enter a contractor name first.");
      return;
    }
    setSelectedContractorPreset({ id: saved.id, name: saved.name });
    toast.success("Contractor info saved.");
  }

  function saveCurrentBillToPreset() {
    const saved = upsertBillToPreset({
      name: billToName,
      address: billToAddress,
      email: billToEmail,
    });
    if (!saved) {
      toast.error("Enter a bill-to name first.");
      return;
    }
    setSelectedBillToPreset({ id: saved.id, name: saved.name });
    toast.success("Bill-to info saved.");
  }

  function deleteContractorPreset(presetId: string) {
    const preset = contractorPresets.find((item) => item.id === presetId);
    if (!preset) return;

    const next = contractorPresets.filter((item) => item.id !== presetId);
    persistContractorPresets(next);

    if (selectedContractorPreset?.id === presetId) {
      setSelectedContractorPreset(null);
    }

    toast.success(`Deleted "${preset.name}" preset.`);
  }

  function deleteBillToPreset(presetId: string) {
    const preset = billToPresets.find((item) => item.id === presetId);
    if (!preset) return;

    const next = billToPresets.filter((item) => item.id !== presetId);
    persistBillToPresets(next);

    if (selectedBillToPreset?.id === presetId) {
      setSelectedBillToPreset(null);
    }

    toast.success(`Deleted "${preset.name}" preset.`);
  }

  async function loadEligibleJobs(builderId: string) {
    setLoadingJobs(true);
    setError(null);
    setJobQuery("");

    try {
      // 1) Projects for builder
      const { data: projects, error: projErr } = await supabase
        .from("projects")
        .select("id, project_address, subdivision")
        .eq("builder_id", builderId)
        .is("deleted_at", null);

      if (projErr) throw new Error(projErr.message);

      const projectList = projects ?? [];
      if (projectList.length === 0) {
        setJobs([]);
        setSelected({});
        return;
      }

      const projectIds = projectList.map((p) => p.id);
      const projectMap = new Map(projectList.map((p) => [p.id, p]));

      // 2) Completed jobs in those projects
      const { data: completedJobs, error: jobsErr } = await supabase
        .from("jobs")
        .select("id, title, price_cents, project_id")
        .in("project_id", projectIds)
        .eq("is_completed", true)
        .is("deleted_at", null);

      if (jobsErr) throw new Error(jobsErr.message);

      const completed = completedJobs ?? [];
      if (completed.length === 0) {
        setJobs([]);
        setSelected({});
        return;
      }

      // 3) Exclude already invoiced jobs
      const { data: invoicedItems, error: invItemsErr } = await supabase
        .from("invoice_items")
        .select("job_id")
        .in(
          "job_id",
          completed.map((j) => j.id),
        );

      if (invItemsErr) throw new Error(invItemsErr.message);

      const invoicedSet = new Set(
        ((invoicedItems ?? []) as InvoicedItemRow[])
          .map((item) => item.job_id)
          .filter((jobId): jobId is string => Boolean(jobId)),
      );

      const eligible: EligibleJob[] = completed
        .filter((j) => !invoicedSet.has(j.id))
        .map((j) => {
          const p = projectMap.get(j.project_id);
          return {
            id: j.id,
            title: j.title,
            price_cents: j.price_cents,
            project_id: j.project_id,
            project_address: p?.project_address ?? "—",
            subdivision: p?.subdivision ?? null,
          };
        })
        .sort((a, b) => a.project_address.localeCompare(b.project_address));

      setJobs(eligible);

      // Each invoice starts with an explicit choice of completed jobs.
      setSelected({});
    } finally {
      setLoadingJobs(false);
    }
  }

  const selectedJobs = useMemo(
    () => jobs.filter((j) => selected[j.id]),
    [jobs, selected],
  );
  const filteredJobs = useMemo(() => {
    const q = jobQuery.trim().toLowerCase();
    if (!q) return jobs;

    return jobs.filter((job) => {
      return (
        job.title.toLowerCase().includes(q) ||
        job.project_address.toLowerCase().includes(q) ||
        (job.subdivision ?? "").toLowerCase().includes(q)
      );
    });
  }, [jobs, jobQuery]);
  const selectedJobsCount = selectedJobs.length;
  const totalJobsCount = jobs.length;
  const subtotal = useMemo(
    () => selectedJobs.reduce((sum, j) => sum + (j.price_cents ?? 0), 0),
    [selectedJobs],
  );

  const canSubmit =
    !!builder &&
    contractorName.trim() &&
    billToName.trim() &&
    billToAddress.trim() &&
    invoiceDate.trim() &&
    selectedJobsCount > 0;

  function setAllJobsSelected(nextSelected: boolean) {
    const next: Record<string, boolean> = {};
    jobs.forEach((job) => {
      next[job.id] = nextSelected;
    });
    setSelected(next);
  }

  function submit() {
    setError(null);

    startTransition(async () => {
      const fd = new FormData();

      fd.set("builder_id", builder!.id);

      fd.set("contractor_name", contractorName);
      fd.set("contractor_address", contractorAddress);
      fd.set("contractor_phone", contractorPhone);

      fd.set("bill_to_name", billToName);
      fd.set("bill_to_address", billToAddress);
      fd.set("bill_to_email", billToEmail);

      fd.set("invoice_date", invoiceDate);
      fd.set("due_date", dueDate);

      selectedJobs.forEach((j) => fd.append("job_ids", j.id));

      const res = await createInvoiceForBuilder(fd);
      if (!res.ok) {
        setError(res.message ?? "Failed to create invoice.");
        return;
      }

      router.push(`/invoices/${res.invoiceId}`);
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-6 pb-36 md:pb-0"
      onSubmit={(event) => {
        event.preventDefault();
        if (isPending || !canSubmit) return;
        submit();
      }}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Card className="space-y-3 p-4 sm:p-5">
            <div className="space-y-1">
              <div className="text-sm font-semibold">Builder</div>
              <p className="text-xs text-muted-foreground">
                Jobs are loaded from completed work tied to this builder only.
              </p>
            </div>
            <CreatableCombobox
              label="Builder"
              placeholder="Select builder..."
              items={builderItems}
              value={builder}
              onChange={(b) => {
                setBuilder(b);
                setJobs([]);
                setSelected({});
                setJobQuery("");
                if (b?.id) {
                  setBillToName(b.name);
                  loadEligibleJobs(b.id);
                }
              }}
              onCreate={async () => {
                throw new Error("Create builders from Projects for now.");
              }}
            />
          </Card>

          <Card className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="text-sm font-semibold">Contractor Information</div>
                <p className="text-xs text-muted-foreground">
                  This appears in the From section of the invoice.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={saveCurrentContractorPreset}
              >
                Save Contractor Preset
              </Button>
            </div>

            <CreatableCombobox
              label="Saved Contractors"
              placeholder="Select or create contractor profile..."
              items={contractorPresetItems}
              value={selectedContractorPreset}
              onChange={(item) => {
                setSelectedContractorPreset(item);
                if (!item) return;

                const preset = contractorPresets.find((p) => p.id === item.id);
                if (!preset) return;

                setContractorName(preset.name);
                setContractorAddress(preset.address);
                setContractorPhone(preset.phone);
              }}
              onCreate={async (name) => {
                const saved = upsertContractorPreset({
                  name,
                  address: contractorAddress,
                  phone: contractorPhone,
                });
                if (!saved) throw new Error("Contractor name is required.");

                setSelectedContractorPreset({ id: saved.id, name: saved.name });
                setContractorName(saved.name);
                toast.success("Contractor info saved.");
                return { id: saved.id, name: saved.name };
              }}
              onDelete={async (item) => {
                deleteContractorPreset(item.id);
              }}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="create-invoice-by-builder-contractorName" className="text-sm font-medium">Company Name</label>
                <Input id="create-invoice-by-builder-contractorName" value={contractorName}
                  onChange={(e) => setContractorName(e.target.value)}
                  placeholder="Company name"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="create-invoice-by-builder-contractorAddress" className="text-sm font-medium">Address</label>
                <Input id="create-invoice-by-builder-contractorAddress" value={contractorAddress}
                  onChange={(e) => setContractorAddress(e.target.value)}
                  placeholder="Street, city, state, zip"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="create-invoice-by-builder-contractorPhone" className="text-sm font-medium">Phone</label>
                <Input id="create-invoice-by-builder-contractorPhone" value={contractorPhone}
                  onChange={(e) => setContractorPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="text-sm font-semibold">Bill To</div>
                <p className="text-xs text-muted-foreground">
                  This appears in the client billing section.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={saveCurrentBillToPreset}
              >
                Save Bill-To Preset
              </Button>
            </div>

            <CreatableCombobox
              label="Saved Bill-To Profiles"
              placeholder="Select or create bill-to profile..."
              items={billToPresetItems}
              value={selectedBillToPreset}
              onChange={(item) => {
                setSelectedBillToPreset(item);
                if (!item) return;

                const preset = billToPresets.find((p) => p.id === item.id);
                if (!preset) return;

                setBillToName(preset.name);
                setBillToAddress(preset.address);
                setBillToEmail(preset.email ?? "");
              }}
              onCreate={async (name) => {
                const saved = upsertBillToPreset({
                  name,
                  address: billToAddress,
                  email: billToEmail,
                });
                if (!saved) throw new Error("Bill-to name is required.");

                setSelectedBillToPreset({ id: saved.id, name: saved.name });
                setBillToName(saved.name);
                toast.success("Bill-to info saved.");
                return { id: saved.id, name: saved.name };
              }}
              onDelete={async (item) => {
                deleteBillToPreset(item.id);
              }}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="create-invoice-by-builder-billToName" className="text-sm font-medium">Builder Name</label>
                <Input id="create-invoice-by-builder-billToName" value={billToName}
                  onChange={(e) => setBillToName(e.target.value)}
                  placeholder="Billing company name"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="create-invoice-by-builder-billToAddress" className="text-sm font-medium">Billing Address</label>
                <Input id="create-invoice-by-builder-billToAddress" value={billToAddress}
                  onChange={(e) => setBillToAddress(e.target.value)}
                  placeholder="Street, city, state, zip"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="text-sm font-medium">Billing Email (Optional)</div>
                <Input
                  type="email"
                  value={billToEmail}
                  onChange={(e) => setBillToEmail(e.target.value)}
                  placeholder="billing@example.com"
                />
              </div>
            </div>
          </Card>

          <Card className="space-y-3 p-4 sm:p-5">
            <div className="text-base font-semibold">Invoice Details</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="builder-invoice-date" className="text-sm font-medium">Invoice Date</label>
                <Input
                  id="builder-invoice-date"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => {
                    const nextInvoiceDate = e.target.value;
                    setInvoiceDate(nextInvoiceDate);
                    if (!dueDateManuallyEdited) {
                      setDueDate(suggestDueDate(nextInvoiceDate, defaultDueDays) ?? "");
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="builder-invoice-due" className="text-sm font-medium">Due Date (optional)</label>
                <Input
                  id="builder-invoice-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDateManuallyEdited(true);
                    setDueDate(e.target.value);
                  }}
                />
                {defaultDueDays > 0 && dueDateManuallyEdited && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setDueDateManuallyEdited(false);
                      setDueDate(suggestDueDate(invoiceDate, defaultDueDays) ?? "");
                    }}
                  >
                    Reset to default ({defaultDueDays} days)
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Completed Jobs</div>
                <p className="text-xs text-muted-foreground">
                  Select the completed jobs to include. Nothing is selected automatically.
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Subtotal</div>
                <div className="text-lg font-semibold">{money(subtotal)}</div>
              </div>
            </div>

            {builder && !loadingJobs && jobs.length > 0 && (
              <div className="space-y-2">
                <label htmlFor="create-invoice-by-builder-jobQuery" className="text-sm font-medium">Search Jobs</label>
                <Input id="create-invoice-by-builder-jobQuery" value={jobQuery}
                  onChange={(event) => setJobQuery(event.target.value)}
                  placeholder="Search by title, project, or subdivision..."
                />
              </div>
            )}

            {builder && !loadingJobs && jobs.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 p-2">
                <div className="text-xs text-muted-foreground">
                  {selectedJobsCount} of {totalJobsCount} selected
                  {jobQuery.trim().length > 0
                    ? ` | ${filteredJobs.length} shown`
                    : ""}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAllJobsSelected(true)}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAllJobsSelected(false)}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}

            {!builder ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Select a builder to load eligible jobs.
              </div>
            ) : loadingJobs ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Loading jobs...
              </div>
            ) : jobs.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No completed jobs available to invoice for this builder.
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No jobs match your search.
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <div className="max-h-96 overflow-auto">
                  {filteredJobs.map((job) => (
                    <label
                      key={job.id}
                      className={cn(
                        "flex cursor-pointer items-start justify-between gap-3 border-b p-3 transition-colors last:border-b-0",
                        selected[job.id] ? "bg-info-muted" : "hover:bg-muted/20",
                      )}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <Checkbox
                          checked={!!selected[job.id]}
                          onCheckedChange={(checked) =>
                            setSelected((prev) => ({
                              ...prev,
                              [job.id]: !!checked,
                            }))
                          }
                        />
                        <div className="min-w-0 space-y-1 break-words">
                          <div className="text-sm font-medium">{job.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {job.project_address}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Subdivision: {job.subdivision ?? "Unassigned"}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold tabular-nums">
                        {money(job.price_cents)}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        <Card className="h-fit space-y-4 p-4 sm:p-5 xl:sticky xl:top-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold">Invoice Summary</div>
            <p className="text-xs text-muted-foreground">
              Review required fields before creating.
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Builder</span>
              <span className="font-medium">{builder?.name ?? "Not selected"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Jobs Selected</span>
              <span className="font-medium">{selectedJobsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{money(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Invoice Date</span>
              <span className="font-medium">{invoiceDate || "Required"}</span>
            </div>
          </div>

          <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-xs">
            <div className="font-medium">Required to submit:</div>
            <div className={cn(!builder && "text-destructive")}>Builder selected</div>
            <div className={cn(!contractorName.trim() && "text-destructive")}>
              Contractor name
            </div>
            <div className={cn(!billToName.trim() && "text-destructive")}>
              Bill-to name
            </div>
            <div className={cn(!billToAddress.trim() && "text-destructive")}>
              Bill-to address
            </div>
            <div className={cn(!invoiceDate.trim() && "text-destructive")}>
              Invoice date
            </div>
            <div className={cn(selectedJobsCount === 0 && "text-destructive")}>
              At least one job selected
            </div>
          </div>

          <div className="hidden flex-col gap-2 xl:flex">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => router.push("/invoices")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !canSubmit}>
              {isPending ? "Creating..." : "Create Invoice"}
            </Button>
          </div>
        </Card>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t bg-card px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:static md:flex md:justify-end md:border-0 md:bg-transparent md:p-0 xl:hidden">
        <div aria-live="polite" className="col-span-2 mb-1 flex justify-between text-sm md:hidden"><span className="text-muted-foreground">Subtotal · {selectedJobsCount} jobs</span><span className="font-semibold tabular-nums">{money(subtotal)}</span></div>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => router.push("/invoices")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !canSubmit}>
          {isPending ? "Creating..." : "Create Invoice"}
        </Button>
      </div>
    </form>
  );
}
