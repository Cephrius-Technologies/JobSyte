"use client";

import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useBrowserStoredState } from "@/hooks/use-browser-storage";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronDown,
  List,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FilterDialog,
  FilterDialogSection,
} from "@/components/ui/filter-dialog";
import { cn } from "@/lib/utils";

type InvoiceStatus = "issued" | "due" | "overdue" | "paid";
type StatusFilter = "all" | InvoiceStatus;
type ViewMode = "list" | "grouped";

const INVOICES_VIEW_STORAGE_KEY = "invoices:view";
const INVOICES_EXPANDED_RECIPIENTS_STORAGE_KEY =
  "invoices:expanded-recipients";
const UNASSIGNED_RECIPIENT_LABEL = "Unassigned";

export type InvoiceListItem = {
  id: string;
  invoice_number: string;
  invoice_date: string | null;
  due_date: string | null;
  subtotal_cents: number | null;
  bill_to_name: string | null;
  contractor_name: string | null;
  created_at: string | null;
  is_paid: boolean | null;
};

type RecipientInvoiceGroup = {
  key: string;
  label: string;
  invoices: InvoiceListItem[];
  invoiceCount: number;
  totalCents: number;
  paidCount: number;
  overdueCount: number;
};

function money(cents: number | null) {
  const value = cents ?? 0;
  return (value / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value: string | null): string {
  if (!value) return "N/A";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInvoiceStatus(
  dueDate: string | null,
  isPaid: boolean | null,
  todayKey: string,
): InvoiceStatus {
  if (isPaid) return "paid";
  if (!dueDate) return "issued";

  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return "issued";

  const today = new Date(`${todayKey}T00:00:00`);
  today.setHours(0, 0, 0, 0);

  return due < today ? "overdue" : "due";
}

function statusLabel(status: InvoiceStatus): string {
  if (status === "overdue") return "Overdue";
  if (status === "due") return "Due";
  if (status === "paid") return "Paid";
  return "Issued";
}


function parseStoredKeys(raw: string | null): string[] | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return null;
  }
}

function parseInvoicesView(raw: string | null): ViewMode {
  return raw === "grouped" ? "grouped" : "list";
}

function serializeStoredKeys(value: string[] | null) {
  return value === null ? null : JSON.stringify(value);
}

function getRecipientLabel(invoice: InvoiceListItem): string {
  return invoice.bill_to_name?.trim() || UNASSIGNED_RECIPIENT_LABEL;
}

export function InvoicesPageClient({
  invoices,
  todayKey,
}: {
  invoices: InvoiceListItem[];
  todayKey: string;
}) {
  const [query, setQuery] = useState("");
  const [billToFilter, setBillToFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [view, setView] = useBrowserStoredState<ViewMode>({
    key: INVOICES_VIEW_STORAGE_KEY,
    defaultValue: "list",
    parse: parseInvoicesView,
    serialize: (value) => value,
  });
  const [expandedRecipients, setExpandedRecipients] = useBrowserStoredState<
    string[] | null
  >({
    key: INVOICES_EXPANDED_RECIPIENTS_STORAGE_KEY,
    defaultValue: null,
    parse: parseStoredKeys,
    serialize: serializeStoredKeys,
  });
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    invoices[0]?.id ?? null,
  );
  const isMobile = useIsMobile();
  const router = useRouter();

  const billToOptions = useMemo(() => {
    const set = new Set<string>();
    for (const invoice of invoices) {
      const billTo = (invoice.bill_to_name ?? "").trim();
      if (billTo) set.add(billTo);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const q = query.trim().toLowerCase();

    return invoices
      .filter((invoice) => {
        const status = getInvoiceStatus(invoice.due_date, invoice.is_paid, todayKey);
        const matchesBillTo =
          billToFilter === "all" || getRecipientLabel(invoice) === billToFilter;
        const matchesStatus = statusFilter === "all" || statusFilter === status;
        const matchesQuery =
          q.length === 0 ||
          (invoice.invoice_number ?? "").toLowerCase().includes(q) ||
          (invoice.bill_to_name ?? "").toLowerCase().includes(q) ||
          (invoice.contractor_name ?? "").toLowerCase().includes(q);

        return matchesBillTo && matchesStatus && matchesQuery;
      })
      .sort((a, b) => {
        const aCreated = a.created_at ?? "";
        const bCreated = b.created_at ?? "";
        return bCreated.localeCompare(aCreated);
      });
  }, [invoices, query, billToFilter, statusFilter, todayKey]);

  const groupedInvoices = useMemo<RecipientInvoiceGroup[]>(() => {
    const recipientMap = new Map<string, InvoiceListItem[]>();

    // Build the grouped invoice view from the already-filtered list so search,
    // recipient, and status filters apply identically in both views.
    for (const invoice of filteredInvoices) {
      const label = getRecipientLabel(invoice);
      const key = label.toLowerCase();
      const recipientInvoices = recipientMap.get(key) ?? [];
      recipientInvoices.push(invoice);
      recipientMap.set(key, recipientInvoices);
    }

    return Array.from(recipientMap.entries())
      .map(([key, recipientInvoices]) => {
        const sortedInvoices = [...recipientInvoices].sort((a, b) => {
          const aCreated = a.created_at ?? "";
          const bCreated = b.created_at ?? "";
          return bCreated.localeCompare(aCreated);
        });

        return {
          key,
          label: sortedInvoices[0]
            ? getRecipientLabel(sortedInvoices[0])
            : UNASSIGNED_RECIPIENT_LABEL,
          invoices: sortedInvoices,
          invoiceCount: sortedInvoices.length,
          totalCents: sortedInvoices.reduce(
            (sum, invoice) => sum + (invoice.subtotal_cents ?? 0),
            0,
          ),
          paidCount: sortedInvoices.filter((invoice) =>
            getInvoiceStatus(invoice.due_date, invoice.is_paid, todayKey) === "paid",
          ).length,
          overdueCount: sortedInvoices.filter((invoice) =>
            getInvoiceStatus(invoice.due_date, invoice.is_paid, todayKey) === "overdue",
          ).length,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredInvoices, todayKey]);

  const effectiveExpandedRecipients = useMemo(() => {
    const recipientKeys = new Set(groupedInvoices.map((group) => group.key));
    const defaultExpanded = groupedInvoices[0] ? [groupedInvoices[0].key] : [];
    const currentExpanded = expandedRecipients ?? defaultExpanded;

    return currentExpanded.filter((key) => recipientKeys.has(key));
  }, [expandedRecipients, groupedInvoices]);

  const effectiveSelectedInvoiceId = useMemo(() => {
    if (filteredInvoices.length === 0) return null;
    if (!selectedInvoiceId) return filteredInvoices[0].id;
    const exists = filteredInvoices.some(
      (invoice) => invoice.id === selectedInvoiceId,
    );
    return exists ? selectedInvoiceId : filteredInvoices[0].id;
  }, [filteredInvoices, selectedInvoiceId]);

  const selectedInvoice = useMemo(() => {
    if (!effectiveSelectedInvoiceId) return null;
    return (
      filteredInvoices.find(
        (invoice) => invoice.id === effectiveSelectedInvoiceId,
      ) ?? null
    );
  }, [filteredInvoices, effectiveSelectedInvoiceId]);

  const activeFilterCount =
    Number(query.trim().length > 0) +
    Number(billToFilter !== "all") +
    Number(statusFilter !== "all");

  function resetFilters() {
    setQuery("");
    setBillToFilter("all");
    setStatusFilter("all");
  }

  function toggleRecipient(recipientKey: string) {
    setExpandedRecipients((prev) => {
      const defaultExpanded = groupedInvoices[0] ? [groupedInvoices[0].key] : [];
      const currentExpanded = prev ?? defaultExpanded;

      if (currentExpanded.includes(recipientKey)) {
        return currentExpanded.filter((key) => key !== recipientKey);
      }

      return [...currentExpanded, recipientKey];
    });
  }

  if (invoices.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <PageHeader title="Invoices" description="Create, track, and manage customer invoices." />
          <Link href="/invoices/new" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">Create Invoice</Button>
          </Link>
        </div>
        <EmptyState title="No invoices yet" description="Turn completed jobs into an invoice and keep track of customer payments."
          action={<Button asChild><Link href="/invoices/new">Create Invoice</Link></Button>} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <PageHeader title="Invoices" description="Create, track, and manage customer invoices." />

          <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
              <FilterDialog
                title="Invoice Filters"
                description="Search and narrow invoices from a single modal."
                activeCount={activeFilterCount}
                onClear={resetFilters}
              >
                <FilterDialogSection title="Search">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search invoices..."
                  />
                </FilterDialogSection>

                <FilterDialogSection title="Bill To">
                  <Select value={billToFilter} onValueChange={setBillToFilter}>
                    <SelectTrigger className="w-full justify-between">
                      <SelectValue placeholder="All Builders" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Builders</SelectItem>
                      {billToOptions.map((builderName) => (
                        <SelectItem key={builderName} value={builderName}>
                          {builderName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterDialogSection>

                <FilterDialogSection title="Status">
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                  >
                    <SelectTrigger className="w-full justify-between">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="issued">Issued</SelectItem>
                      <SelectItem value="due">Due</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </FilterDialogSection>
              </FilterDialog>
              <div className="ml-auto inline-flex overflow-hidden rounded-md border bg-background sm:ml-0">
                <Button
                  type="button"
                  variant={view === "list" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-none border-0 cursor-pointer"
                  onClick={() => setView("list")}
                  aria-label="List view"
                >
                  <List className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant={view === "grouped" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-none border-0 cursor-pointer"
                  onClick={() => setView("grouped")}
                  aria-label="Grouped view"
                >
                  <Building2 className="size-4" />
                </Button>
              </div>
            </div>

            <Link href="/invoices/new" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">Create Invoice</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          {filteredInvoices.length === 0 ? (
            <Card className="p-8">
              <div className="text-sm text-muted-foreground">
                No invoices match the current filters.
              </div>
            </Card>
          ) : view === "grouped" ? (
            <div className="space-y-3">
              {groupedInvoices.map((recipientGroup) => {
                const isRecipientExpanded =
                  effectiveExpandedRecipients.includes(recipientGroup.key);

                return (
                  <Card
                    key={recipientGroup.key}
                    className="overflow-hidden border-border"
                  >
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        className="flex flex-1 flex-col items-start gap-2 text-left transition-colors hover:text-primary cursor-pointer sm:flex-row sm:items-center sm:justify-between"
                        onClick={() => toggleRecipient(recipientGroup.key)}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={cn(
                              "size-4 shrink-0 transition-transform cursor-pointer",
                              isRecipientExpanded && "rotate-180",
                            )}
                          />
                          <div className="text-base font-semibold">
                            {recipientGroup.label}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground sm:text-right">
                          {recipientGroup.invoiceCount}{" "}
                          {recipientGroup.invoiceCount === 1
                            ? "invoice"
                            : "invoices"}{" "}
                          • {money(recipientGroup.totalCents)} total •{" "}
                          {recipientGroup.paidCount} paid
                          {recipientGroup.overdueCount > 0
                            ? ` • ${recipientGroup.overdueCount} overdue`
                            : ""}
                        </div>
                      </button>
                    </div>

                    {isRecipientExpanded && (
                      <div className="space-y-2 border-t p-3 sm:p-4">
                        {recipientGroup.invoices.map((invoice) => {
                          const status = getInvoiceStatus(
                            invoice.due_date,
                            invoice.is_paid,
                            todayKey,
                          );
                          const isSelected =
                            effectiveSelectedInvoiceId === invoice.id;

                          return (
                            <Card
                              key={invoice.id}
                              className={cn(
                                "border-border p-3 transition-colors cursor-pointer",
                                isSelected
                                  ? "bg-muted/50 ring-1 ring-border"
                                  : "hover:bg-muted/50",
                              )}
                              onClick={() => {
                                setSelectedInvoiceId(invoice.id);
                                if (isMobile) {
                                  router.push(`/invoices/${invoice.id}`);
                                }
                              }}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="break-words font-medium">
                                      {invoice.invoice_number}
                                    </div>
                                    <StatusBadge tone={status === "paid" ? "success" : status === "overdue" ? "danger" : status === "due" ? "warning" : "info"}>{statusLabel(status)}</StatusBadge>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {money(invoice.subtotal_cents)} • Invoice{" "}
                                    {formatDate(invoice.invoice_date)} • Due{" "}
                                    {formatDate(invoice.due_date)}
                                  </div>
                                </div>

                                <div
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <Button asChild variant="outline" size="sm">
                                    <Link
                                      href={`/invoices/${invoice.id}`}
                                      onClick={() => setSelectedInvoiceId(invoice.id)}
                                    >
                                      View Invoice
                                    </Link>
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <>
            <div className="divide-y rounded-xl border bg-card lg:hidden">
              {filteredInvoices.map((invoice) => {
                const status = getInvoiceStatus(invoice.due_date, invoice.is_paid, todayKey);
                return <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="block space-y-3 p-4 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => setSelectedInvoiceId(invoice.id)}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="font-medium">{invoice.invoice_number}</span>
                    <span className="font-semibold tabular-nums">{money(invoice.subtotal_cents)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground break-words">{invoice.bill_to_name ?? "Unassigned builder"}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge tone={status === "paid" ? "success" : status === "overdue" ? "danger" : status === "due" ? "warning" : "info"}>{statusLabel(status)}</StatusBadge>
                    <span className="text-xs text-muted-foreground">Due {formatDate(invoice.due_date)}</span>
                  </div>
                </Link>;
              })}
            </div>
            <div className="hidden min-w-0 overflow-hidden rounded-xl border bg-card lg:block">
              <Table>
                <TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Builder</TableHead><TableHead>Invoice Date</TableHead><TableHead>Due Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{filteredInvoices.map((invoice) => {
                  const status = getInvoiceStatus(invoice.due_date, invoice.is_paid, todayKey);
                  return <TableRow key={invoice.id} className="cursor-pointer" data-state={effectiveSelectedInvoiceId === invoice.id ? "selected" : undefined}
                    onClick={() => { setSelectedInvoiceId(invoice.id); if (isMobile) router.push(`/invoices/${invoice.id}`); }}>
                    <TableCell><Link href={`/invoices/${invoice.id}`} className="font-medium hover:text-primary hover:underline" onClick={(event) => event.stopPropagation()}>{invoice.invoice_number}</Link></TableCell>
                    <TableCell>{invoice.bill_to_name ?? "Unassigned"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(invoice.invoice_date)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(invoice.due_date)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{money(invoice.subtotal_cents)}</TableCell>
                    <TableCell><StatusBadge tone={status === "paid" ? "success" : status === "overdue" ? "danger" : status === "due" ? "warning" : "info"}>{statusLabel(status)}</StatusBadge></TableCell>
                  </TableRow>;
                })}</TableBody>
              </Table>
            </div>
            </>
          )}
        </div>

        <Card className="hidden h-fit border-border p-5 xl:block xl:sticky xl:top-4">
          {selectedInvoice ? (
            <div className="space-y-6">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Selected Invoice
                </div>
                <div className="mt-2 text-xl font-semibold tracking-tight leading-snug">
                  {selectedInvoice.invoice_number}
                </div>
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-4">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="text-4xl font-semibold leading-none">
                    {money(selectedInvoice.subtotal_cents)}
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <UserRound className="size-4" />
                  Bill To: {selectedInvoice.bill_to_name ?? "Unassigned"}
                </div>
                <div className="flex items-center gap-2">
                  <ReceiptText className="size-4" />
                  From: {selectedInvoice.contractor_name ?? "Unknown"}
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4" />
                  Invoice Date: {formatDate(selectedInvoice.invoice_date)}
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4" />
                  Due Date: {formatDate(selectedInvoice.due_date)}
                </div>
              </div>

              <div className="border-t pt-4">
                <Link
                  href={`/invoices/${selectedInvoice.id}`}
                  className="inline-flex items-center gap-1 text-lg font-medium text-muted-foreground hover:text-primary dark:text-white dark:hover:text-muted-foreground/90 transition delay-100"
                >
                  View Invoice
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Select an invoice to view details.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
