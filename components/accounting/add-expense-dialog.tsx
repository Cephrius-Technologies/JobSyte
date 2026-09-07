"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createExpense } from "@/app/(jobsyte-app)/accounting/actions";
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

export function AddExpenseDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName]             = useState("");
  const [description, setDesc]      = useState("");
  const [category, setCategory]     = useState("");
  const [costType, setCostType]     = useState<"direct" | "indirect">("direct");
  const [valueType, setValueType]   = useState<"actual" | "estimated">("actual");
  const [amount, setAmount]         = useState("");
  const [expenseDate, setDate]      = useState("");

  function reset() {
    setName(""); setDesc(""); setCategory("");
    setCostType("direct"); setValueType("actual");
    setAmount(""); setDate(""); setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("project_id",   projectId);
    fd.set("name",         name.trim());
    fd.set("description",  description.trim());
    fd.set("category",     category);
    fd.set("cost_type",    costType);
    fd.set("value_type",   valueType);
    fd.set("amount",       amount.trim());
    fd.set("expense_date", expenseDate);

    startTransition(async () => {
      const res = await createExpense(fd);
      if (!res.ok) {
        setError(res.message ?? "Failed to add expense.");
        return;
      }
      toast.success("Expense added.");
      handleOpenChange(false);
      router.refresh();
    });
  }

  const canSubmit = name.trim().length > 0 && amount.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-6">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-name">Expense Name *</Label>
            <Input
              id="exp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Framing labour"
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-cat">Category</Label>
            <Select
              value={category || NONE_CATEGORY_VALUE}
              onValueChange={(value) =>
                setCategory(value === NONE_CATEGORY_VALUE ? "" : value)
              }
            >
              <SelectTrigger id="exp-cat">
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

          {/* Cost type / Value type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cost Type *</Label>
              <Select value={costType} onValueChange={(v) => setCostType(v as "direct" | "indirect")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="indirect">Indirect</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Value Type *</Label>
              <Select value={valueType} onValueChange={(v) => setValueType(v as "actual" | "estimated")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="actual">Actual</SelectItem>
                  <SelectItem value="estimated">Estimated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-amount">Amount *</Label>
            <Input
              id="exp-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 2500.00"
              required
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-date">Expense Date (optional)</Label>
            <Input
              id="exp-date"
              type="date"
              value={expenseDate}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-desc">Description (optional)</Label>
            <Textarea
              id="exp-desc"
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="Additional notes…"
            />
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !canSubmit}>
              {isPending ? "Saving…" : "Save Expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddExpenseButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="size-4" />
        Add Expense
      </Button>
      <AddExpenseDialog projectId={projectId} open={open} onOpenChange={setOpen} />
    </>
  );
}
