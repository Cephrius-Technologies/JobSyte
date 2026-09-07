"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EmployeeProfile } from "./types";

export type EmployeePaymentRecord = {
  id: string;
  employee_id: string;
  job_id: string;
  job_title: string;
  project_address: string;
  amount_cents: number;
  payment_method: string | null;
  reference_number: string | null;
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function paymentMethodLabel(method: string | null) {
  if (!method) return "—";
  if (method === "check") return "Check";
  if (method === "card") return "Card";
  if (method === "wire") return "Wire";
  if (method === "epay") return "E-pay";
  return method;
}

export function EmployeePaymentsDialog({
  employee,
  payments,
  onOpenChange,
}: {
  employee: EmployeeProfile | null;
  payments: EmployeePaymentRecord[];
  onOpenChange: (open: boolean) => void;
}) {
  const open = Boolean(employee);

  const totals = useMemo(() => {
    const grossPaid = payments.reduce((sum, p) => sum + p.amount_cents, 0);
    const refunded = payments
      .filter((p) => p.refunded_at)
      .reduce((sum, p) => sum + p.amount_cents, 0);
    return {
      grossPaid,
      refunded,
      netPaid: grossPaid - refunded,
      count: payments.length,
    };
  }, [payments]);

  const sortedPayments = useMemo(
    () =>
      [...payments].sort(
        (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime(),
      ),
    [payments],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {employee ? `Payments for ${employee.name}` : "Payments"}
          </DialogTitle>
          <DialogDescription>
            All payroll payments recorded for this employee.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/20 p-3 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Payments</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {totals.count}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Net Paid</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {money(totals.netPaid)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Refunded</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {money(totals.refunded)}
            </div>
          </div>
        </div>

        <div className="max-h-[55vh] overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead className="h-10">Job</TableHead>
                <TableHead className="h-10">Method</TableHead>
                <TableHead className="h-10">Reference</TableHead>
                <TableHead className="h-10">Paid</TableHead>
                <TableHead className="h-10 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPayments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No payments recorded for this employee yet.
                  </TableCell>
                </TableRow>
              ) : (
                sortedPayments.map((payment) => (
                  <TableRow
                    key={payment.id}
                    className={payment.refunded_at ? "opacity-60" : undefined}
                  >
                    <TableCell>
                      <div className="text-sm font-medium">
                        {payment.job_title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {payment.project_address}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {paymentMethodLabel(payment.payment_method)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {payment.reference_number || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(payment.paid_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm font-semibold tabular-nums">
                        {money(payment.amount_cents)}
                      </div>
                      {payment.refunded_at && (
                        <Badge
                          variant="outline"
                          className="mt-1 border-amber-200 bg-amber-50 text-amber-700"
                        >
                          Refunded
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
