"use client";

// Onboarding: per-invoice-line payment controls. Server updates live in
// `app/(jobsyte-app)/(app)/invoices/payment-actions.ts` and also synchronize
// job-level paid flags for project/payroll views.
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  markInvoiceItemPaid,
  markInvoicePaid,
} from "@/app/(jobsyte-app)/invoices/payment-actions";

export type InvoiceItemWithPayment = {
  id: string;
  job_id: string | null;
  job_title_snapshot: string;
  job_price_cents_snapshot: number;
  project_address_snapshot: string;
  subdivision_name_raw_snapshot: string;
  builder_name_snapshot: string;
  is_paid: boolean;
  paid_at: string | null;
};

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function InvoicePaymentControls({
  invoiceId,
  items: initialItems,
  subtotalCents,
}: {
  invoiceId: string;
  items: InvoiceItemWithPayment[];
  invoiceIsPaid: boolean;
  subtotalCents: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();

  // Sync local state whenever the server delivers fresh data (via router.refresh).
  // Intentionally NOT gated on isPending — the old approach fired when isPending
  // went false, which is *before* router.refresh delivers new props, causing the
  // optimistic update to get reverted to stale server data.
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  function toggleItem(itemId: string, currentPaid: boolean) {
    const newPaid = !currentPaid;
    const updatedItems = items.map((i) =>
      i.id === itemId ? { ...i, is_paid: newPaid } : i,
    );

    // Optimistic update
    setItems(updatedItems);

    startTransition(async () => {
      const result = await markInvoiceItemPaid(itemId, invoiceId, newPaid);
      if (!result.ok) {
        toast.error(result.message ?? "Failed to update payment status.");
        // Revert
        setItems(initialItems);
      } else {
        toast.success(newPaid ? "Job marked as paid." : "Job marked as unpaid.");
        router.refresh();
      }
    });
  }

  function setAllPaid(nextPaid: boolean) {
    const updatedItems = items.map((i) => ({ ...i, is_paid: nextPaid }));
    // Optimistic update
    setItems(updatedItems);

    startTransition(async () => {
      const result = await markInvoicePaid(invoiceId, nextPaid);
      if (!result.ok) {
        toast.error(result.message ?? "Failed to update invoice payment status.");
        setItems(initialItems);
      } else {
        toast.success(nextPaid ? "Invoice marked as paid." : "Invoice marked as unpaid.");
        router.refresh();
      }
    });
  }

  const paidCount = items.filter((i) => i.is_paid).length;
  const allPaid = paidCount === items.length && items.length > 0;

  return (
    <>
      {/* Payment status bar — hidden on print */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Payment</span>
          {allPaid ? (
            <StatusBadge tone="success">
              Paid in full
            </StatusBadge>
          ) : paidCount > 0 ? (
            <StatusBadge tone="warning">
              {paidCount} / {items.length} paid
            </StatusBadge>
          ) : (
            <StatusBadge>
              Unpaid
            </StatusBadge>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {paidCount > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  className="gap-1.5"
                >
                  <DollarSign className="size-3.5" />
                  Mark All as Unpaid
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Mark Invoice as Unpaid?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will unmark every paid job on this invoice and sync the
                    linked project jobs back to unpaid.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => setAllPaid(false)}>
                    Mark as Unpaid
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {!allPaid && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  className="gap-1.5"
                >
                  <DollarSign className="size-3.5" />
                  Mark All as Paid
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Mark Invoice as Paid?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark all {items.length} job
                    {items.length !== 1 ? "s" : ""} on this invoice as paid. Paid
                    jobs are locked from status changes in the Projects section.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => setAllPaid(true)}>
                    Mark as Paid
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Items table */}
      <div className="overflow-hidden rounded-lg border print:overflow-visible print:border-0">
        <Table className="min-w-[640px] print:min-w-0">
          <TableHeader><TableRow>
            <TableHead>Description</TableHead><TableHead>Project Address</TableHead><TableHead>Subdivision</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right print:hidden">Paid</TableHead>
          </TableRow></TableHeader>
          <TableBody>{items.map((it) => (
            <TableRow key={it.id}>
              <TableCell className="whitespace-normal">
                <div className="font-medium">{it.job_title_snapshot}</div>
                <div className="mt-1 text-xs text-muted-foreground">{it.builder_name_snapshot}</div>
              </TableCell>
              <TableCell className="whitespace-normal text-muted-foreground">{it.project_address_snapshot}</TableCell>
              <TableCell className="whitespace-normal text-muted-foreground">{it.subdivision_name_raw_snapshot}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{money(it.job_price_cents_snapshot)}</TableCell>
              <TableCell className="text-right print:hidden">
                <Button type="button" variant="ghost" size="icon" disabled={isPending}
                  onClick={() => toggleItem(it.id, it.is_paid)}
                  aria-label={it.is_paid ? "Mark as unpaid" : "Mark as paid"} className="size-8">
                  {it.is_paid ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />}
                </Button>
              </TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </div>

      {/* Totals */}
      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-xs space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{money(subtotalCents)}</span>
          </div>
          <div className="flex justify-between border-t pt-4 text-lg font-semibold tabular-nums">
            <span>Total</span>
            <span>{money(subtotalCents)}</span>
          </div>
        </div>
      </div>
    </>
  );
}
