"use client";

// Onboarding: payroll workbench. It consumes completed job assignments created
// through `components/jobs/completed-by-combobox.tsx` and writes payments via
// `app/(jobsyte-app)/(app)/payroll/actions.ts`.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, Download, Search, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HighlightScroller } from "@/components/ui/highlight-scroller";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  FilterDialog,
  FilterDialogSection,
} from "@/components/ui/filter-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addPayrollPayment,
  deletePayrollPayment,
  refundPayrollPayment,
} from "@/app/(jobsyte-app)/payroll/actions";


export type PayrollAssignment = {
  id: string;
  project_id: string;
  project_address: string;
  title: string;
  price_cents: number;
  is_completed: boolean;
  completed_at: string | null;
  completed_by_type: "employee" | "crew";
  completed_by_id: string;
  completed_by_name: string;
};

export type PayrollPayment = {
  id: string;
  job_id: string;
  job_title: string;
  project_address: string;
  paid_to_type: "employee" | "crew";
  paid_to_name: string;
  amount_cents: number;
  payment_method: string;
  reference_number: string;
  paid_at: string;
  refunded_at: string | null;
  refund_reason: string | null;
};

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function paymentLabel(method: string) {
  if (method === "check") return "Check";
  if (method === "card") return "Card";
  if (method === "wire") return "Wire";
  return "E-pay";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US");
}

function getRangeStart(range: "all" | "30d" | "90d" | "365d", todayKey: string) {
  if (range === "all") return null;
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 365;
  const today = new Date(`${todayKey}T12:00:00`);
  today.setDate(today.getDate() - days);
  return today;
}

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\n") || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function PayrollPageClient({
  assignments,
  payments,
  todayKey,
}: {
  assignments: PayrollAssignment[];
  payments: PayrollPayment[];
  todayKey: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedJob, setSelectedJob] = useState<PayrollAssignment | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PayrollPayment | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPaymentAction, setConfirmPaymentAction] = useState<"refund" | "delete" | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"check" | "card" | "wire" | "epay">("check");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [splitMode, setSplitMode] = useState<"grouped" | "split_equally">("grouped");
  const [refundReason, setRefundReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "refunded">("all");
  const [payeeFilter, setPayeeFilter] = useState<"all" | "employee" | "crew">("all");
  const [dateRange, setDateRange] = useState<"all" | "30d" | "90d" | "365d">("90d");
  const [query, setQuery] = useState("");

  const paidJobIds = useMemo(() => new Set(payments.map((payment) => payment.job_id)), [payments]);
  const readyToPayAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          assignment.is_completed &&
          Boolean(assignment.completed_by_id) &&
          (assignment.completed_by_type === "employee" || assignment.completed_by_type === "crew") &&
          !paidJobIds.has(assignment.id),
      ),
    [assignments, paidJobIds],
  );
  const paidJobsCount = useMemo(() => paidJobIds.size, [paidJobIds]);
  const rangeStart = useMemo(() => getRangeStart(dateRange, todayKey), [dateRange, todayKey]);

  const filteredPayments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? !payment.refunded_at : Boolean(payment.refunded_at));
      const matchesPayee = payeeFilter === "all" || payment.paid_to_type === payeeFilter;
      const matchesDate =
        !rangeStart || new Date(payment.paid_at).getTime() >= rangeStart.getTime();
      const matchesQuery =
        !normalizedQuery ||
        payment.paid_to_name.toLowerCase().includes(normalizedQuery) ||
        payment.job_title.toLowerCase().includes(normalizedQuery) ||
        payment.project_address.toLowerCase().includes(normalizedQuery) ||
        payment.reference_number.toLowerCase().includes(normalizedQuery) ||
        paymentLabel(payment.payment_method).toLowerCase().includes(normalizedQuery);

      return matchesStatus && matchesPayee && matchesDate && matchesQuery;
    });
  }, [payeeFilter, payments, query, rangeStart, statusFilter]);

  const paymentCounts = useMemo(
    () => ({
      all: payments.length,
      active: payments.filter((payment) => !payment.refunded_at).length,
      refunded: payments.filter((payment) => Boolean(payment.refunded_at)).length,
    }),
    [payments],
  );

  const visibleMetrics = useMemo(() => {
    const grossPaid = filteredPayments.reduce((sum, payment) => sum + payment.amount_cents, 0);
    const activePaid = filteredPayments
      .filter((payment) => !payment.refunded_at)
      .reduce((sum, payment) => sum + payment.amount_cents, 0);
    const refundedTotal = filteredPayments
      .filter((payment) => Boolean(payment.refunded_at))
      .reduce((sum, payment) => sum + payment.amount_cents, 0);
    const uniquePayees = new Set(filteredPayments.map((payment) => `${payment.paid_to_type}:${payment.paid_to_name}`)).size;

    return {
      grossPaid,
      activePaid,
      refundedTotal,
      netPaid: activePaid,
      uniquePayees,
    };
  }, [filteredPayments]);

  const payeeBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const payment of filteredPayments.filter((entry) => !entry.refunded_at)) {
      const key = `${payment.paid_to_name} (${payment.paid_to_type})`;
      totals.set(key, (totals.get(key) ?? 0) + payment.amount_cents);
    }

    return [...totals.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [filteredPayments]);

  const referenceLabel =
    paymentMethod === "check"
      ? "Check Number"
      : paymentMethod === "card"
        ? "Card Last 4 Digits"
        : "Transaction / Confirmation Number";

  const canSubmitPayment = Boolean(selectedJob && amount.trim() && referenceNumber.trim());

  function beginSubmit() {
    if (!canSubmitPayment) {
      toast.error("Please fill all required payment fields.");
      return;
    }
    setConfirmOpen(true);
  }

  function submitPayment() {
    if (!selectedJob) return;

    const fd = new FormData();
    fd.set("job_id", selectedJob.id);
    fd.set("paid_to_type", selectedJob.completed_by_type);
    fd.set("paid_to_id", selectedJob.completed_by_id);
    fd.set("paid_to_name", selectedJob.completed_by_name);
    fd.set("amount", amount);
    fd.set("payment_method", paymentMethod);
    fd.set("reference_number", referenceNumber);
    fd.set("allow_duplicate", String(allowDuplicate));
    fd.set("split_mode", splitMode);

    startTransition(async () => {
      const result = await addPayrollPayment(fd);
      if (!result.ok) {
        toast.error(result.message ?? "Failed to add payment.");
        return;
      }

      toast.success("Payment recorded.");
      router.refresh();
      setConfirmOpen(false);
      setSelectedJob(null);
      setAmount("");
      setReferenceNumber("");
      setAllowDuplicate(false);
      setSplitMode("grouped");
    });
  }

  function beginPaymentAction(payment: PayrollPayment, action: "refund" | "delete") {
    setSelectedPayment(payment);
    setConfirmPaymentAction(action);
    if (action !== "refund") setRefundReason("");
  }

  function submitPaymentAction() {
    if (!selectedPayment || !confirmPaymentAction) return;

    startTransition(async () => {
      const result =
        confirmPaymentAction === "refund"
          ? await refundPayrollPayment(selectedPayment.id, refundReason)
          : await deletePayrollPayment(selectedPayment.id);

      if (!result.ok) {
        toast.error(result.message ?? `Failed to ${confirmPaymentAction} payment.`);
        return;
      }

      toast.success(
        confirmPaymentAction === "refund"
          ? "Payment refunded and accounting reversed."
          : "Payment deleted and linked accounting removed.",
      );
      router.refresh();
      setSelectedPayment(null);
      setConfirmPaymentAction(null);
      setRefundReason("");
    });
  }

  function exportCsv() {
    if (filteredPayments.length === 0) {
      toast.error("No payments match the current filters.");
      return;
    }

    const header = [
      "Payee",
      "Payee Type",
      "Job",
      "Project",
      "Status",
      "Method",
      "Reference",
      "Amount",
      "Paid At",
      "Refunded At",
      "Refund Reason",
    ];
    const rows = filteredPayments.map((payment) => [
      payment.paid_to_name,
      payment.paid_to_type,
      payment.job_title,
      payment.project_address,
      payment.refunded_at ? "Refunded" : "Active",
      paymentLabel(payment.payment_method),
      payment.reference_number,
      (payment.amount_cents / 100).toFixed(2),
      payment.paid_at,
      payment.refunded_at ?? "",
      payment.refund_reason ?? "",
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => escapeCsv(value)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payroll-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const filterTabs = [
    { key: "all", label: "All Payments", count: paymentCounts.all },
    { key: "active", label: "Active", count: paymentCounts.active },
    { key: "refunded", label: "Refunded", count: paymentCounts.refunded },
  ] as const;
  const activeFilterCount =
    Number(query.trim().length > 0) +
    Number(statusFilter !== "all") +
    Number(payeeFilter !== "all") +
    Number(dateRange !== "90d");

  return (
    <div className="space-y-6">
      <HighlightScroller />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payroll</h1>
        <p className="text-sm text-muted-foreground">
          Record payments for completed jobs assigned to employees and crews.
        </p>
      </div>

      {/* Primary layout: Ready to Pay (main) + Analytics sidebar */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">

        {/* Main: Ready to Pay */}
        <Card className="overflow-hidden">
          <div className="border-b bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold">Ready to Pay</div>
                <div className="text-xs text-muted-foreground">
                  Completed jobs assigned to an employee or crew — click <span className="font-medium text-foreground">Add Payment</span> to record a payout.
                </div>
              </div>
              {readyToPayAssignments.length > 0 && (
                <Badge className="bg-primary text-primary-foreground">
                  {readyToPayAssignments.length} pending
                </Badge>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Job Value</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {readyToPayAssignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      No completed assigned jobs are waiting for payment.
                    </TableCell>
                  </TableRow>
                ) : (
                  readyToPayAssignments.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="font-medium">{job.title}</div>
                        <div className="text-xs text-muted-foreground">{job.project_address}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{job.completed_by_name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{job.completed_by_type}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-600 text-white hover:bg-green-600">Completed</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{money(job.price_cents)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => setSelectedJob(job)}>
                          <DollarSign className="mr-1 size-4" />
                          Add Payment
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Sidebar: Analytics */}
        <div className="flex flex-col gap-4">
          {/* Key metrics */}
          <Card className="p-4">
            <div className="text-sm font-semibold mb-3">Overview</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ready to Pay</span>
                <span className="font-semibold tabular-nums">{readyToPayAssignments.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Jobs Paid</span>
                <span className="font-semibold tabular-nums">{paidJobsCount}</span>
              </div>
              <div className="border-t my-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Net Paid</span>
                <span className="font-semibold tabular-nums">{money(visibleMetrics.netPaid)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Refunded</span>
                <span className="font-semibold tabular-nums text-amber-700">{money(visibleMetrics.refundedTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Unique Payees</span>
                <span className="font-semibold tabular-nums">{visibleMetrics.uniquePayees}</span>
              </div>
            </div>
          </Card>

          {/* Top paid payees */}
          <Card className="p-4">
            <div className="text-sm font-semibold">Top Paid Payees</div>
            <div className="mt-3 space-y-3">
              {payeeBreakdown.length === 0 ? (
                <div className="text-sm text-muted-foreground">No active payments match the current filters.</div>
              ) : (
                payeeBreakdown.map((entry) => (
                  <div key={entry.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground truncate">{entry.label}</span>
                    <span className="font-medium tabular-nums shrink-0">{money(entry.amount)}</span>
                  </div>
                ))
              )}
              <div className="border-t pt-3 text-xs text-muted-foreground">
                Gross visible payouts: {money(visibleMetrics.grossPaid)}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Secondary: Payment History with filters */}
      <Card className="overflow-hidden">
        <div className="border-b p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Payment History</div>
              <div className="text-xs text-muted-foreground">
                {filteredPayments.length} payment{filteredPayments.length === 1 ? "" : "s"} in current view
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FilterDialog
                title="Payroll Filters"
                description="Filter payment history without taking space from the ledger."
                activeCount={activeFilterCount}
                onClear={() => {
                  setQuery("");
                  setStatusFilter("all");
                  setPayeeFilter("all");
                  setDateRange("90d");
                }}
              >
                <FilterDialogSection title="Search">
                  <InputGroup>
                    <InputGroupAddon>
                      <Search className="size-4" />
                    </InputGroupAddon>
                    <InputGroupInput
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search payee, job, project, reference..."
                    />
                  </InputGroup>
                </FilterDialogSection>

                <FilterDialogSection title="Payment Status">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    {filterTabs.map((tab) => {
                      const active = statusFilter === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setStatusFilter(tab.key)}
                          className={
                            active
                              ? "inline-flex items-center gap-1.5 border-b-2 border-primary px-2 py-1 text-sm font-medium text-foreground"
                              : "inline-flex items-center gap-1.5 border-b-2 border-transparent px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
                          }
                        >
                          <span>{tab.label}</span>
                          <span
                            className={
                              active
                                ? "text-xs text-primary"
                                : "text-xs text-muted-foreground"
                            }
                          >
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </FilterDialogSection>

                <FilterDialogSection title="Payee Type">
                  <Select
                    value={payeeFilter}
                    onValueChange={(value) =>
                      setPayeeFilter(value as "all" | "employee" | "crew")
                    }
                  >
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue placeholder="Select payee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">All Payees</SelectItem>
                        <SelectItem value="employee">Employees</SelectItem>
                        <SelectItem value="crew">Crews</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FilterDialogSection>

                <FilterDialogSection title="Date Range">
                  <Select
                    value={dateRange}
                    onValueChange={(value) =>
                      setDateRange(value as "all" | "30d" | "90d" | "365d")
                    }
                  >
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue placeholder="Select date range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                        <SelectItem value="90d">Last 90 Days</SelectItem>
                        <SelectItem value="365d">Last 365 Days</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FilterDialogSection>
              </FilterDialog>

              <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
                <Download className="mr-1 size-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payee</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Paid At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No payments match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div data-highlight={payment.paid_to_name}>
                        <div className="font-medium">{payment.paid_to_name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{payment.paid_to_type}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{payment.job_title}</div>
                      <div className="text-xs text-muted-foreground">{payment.project_address}</div>
                    </TableCell>
                    <TableCell>
                      {payment.refunded_at ? (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                          Refunded
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-green-300 bg-green-50 text-green-800">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{paymentLabel(payment.payment_method)}</TableCell>
                    <TableCell className="font-mono text-xs">{payment.reference_number}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(payment.amount_cents)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      <div>{formatDateTime(payment.paid_at)}</div>
                      {payment.refunded_at && (
                        <div className="text-[11px] text-amber-700">
                          Refunded {formatDateTime(payment.refunded_at)}
                        </div>
                      )}
                      {payment.refund_reason && (
                        <div className="text-[11px] text-muted-foreground">
                          {payment.refund_reason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending || Boolean(payment.refunded_at)}
                          onClick={() => beginPaymentAction(payment, "refund")}
                        >
                          <Undo2 className="mr-1 size-4" />
                          Refund
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => beginPaymentAction(payment, "delete")}
                        >
                          <Trash2 className="mr-1 size-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={Boolean(selectedJob)} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
          </DialogHeader>

          {selectedJob && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                beginSubmit();
              }}
            >
              <div className="rounded-md border p-3 text-sm">
                <div className="font-medium">{selectedJob.title}</div>
                <div className="text-muted-foreground">{selectedJob.project_address}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Paying {selectedJob.completed_by_name} ({selectedJob.completed_by_type})
                </div>
              </div>

              <div className="space-y-2">
                <Label>Amount Paid</Label>
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as "check" | "card" | "wire" | "epay")}
                >
                  <option value="check">Check</option>
                  <option value="card">Card</option>
                  <option value="wire">Wire</option>
                  <option value="epay">E-pay (Zelle/PayPal/Cash App)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>{referenceLabel}</Label>
                <Input
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder={paymentMethod === "card" ? "Last 4 digits" : "Reference number"}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Crew Payment Mode</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={splitMode}
                  onChange={(e) => setSplitMode(e.target.value as "grouped" | "split_equally")}
                >
                  <option value="grouped">Grouped (recommended)</option>
                  <option value="split_equally">Split Equally</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Recommended default: grouped payment to reduce duplicate payroll entries.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowDuplicate}
                  onChange={(e) => setAllowDuplicate(e.target.checked)}
                />
                Allow duplicate payment for this job/assignee
              </label>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSelectedJob(null)} disabled={isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending || !canSubmitPayment}>
                  Continue
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Payment Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Submit this payroll payment with the selected method and reference details?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={submitPayment}>
              {isPending ? "Saving..." : "Confirm & Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(selectedPayment && confirmPaymentAction)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPayment(null);
            setConfirmPaymentAction(null);
            setRefundReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmPaymentAction === "refund" ? "Refund payment?" : "Delete payment?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmPaymentAction === "refund"
                ? "This marks the payment as refunded and removes its linked accounting expense from profitability totals."
                : "This permanently deletes the payment and removes its linked accounting expense."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {confirmPaymentAction === "refund" && selectedPayment && (
            <div className="space-y-2">
              <Label htmlFor="refund-reason">Refund Reason (optional)</Label>
              <Textarea
                id="refund-reason"
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
                rows={3}
                placeholder="Reason for refund"
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={submitPaymentAction}>
              {isPending
                ? "Saving..."
                : confirmPaymentAction === "refund"
                  ? "Confirm Refund"
                  : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
