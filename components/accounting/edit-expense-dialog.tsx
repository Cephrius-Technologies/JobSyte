"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateExpense } from "@/app/(jobsyte-app)/accounting/actions";
import type { ProjectExpense } from "@/components/accounting/types";
import { EXPENSE_CATEGORIES } from "@/components/accounting/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const NONE_CATEGORY_VALUE = "__none_category__";

export function EditExpenseDialog({
  expense,
  open,
  onOpenChange,
}: {
  expense: ProjectExpense;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName]           = useState(expense.name);
  const [description, setDesc]    = useState(expense.description ?? "");
  const [category, setCategory]   = useState(expense.category ?? "");
  const [costType, setCostType]   = useState<"direct" | "indirect">(expense.cost_type);
  const [valueType, setValueType] = useState<"actual" | "estimated">(expense.value_type);
  const [amount, setAmount]       = useState(() => (expense.amount_cents / 100).toFixed(2));
  const [expenseDate, setDate]    = useState(expense.expense_date ?? "");
  // Track which expense is loaded so we can reset when it changes
  const [loadedId, setLoadedId]   = useState(expense.id);

  // When a different expense is passed in, reset all fields
  if (expense.id !== loadedId) {
    setLoadedId(expense.id);
    setName(expense.name);
    setDesc(expense.description ?? "");
    setCategory(expense.category ?? "");
    setCostType(expense.cost_type);
    setValueType(expense.value_type);
    setAmount((expense.amount_cents / 100).toFixed(2));
    setDate(expense.expense_date ?? "");
    setError(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("expense_id",   expense.id);
    fd.set("project_id",   expense.project_id);
    fd.set("name",         name.trim());
    fd.set("description",  description.trim());
    fd.set("category",     category);
    fd.set("cost_type",    costType);
    fd.set("value_type",   valueType);
    fd.set("amount",       amount.trim());
    fd.set("expense_date", expenseDate);

    startTransition(async () => {
      const res = await updateExpense(fd);
      if (!res.ok) {
        setError(res.message ?? "Failed to update expense.");
        return;
      }
      toast.success("Expense updated.");
      onOpenChange(false);
      router.refresh();
    });
  }

  const canSubmit = name.trim().length > 0 && amount.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="edit-exp-name">Expense Name *</Label>
            <Input
              id="edit-exp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-exp-cat">Category</Label>
            <Select
              value={category || NONE_CATEGORY_VALUE}
              onValueChange={(value) =>
                setCategory(value === NONE_CATEGORY_VALUE ? "" : value)
              }
            >
              <SelectTrigger id="edit-exp-cat">
                <SelectValue placeholder="Select category…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_CATEGORY_VALUE}>— None —</SelectItem>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cost Type *</Label>
              <Select value={costType} onValueChange={(v) => setCostType(v as "direct" | "indirect")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="indirect">Indirect</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Value Type *</Label>
              <Select value={valueType} onValueChange={(v) => setValueType(v as "actual" | "estimated")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="actual">Actual</SelectItem>
                  <SelectItem value="estimated">Estimated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-exp-amount">Amount *</Label>
            <Input
              id="edit-exp-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-exp-date">Expense Date (optional)</Label>
            <Input
              id="edit-exp-date"
              type="date"
              value={expenseDate}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-exp-desc">Description (optional)</Label>
            <Textarea
              id="edit-exp-desc"
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
            />
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !canSubmit}>
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
