"use client";

// Onboarding: invoice creation from selected completed jobs. Server writes are
// in `app/(jobsyte-app)/(app)/invoices/actions.ts`; payment toggles after
// creation live in `invoice-payment-controls.tsx`.
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import { createInvoice } from "@/app/(jobsyte-app)/projects/[id]/invoice-actions";
import { readPreferenceSettings, suggestDueDate } from "@/lib/settings/preferences";
import {
  CreatableCombobox,
  type ComboboxItem,
} from "@/components/projects/createable-combobox";

type Job = {
  id: string;
  title: string;
  price_cents: number;
  scheduled_completion: string | null;
  is_completed: boolean;
};

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

export function CreateInvoiceDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Form fields
  const [contractorName, setContractorName] = useState("");
  const [contractorAddress, setContractorAddress] = useState("");
  const [contractorPhone, setContractorPhone] = useState("");

  const [billToName, setBillToName] = useState("");
  const [billToAddress, setBillToAddress] = useState("");
  const [billToEmail, setBillToEmail] = useState("");
  const [contractorPresets, setContractorPresets] = useState<
    ContractorPreset[]
  >(() => readStorageArray<ContractorPreset>(CONTRACTOR_PRESETS_STORAGE_KEY));
  const [billToPresets, setBillToPresets] = useState<BillToPreset[]>(() =>
    readStorageArray<BillToPreset>(BILL_TO_PRESETS_STORAGE_KEY),
  );
  const [selectedContractorPreset, setSelectedContractorPreset] =
    useState<ComboboxItem | null>(null);
  const [selectedBillToPreset, setSelectedBillToPreset] =
    useState<ComboboxItem | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [defaultDueDays, setDefaultDueDays] = useState(30);
  const [dueDateManuallyEdited, setDueDateManuallyEdited] = useState(false);

  const [query, setQuery] = useState("");

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
      toast.error("Enter a company name first.");
      return;
    }
    setSelectedContractorPreset({ id: saved.id, name: saved.name });
    toast.success("From preset saved.");
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
    toast.success("Bill-to preset saved.");
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

  // Load contractor profile + eligible jobs when opened
  useEffect(() => {
    if (!open) return;

    (async () => {
      setError(null);
      setQuery("");
      setSelected({});
      setInvoiceDate(today);
      setDueDateManuallyEdited(false);

      // Profile
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;

      const settings = readPreferenceSettings(auth.user?.user_metadata ?? null);
      setDefaultDueDays(settings.default_due_days);
      setDueDate(suggestDueDate(today, settings.default_due_days) ?? "");

      if (userId) {
        const { data: profile } = await supabase
          .from("contractor_profiles")
          .select("company_name, address, phone")
          .eq("user_id", userId)
          .maybeSingle();

        setContractorName(profile?.company_name ?? "");
        setContractorAddress(profile?.address ?? "");
        setContractorPhone(profile?.phone ?? "");
      }

      // Fetch completed, not-yet-invoiced jobs for this project.
      // is_invoiced is set true when a job is added to an invoice and
      // reset to false when an invoice is deleted — it is the authoritative
      // source of truth and avoids a fragile cross-check against invoice_items.
      const { data: eligible } = await supabase
        .from("jobs")
        .select("id, title, price_cents, scheduled_completion, is_completed")
        .eq("project_id", projectId)
        .eq("is_completed", true)
        .eq("is_invoiced", false)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      setJobs((eligible ?? []) as Job[]);

      // Default: select none (user must choose)
      setSelected({});
    })();
  }, [open, projectId, supabase, today]);

  // Search
  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;

    return jobs.filter((j) => {
      return (
        j.title.toLowerCase().includes(q) ||
        (j.scheduled_completion ?? "").toLowerCase().includes(q)
      );
    });
  }, [jobs, query]);

  const selectedJobs = useMemo(
    () => filteredJobs.filter((j) => selected[j.id]),
    [filteredJobs, selected],
  );

  const subtotal = useMemo(
    () => selectedJobs.reduce((sum, j) => sum + (j.price_cents ?? 0), 0),
    [selectedJobs],
  );

  const canSubmit = Boolean(
    contractorName.trim() &&
      billToName.trim() &&
      billToAddress.trim() &&
      invoiceDate.trim() &&
      selectedJobs.length > 0,
  );

  function submit() {
    setError(null);

    startTransition(async () => {
      const fd = new FormData();
      fd.set("contractor_name", contractorName);
      fd.set("contractor_address", contractorAddress);
      fd.set("contractor_phone", contractorPhone);
      fd.set("bill_to_name", billToName);
      fd.set("bill_to_address", billToAddress);
      fd.set("bill_to_email", billToEmail);
      fd.set("invoice_date", invoiceDate);
      fd.set("due_date", dueDate);

      selectedJobs.forEach((j) => fd.append("job_ids", j.id));

      const res = await createInvoice(projectId, fd);
      if (!res.ok) {
        setError(res.message ?? "Failed to create invoice.");
        return;
      }

      onOpenChange(false);
      router.push(`/invoices/${res.invoiceId}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:w-[calc(100vw-2rem)] sm:max-w-4xl sm:p-6">
        <DialogHeader>
          <DialogTitle>Create New Invoice</DialogTitle>
            {/* <SelectSeparator className=" max-w-4xl"/> */}
        </DialogHeader>

        <form
          className="space-y-5 sm:space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (isPending || !canSubmit) return;
            submit();
          }}
        >
          {/* Contractor */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Contractor Information</div>
              <Button
                type="button"
                variant="outline"
                onClick={saveCurrentContractorPreset}
              >
                Save From Preset
              </Button>
            </div>
            <CreatableCombobox
              label="Saved From Profiles"
              placeholder="Select or create from profile..."
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
                if (!saved) throw new Error("From company name is required.");

                setSelectedContractorPreset({ id: saved.id, name: saved.name });
                setContractorName(saved.name);
                toast.success("From preset saved.");
                return { id: saved.id, name: saved.name };
              }}
              onDelete={async (item) => {
                deleteContractorPreset(item.id);
              }}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="create-invoice-dialog-contractorName" className="text-sm font-medium">Company Name</label>
                <Input id="create-invoice-dialog-contractorName" value={contractorName}
                  onChange={(e) => setContractorName(e.target.value)}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label htmlFor="create-invoice-dialog-contractorAddress" className="text-sm font-medium">Address</label>
                <Input id="create-invoice-dialog-contractorAddress" value={contractorAddress}
                  onChange={(e) => setContractorAddress(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="create-invoice-dialog-contractorPhone" className="text-sm font-medium">Phone</label>
                <Input id="create-invoice-dialog-contractorPhone" value={contractorPhone}
                  onChange={(e) => setContractorPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Bill to */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Bill To</div>
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
                toast.success("Bill-to preset saved.");
                return { id: saved.id, name: saved.name };
              }}
              onDelete={async (item) => {
                deleteBillToPreset(item.id);
              }}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <label htmlFor="create-invoice-dialog-billToName" className="text-sm font-medium">Builder Name</label>
                <Input id="create-invoice-dialog-billToName" value={billToName}
                  onChange={(e) => setBillToName(e.target.value)}
                  placeholder="Builder name"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label htmlFor="create-invoice-dialog-billToAddress" className="text-sm font-medium">Billing Address</label>
                <Input id="create-invoice-dialog-billToAddress" value={billToAddress}
                  onChange={(e) => setBillToAddress(e.target.value)}
                  placeholder="Bill to address"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <div className="text-sm font-medium">Billing Email (Optional)</div>
                <Input
                  type="email"
                  value={billToEmail}
                  onChange={(e) => setBillToEmail(e.target.value)}
                  placeholder="billing@example.com"
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="project-invoice-date" className="text-sm font-medium">Invoice Date</label>
              <Input
                id="project-invoice-date"
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
              <label htmlFor="project-invoice-due" className="text-sm font-medium">Due Date (optional)</label>
              <Input
                id="project-invoice-due"
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

          {/* Jobs */}
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {/* <div>
                <div className="text-sm font-semibold">Completed Jobs</div>
                <div className="text-xs text-muted-foreground">
                  Only jobs not previously invoiced appear here.
                </div>
              </div> */}
              <div className="text-sm font-semibold">
                Subtotal: {money(subtotal)}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="create-invoice-dialog-query" className="text-sm font-medium">Search Completed jobs</label>
              <Input id="create-invoice-dialog-query" value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by job title..."
              />
            </div>

            {filteredJobs.length === 0 ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                {jobs.length === 0
                  ? "No completed jobs available to invoice."
                  : "No jobs match your search."}
              </div>
            ) : (
              <div className="rounded-md border">
                <div className="max-h-56 overflow-y-auto sm:max-h-72">
                  {filteredJobs.map((j) => (
                    <label
                      key={j.id}
                      className={`flex flex-col items-start justify-between gap-3 border-b p-4 last:border-b-0 sm:flex-row sm:items-center ${selected[j.id] ? "bg-info-muted" : "hover:bg-muted/30"}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          aria-label={`Include ${j.title} in invoice`}
                          checked={!!selected[j.id]}
                          onCheckedChange={(v) =>
                            setSelected((prev) => ({ ...prev, [j.id]: !!v }))
                          }
                        />
                        <div>
                          <div className="text-sm font-medium">{j.title}</div>
                          <div className="text-xs text-muted-foreground">
                            Scheduled: {j.scheduled_completion ?? "No scheduled date"}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-medium sm:text-right">
                        {money(j.price_cents)}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              className="w-full sm:w-auto"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={isPending || !canSubmit}
            >
              {isPending ? "Creating..." : "Create Invoice"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
