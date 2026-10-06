"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DeleteExpenseButton } from "@/components/accounting/delete-expense-button";
import { EditExpenseDialog } from "@/components/accounting/edit-expense-dialog";
import type { ProjectExpense } from "@/components/accounting/types";

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ExpenseTable({
  expenses,
}: {
  expenses: ProjectExpense[];
}) {
  const [editingExpense, setEditingExpense] = useState<ProjectExpense | null>(null);
  const [filter, setFilter] = useState<"all" | "direct" | "indirect" | "actual" | "estimated">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let list = expenses;
    if (filter === "direct") list = list.filter((expense) => expense.cost_type === "direct");
    if (filter === "indirect") list = list.filter((expense) => expense.cost_type === "indirect");
    if (filter === "actual") list = list.filter((expense) => expense.value_type === "actual");
    if (filter === "estimated") list = list.filter((expense) => expense.value_type === "estimated");

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return list;

    return list.filter((expense) => {
      return (
        expense.name.toLowerCase().includes(normalizedQuery) ||
        (expense.description ?? "").toLowerCase().includes(normalizedQuery) ||
        (expense.category ?? "").toLowerCase().includes(normalizedQuery) ||
        expense.cost_type.toLowerCase().includes(normalizedQuery) ||
        expense.value_type.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [expenses, filter, query]);

  const counts = useMemo(() => {
    return {
      all: expenses.length,
      direct: expenses.filter((expense) => expense.cost_type === "direct").length,
      indirect: expenses.filter((expense) => expense.cost_type === "indirect").length,
      actual: expenses.filter((expense) => expense.value_type === "actual").length,
      estimated: expenses.filter((expense) => expense.value_type === "estimated").length,
    };
  }, [expenses]);

  const tabs = [
    { key: "all", label: "Expenses", count: counts.all },
    { key: "direct", label: "Direct", count: counts.direct },
    { key: "indirect", label: "Indirect", count: counts.indirect },
    { key: "actual", label: "Actual", count: counts.actual },
    { key: "estimated", label: "Estimated", count: counts.estimated },
  ] as const;
  const activeFilterCount =
    Number(query.trim().length > 0) +
    Number(filter !== "all");

  function isPayrollExpense(expense: ProjectExpense) {
    return (
      expense.source_type === "payroll" ||
      Boolean(expense.payment_id) ||
      (expense.description ?? "").includes("[Payroll Sync")
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No expenses recorded yet. Add one above.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-col gap-3 border-b pb-3 md:flex-row md:items-center md:justify-between">
          <FilterDialog
            title="Expense Filters"
            description="Search and filter the expense ledger from a modal."
            activeCount={activeFilterCount}
            onClear={() => {
              setQuery("");
              setFilter("all");
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
                  placeholder="Search expenses..."
                />
              </InputGroup>
            </FilterDialogSection>

            <FilterDialogSection title="Type">
              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                {tabs.map((tab) => {
                  const active = filter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setFilter(tab.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 border-b-2 px-2 py-1 text-sm transition-colors",
                        active
                          ? "border-primary font-medium text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={cn(
                          "text-xs",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </FilterDialogSection>
          </FilterDialog>
        </div>

        <div className="md:hidden space-y-2">
          {filtered.length === 0 ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              No expenses match this filter.
            </div>
          ) : (
            filtered.map((expense) => {
              const payrollExpense = isPayrollExpense(expense);
              return (
              <div key={expense.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium leading-tight">{expense.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {money(expense.amount_cents)}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="cursor-pointer"
                        aria-label={`Actions for ${expense.name}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        className="cursor-pointer"
                        disabled={payrollExpense}
                        onSelect={(event) => {
                          event.preventDefault();
                          setEditingExpense(expense);
                        }}
                      >
                        <Pencil className="size-4" />
                        Edit Expense
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer text-destructive focus:text-destructive"
                        disabled={payrollExpense}
                        onSelect={(event) => {
                          event.preventDefault();
                        }}
                        asChild
                      >
                        <div className="relative flex w-full items-center gap-2">
                          <Trash2 className="size-4" />
                          <span>Delete Expense</span>
                          <div className="absolute inset-0">
                            <DeleteExpenseButton
                              expenseId={expense.id}
                              projectId={expense.project_id}
                              expenseName={expense.name}
                            />
                          </div>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {payrollExpense && (
                    <Badge variant="outline" className="border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                      Payroll Synced
                    </Badge>
                  )}
                  {expense.category && (
                    <span className="text-xs text-muted-foreground">{expense.category}</span>
                  )}
                  <Badge
                    variant="outline"
                    className={
                      expense.cost_type === "direct"
                        ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                        : "border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400"
                    }
                  >
                    {expense.cost_type === "direct" ? "Direct" : "Indirect"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      expense.value_type === "actual"
                        ? "border-green-300 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                        : "border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400"
                    }
                  >
                    {expense.value_type === "actual" ? "Actual" : "Estimated"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatDate(expense.expense_date)}</span>
                  {payrollExpense ? (
                    <span className="text-right">Managed from Payroll</span>
                  ) : expense.description ? (
                    <span className="line-clamp-1 max-w-[60%] text-right">{expense.description}</span>
                  ) : null}
                </div>
              </div>
              );
            })
          )}
        </div>

        <div className="hidden md:block overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-muted/20 hover:bg-muted/20">
                <TableHead className="h-11">Name</TableHead>
                <TableHead className="h-11">Category</TableHead>
                <TableHead className="h-11">Type</TableHead>
                <TableHead className="h-11">Date</TableHead>
                <TableHead className="h-11 text-right">Amount</TableHead>
                <TableHead className="h-11 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    No expenses match this filter.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((expense) => {
                  const payrollExpense = isPayrollExpense(expense);
                  return (
                  <TableRow key={expense.id} className="h-14">
                    <TableCell>
                      <div className="font-medium">{expense.name}</div>
                      {payrollExpense ? (
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          Managed from Payroll
                        </div>
                      ) : expense.description && (
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {expense.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{expense.category ?? "—"}</span>
                        {payrollExpense && (
                          <Badge variant="outline" className="border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                            Payroll
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge
                          variant="outline"
                          className={
                            expense.cost_type === "direct"
                              ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                              : "border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400"
                          }
                        >
                          {expense.cost_type === "direct" ? "Direct" : "Indirect"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            expense.value_type === "actual"
                              ? "border-green-300 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                              : "border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400"
                          }
                        >
                          {expense.value_type === "actual" ? "Actual" : "Estimated"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(expense.expense_date)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money(expense.amount_cents)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            className="cursor-pointer"
                            aria-label={`Actions for ${expense.name}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            className="cursor-pointer"
                            disabled={payrollExpense}
                            onSelect={(event) => {
                              event.preventDefault();
                              setEditingExpense(expense);
                            }}
                          >
                            <Pencil className="size-4" />
                            Edit Expense
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer text-destructive focus:text-destructive"
                            disabled={payrollExpense}
                            onSelect={(event) => {
                              event.preventDefault();
                            }}
                            asChild
                          >
                            <div className="relative flex w-full items-center gap-2">
                              <Trash2 className="size-4" />
                              <span>Delete Expense</span>
                              <div className="absolute inset-0">
                                <DeleteExpenseButton
                                  expenseId={expense.id}
                                  projectId={expense.project_id}
                                  expenseName={expense.name}
                                />
                              </div>
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {editingExpense && (
        <EditExpenseDialog
          expense={editingExpense}
          open={editingExpense !== null}
          onOpenChange={(v) => { if (!v) setEditingExpense(null); }}
        />
      )}
    </>
  );
}
