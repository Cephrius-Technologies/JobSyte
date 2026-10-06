"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HighlightScroller } from "@/components/ui/highlight-scroller";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { PAY_TYPE_LABELS, type EmployeeProfile } from "./types";
import { EmployeeDialog } from "./employee-dialog";
import { FilterChip } from "./filter-chip";
import {
  EmployeePaymentsDialog,
  type EmployeePaymentRecord,
} from "./employee-payments-dialog";
import { deleteEmployee } from "@/app/(jobsyte-app)/employees-crews/actions";

export type { EmployeePaymentRecord };

type FilterKey = "all" | "active" | "inactive";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function payTypeDisplay(employee: EmployeeProfile) {
  if (!employee.pay_type) return "Not set";
  return PAY_TYPE_LABELS[employee.pay_type];
}

function contactDisplay(employee: EmployeeProfile) {
  return employee.email ?? employee.phone ?? employee.contact_info ?? "—";
}

export function EmployeeRosterPageClient({
  employees,
  payments,
}: {
  employees: EmployeeProfile[];
  payments: EmployeePaymentRecord[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const deferredQuery = useDeferredValue(query);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeProfile | null>(null);
  const [paymentsEmployee, setPaymentsEmployee] = useState<EmployeeProfile | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeProfile | null>(null);
  const [isPending, startTransition] = useTransition();

  const paymentsByEmployeeId = useMemo(() => {
    const map = new Map<string, EmployeePaymentRecord[]>();
    for (const payment of payments) {
      if (!payment.employee_id) continue;
      const list = map.get(payment.employee_id) ?? [];
      list.push(payment);
      map.set(payment.employee_id, list);
    }
    return map;
  }, [payments]);

  const filterTabs = useMemo(
    () => [
      { key: "all" as FilterKey, label: "All", count: employees.length },
      { key: "active" as FilterKey, label: "Active", count: employees.filter((e) => e.is_active).length },
      { key: "inactive" as FilterKey, label: "Inactive", count: employees.filter((e) => !e.is_active).length },
    ],
    [employees],
  );

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return employees.filter((e) => {
      if (filter === "active" && !e.is_active) return false;
      if (filter === "inactive" && e.is_active) return false;
      if (!q) return true;
      return [e.name, e.job_title ?? "", e.role ?? "", e.email ?? "", e.phone ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [deferredQuery, employees, filter]);
  const activeFilterCount =
    Number(query.trim().length > 0) +
    Number(filter !== "all");

  const handleDelete = (employee: EmployeeProfile) => {
    startTransition(async () => {
      const result = await deleteEmployee(employee.id);
      if (!result.ok) {
        toast.error(result.message ?? "Failed to delete employee.");
        return;
      }
      toast.success("Employee deleted.");
      setDeletingEmployee(null);
    });
  };

  return (
    <div className="space-y-6 pb-6">
      <HighlightScroller />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground hover:text-primary" asChild>
            <Link href="/employees-crews">
              <ArrowLeft className="mr-1.5 size-4" />
              Back to Employees &amp; Crews
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">
            {employees.length} employee{employees.length === 1 ? "" : "s"} total
          </p>
        </div>
        <Button onClick={() => { setEditingEmployee(null); setDialogOpen(true); }}>
          <Plus className="mr-1.5 size-4" />
          Add Employee
        </Button>
      </div>

      <Card className="overflow-hidden shadow-none">
        <div className="border-b p-4">
          <div className="flex justify-end">
            <FilterDialog
              title="Employee Filters"
              description="Search and filter employees from a modal."
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
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name, role, contact..."
                  />
                </InputGroup>
              </FilterDialogSection>

              <FilterDialogSection title="Status">
                <div className="flex flex-wrap items-center gap-1">
                  {filterTabs.map((tab) => {
                    const active = filter === tab.key;
                    return (
                      <FilterChip
                        key={tab.key}
                        active={active}
                        label={tab.label}
                        count={tab.count}
                        onClick={() => setFilter(tab.key)}
                      />
                    );
                  })}
                </div>
              </FilterDialogSection>
            </FilterDialog>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-muted/20 hover:bg-muted/20">
                <TableHead className="h-11">Employee</TableHead>
                <TableHead className="h-11">Contact</TableHead>
                <TableHead className="h-11">Role</TableHead>
                <TableHead className="h-11">Compensation</TableHead>
                <TableHead className="h-11">Hired</TableHead>
                <TableHead className="h-11">Status</TableHead>
                <TableHead className="h-11 w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    No employees match your search or filter.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div data-highlight-id={employee.name} className="flex items-center gap-3 rounded-md px-2 py-1">
                        <Avatar size="sm">
                          <AvatarFallback>
                            {employee.name
                              .split(" ")
                              .map((w) => w.charAt(0).toUpperCase())
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="font-medium">{employee.name}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contactDisplay(employee)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {employee.job_title ?? employee.role ?? "—"}
                      </div>
                      {employee.job_title && employee.role && employee.role !== employee.job_title && (
                        <div className="text-xs text-muted-foreground">{employee.role}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{payTypeDisplay(employee)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(employee.hire_date ?? employee.created_at)}
                    </TableCell>
                    <TableCell>
                      {employee.is_active ? (
                        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`More actions for ${employee.name}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onSelect={() => setPaymentsEmployee(employee)}
                          >
                            <Receipt className="mr-2 size-4" />
                            View Payments
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditingEmployee(employee);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="mr-2 size-4" />
                            Edit Employee
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setDeletingEmployee(employee)}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editingEmployee}
      />

      <EmployeePaymentsDialog
        employee={paymentsEmployee}
        payments={
          paymentsEmployee
            ? paymentsByEmployeeId.get(paymentsEmployee.id) ?? []
            : []
        }
        onOpenChange={(open) => {
          if (!open) setPaymentsEmployee(null);
        }}
      />

      <AlertDialog
        open={Boolean(deletingEmployee)}
        onOpenChange={(open) => {
          if (!open && !isPending) setDeletingEmployee(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove{" "}
              <span className="font-semibold underline">
                {deletingEmployee?.name}
              </span>{" "}
              from your active workforce list. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deletingEmployee) handleDelete(deletingEmployee);
              }}
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
