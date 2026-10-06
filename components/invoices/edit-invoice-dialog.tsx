"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { editInvoiceWithJobs } from "@/app/(jobsyte-app)/invoices/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExistingItem = {
  id: string;
  job_id?: string | null;
  job_title_snapshot?: string | null;
  job_price_cents_snapshot?: number | null;
  project_address_snapshot?: string | null;
  builder_name_snapshot?: string | null;
  is_paid?: boolean | null;
};

type AvailableJob = {
  id: string;
  title: string;
  price_cents: number;
  scheduled_completion: string | null;
  project_id: string;
  project_address: string;
  builder_name: string | null;
  subdivision: string | null;
};

export type EditableInvoice = {
  id: string;
  invoice_number: string;
  contractor_name?: string | null;
  contractor_address?: string | null;
  contractor_phone?: string | null;
  bill_to_name?: string | null;
  bill_to_address?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditInvoiceDialog({
  invoice,
  items,
}: {
  invoice: EditableInvoice;
  items: ExistingItem[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Header fields
  const [contractorName, setContractorName] = useState(invoice.contractor_name ?? "");
  const [contractorAddress, setContractorAddress] = useState(invoice.contractor_address ?? "");
  const [contractorPhone, setContractorPhone] = useState(invoice.contractor_phone ?? "");
  const [billToName, setBillToName] = useState(invoice.bill_to_name ?? "");
  const [billToAddress, setBillToAddress] = useState(invoice.bill_to_address ?? "");
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoice_date ?? "");
  const [dueDate, setDueDate] = useState(invoice.due_date ?? "");

  // Items currently on the invoice
  const [keptItems, setKeptItems] = useState<ExistingItem[]>(items);

  // Available jobs to add
  const [availableJobs, setAvailableJobs] = useState<AvailableJob[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobSearch, setJobSearch] = useState("");

  // ── Reset ──────────────────────────────────────────────────────────────────

  function resetForm() {
    setError(null);
    setContractorName(invoice.contractor_name ?? "");
    setContractorAddress(invoice.contractor_address ?? "");
    setContractorPhone(invoice.contractor_phone ?? "");
    setBillToName(invoice.bill_to_name ?? "");
    setBillToAddress(invoice.bill_to_address ?? "");
    setInvoiceDate(invoice.invoice_date ?? "");
    setDueDate(invoice.due_date ?? "");
    setKeptItems(items);
    setSelectedJobIds(new Set());
    setJobSearch("");
    setAvailableJobs([]);
  }

  // ── Load available jobs when dialog opens ─────────────────────────────────

  useEffect(() => {
    if (!open) return;
    resetForm();

    (async () => {
      setLoadingJobs(true);
      try {
        const { data: jobs, error: jobsErr } = await supabase
          .from("jobs")
          .select("id, title, price_cents, scheduled_completion, project_id")
          .eq("is_completed", true)
          .eq("is_invoiced", false)
          .is("deleted_at", null);

        if (jobsErr || !jobs || jobs.length === 0) {
          setAvailableJobs([]);
          return;
        }

        const projectIds = Array.from(new Set(jobs.map((j) => j.project_id)));

        const { data: projects } = await supabase
          .from("projects")
          .select("id, project_address, builder_name, subdivision")
          .in("id", projectIds)
          .is("deleted_at", null);

        const projectMap = new Map((projects ?? []).map((p) => [p.id, p]));

        const available: AvailableJob[] = jobs.map((j) => {
          const p = projectMap.get(j.project_id);
          return {
            id: j.id,
            title: j.title,
            price_cents: j.price_cents,
            scheduled_completion: j.scheduled_completion,
            project_id: j.project_id,
            project_address: p?.project_address ?? "Unknown Project",
            builder_name: p?.builder_name ?? null,
            subdivision: p?.subdivision ?? null,
          };
        });

        available.sort(
          (a, b) =>
            a.project_address.localeCompare(b.project_address) ||
            a.title.localeCompare(b.title),
        );

        setAvailableJobs(available);
      } finally {
        setLoadingJobs(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const filteredAvailableJobs = useMemo(() => {
    const q = jobSearch.trim().toLowerCase();
    if (!q) return availableJobs;
    return availableJobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.project_address.toLowerCase().includes(q) ||
        (j.builder_name ?? "").toLowerCase().includes(q) ||
        (j.subdivision ?? "").toLowerCase().includes(q),
    );
  }, [availableJobs, jobSearch]);

  const jobsByProject = useMemo(() => {
    const map = new Map<string, { address: string; jobs: AvailableJob[] }>();
    for (const j of filteredAvailableJobs) {
      if (!map.has(j.project_id)) {
        map.set(j.project_id, { address: j.project_address, jobs: [] });
      }
      map.get(j.project_id)!.jobs.push(j);
    }
    return Array.from(map.values());
  }, [filteredAvailableJobs]);

  const subtotal = useMemo(() => {
    const keptTotal = keptItems.reduce(
      (sum, i) => sum + (i.job_price_cents_snapshot ?? 0),
      0,
    );
    const addTotal = availableJobs
      .filter((j) => selectedJobIds.has(j.id))
      .reduce((sum, j) => sum + j.price_cents, 0);
    return keptTotal + addTotal;
  }, [keptItems, availableJobs, selectedJobIds]);

  const canSubmit =
    contractorName.trim().length > 0 &&
    billToName.trim().length > 0 &&
    billToAddress.trim().length > 0 &&
    invoiceDate.trim().length > 0 &&
    (keptItems.length > 0 || selectedJobIds.size > 0);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function removeItem(itemId: string) {
    setKeptItems((prev) => prev.filter((i) => i.id !== itemId));
  }

  function toggleJob(jobId: string) {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  function onSubmit() {
    if (!canSubmit || isPending) return;
    setError(null);

    startTransition(async () => {
      const res = await editInvoiceWithJobs({
        invoiceId: invoice.id,
        contractorName,
        contractorAddress,
        contractorPhone,
        billToName,
        billToAddress,
        invoiceDate,
        dueDate,
        keepItemIds: keptItems.map((i) => i.id),
        addJobIds: Array.from(selectedJobIds),
      });

      if (!res.ok) {
        setError(res.message ?? "Failed to update invoice.");
        return;
      }

      toast.success("Invoice updated.");
      setOpen(false);
      router.refresh();
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 print:hidden"
        >
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:w-[calc(100vw-2rem)] sm:max-w-4xl sm:p-6">
        <DialogHeader>
          <DialogTitle>Edit {invoice.invoice_number}</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {/* ── From ── */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">From</div>
            <Input
              value={contractorName}
              onChange={(e) => setContractorName(e.target.value)}
              placeholder="Contractor name"
            />
            <Input
              value={contractorAddress}
              onChange={(e) => setContractorAddress(e.target.value)}
              placeholder="Contractor address"
            />
            <Input
              value={contractorPhone}
              onChange={(e) => setContractorPhone(e.target.value)}
              placeholder="Contractor phone"
            />
          </div>

          {/* ── Bill To ── */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">Bill To</div>
            <Input
              value={billToName}
              onChange={(e) => setBillToName(e.target.value)}
              placeholder="Builder name"
            />
            <Input
              value={billToAddress}
              onChange={(e) => setBillToAddress(e.target.value)}
              placeholder="Billing address"
            />
          </div>

          {/* ── Dates ── */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm font-semibold">Invoice Date</div>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold">Due Date (Optional)</div>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* ── Current Items ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">
                Current Items ({keptItems.length})
              </div>
              <div className="text-sm font-medium text-muted-foreground">
                Subtotal: {money(subtotal)}
              </div>
            </div>

            {keptItems.length === 0 ? (
              <div className="rounded-md border p-3 text-sm text-muted-foreground">
                No items — select jobs below to add them.
              </div>
            ) : (
              <div className="divide-y rounded-md border">
                {keptItems.map((item) => {
                  const isPaid = item.is_paid ?? false;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          <span className="truncate">
                            {item.job_title_snapshot ?? "—"}
                          </span>
                          {isPaid && (
                            <Badge className="shrink-0 bg-green-600 text-xs text-white hover:bg-green-600">
                              Paid
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.project_address_snapshot ?? ""}
                          {item.builder_name_snapshot
                            ? ` · ${item.builder_name_snapshot}`
                            : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-medium">
                          {money(item.job_price_cents_snapshot)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          disabled={isPaid}
                          title={
                            isPaid
                              ? "Paid items cannot be removed"
                              : "Remove item"
                          }
                          onClick={() => removeItem(item.id)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Add Jobs ── */}
          <div className="space-y-3">
            <div className="text-sm font-semibold">
              Add Jobs
              {selectedJobIds.size > 0 && (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  ({selectedJobIds.size} selected)
                </span>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="Search by job title, project address, builder, subdivision..."
                className="pl-8"
              />
            </div>

            {loadingJobs ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                Loading jobs...
              </div>
            ) : availableJobs.length === 0 ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                No completed, uninvoiced jobs available to add.
              </div>
            ) : jobsByProject.length === 0 ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                No jobs match your search.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-md border">
                {jobsByProject.map(({ address, jobs }) => (
                  <div key={address}>
                    <div className="sticky top-0 border-b bg-muted/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
                      {address}
                    </div>
                    {jobs.map((j) => (
                      <label
                        key={j.id}
                        className="flex cursor-pointer items-center justify-between gap-3 border-b p-3 last:border-b-0 hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedJobIds.has(j.id)}
                            onCheckedChange={() => toggleJob(j.id)}
                          />
                          <div>
                            <div className="text-sm font-medium">{j.title}</div>
                            {(j.subdivision || j.builder_name) && (
                              <div className="text-xs text-muted-foreground">
                                {[j.builder_name, j.subdivision]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            )}
                            {j.scheduled_completion && (
                              <div className="text-xs text-muted-foreground">
                                Scheduled: {j.scheduled_completion}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-sm font-medium">
                          {money(j.price_cents)}
                        </div>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setOpen(false)}
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
  );
}
