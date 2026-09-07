"use client";

// Onboarding: workforce dashboard for employees and crews. Server pages under
// `app/(jobsyte-app)/(app)/employees-crews/*` fetch the rows; derived metrics
// are built in `dashboard-data.ts`, while CRUD dialogs live beside this file.
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Briefcase,
  Info,
  MoreHorizontal,
  Pencil,
  Receipt,
  Search,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
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
import { deleteCrew, deleteEmployee } from "@/app/(jobsyte-app)/employees-crews/actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { buildWorkforceDashboardModel } from "./dashboard-data";
import { EmployeeDialog } from "./employee-dialog";
import { CrewDialog } from "./crew-dialog";
import {
  EmployeePaymentsDialog,
  type EmployeePaymentRecord,
} from "./employee-payments-dialog";
import { FilterChip } from "./filter-chip";
import { WorkforceAnalyticsPanel } from "./workforce-insights";
import {
  PAY_TYPE_LABELS,
  type CrewProfile,
  type EmployeeProfile,
  type WorkforceJob,
  type WorkforcePayment,
} from "./types";

export type { EmployeeProfile, CrewProfile };

type EmployeeFilterKey =
  | "all"
  | "active"
  | "inactive"
  | "unassigned"
  | "on_jobs";

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}


function formatDate(value: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function contactDisplay(employee: EmployeeProfile) {
  if (employee.email) return employee.email;
  if (employee.phone) return employee.phone;
  return employee.contact_info ?? "";
}

function payDisplay(employee: EmployeeProfile) {
  if (!employee.pay_type) return "Not set";
  if (employee.pay_type === "per_job") return PAY_TYPE_LABELS[employee.pay_type];
  if (employee.hourly_rate == null) return PAY_TYPE_LABELS[employee.pay_type];

  const suffix = employee.pay_type === "salary" ? "/yr" : "/hr";
  const value =
    employee.pay_type === "salary"
      ? employee.hourly_rate.toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })
      : employee.hourly_rate.toFixed(2);
  return `${PAY_TYPE_LABELS[employee.pay_type]} · $${value}${suffix}`;
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge
      variant="outline"
      className="border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
    >
      Active
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Inactive
    </Badge>
  );
}


export function EmployeesPageClient({
  employees,
  crews,
  jobs,
  payments,
  employeePayments,
  nowIso,
}: {
  employees: EmployeeProfile[];
  crews: CrewProfile[];
  jobs: WorkforceJob[];
  payments: WorkforcePayment[];
  employeePayments: EmployeePaymentRecord[];
  nowIso: string;
}) {
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [crewDialogOpen, setCrewDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] =
    useState<EmployeeProfile | null>(null);
  const [editingCrew, setEditingCrew] = useState<CrewProfile | null>(null);
  const [paymentsEmployee, setPaymentsEmployee] = useState<EmployeeProfile | null>(
    null,
  );
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeProfile | null>(
    null,
  );
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilterKey>("all");
  const [crewQuery, setCrewQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [remindersOpen, setRemindersOpen] = useState(false);
  const isMobile = useIsMobile();
  const deferredEmployeeQuery = useDeferredValue(employeeQuery);
  const deferredCrewQuery = useDeferredValue(crewQuery);

  const model = useMemo(
    () =>
      buildWorkforceDashboardModel({
        employees,
        crews,
        jobs,
        payments,
        now: nowIso,
      }),
    [crews, employees, jobs, nowIso, payments],
  );

  const crewById = useMemo(
    () => new Map(crews.map((crew) => [crew.id, crew])),
    [crews],
  );

  const paymentsByEmployeeId = useMemo(() => {
    const map = new Map<string, EmployeePaymentRecord[]>();
    for (const payment of employeePayments) {
      if (!payment.employee_id) continue;
      const list = map.get(payment.employee_id) ?? [];
      list.push(payment);
      map.set(payment.employee_id, list);
    }
    return map;
  }, [employeePayments]);

  const employeeFilterTabs = useMemo(
    () => [
      { key: "all", label: "All", count: model.employeeRoster.length },
      {
        key: "active",
        label: "Active",
        count: model.employeeRoster.filter((row) => row.employee.is_active).length,
      },
      {
        key: "inactive",
        label: "Inactive",
        count: model.employeeRoster.filter((row) => !row.employee.is_active).length,
      },
      {
        key: "unassigned",
        label: "Unassigned",
        count: model.employeeRoster.filter((row) => row.crewNames.length === 0).length,
      },
      {
        key: "on_jobs",
        label: "On Jobs",
        count: model.employeeRoster.filter((row) => row.activeJobs > 0).length,
      },
    ] as const,
    [model.employeeRoster],
  );

  const filteredEmployeeRows = useMemo(() => {
    const query = deferredEmployeeQuery.trim().toLowerCase();

    return model.employeeRoster.filter((row) => {
      if (employeeFilter === "active" && !row.employee.is_active) return false;
      if (employeeFilter === "inactive" && row.employee.is_active) return false;
      if (employeeFilter === "unassigned" && row.crewNames.length > 0) return false;
      if (employeeFilter === "on_jobs" && row.activeJobs === 0) return false;

      if (!query) return true;

      const haystack = [
        row.employee.name,
        row.employee.job_title ?? "",
        row.employee.role ?? "",
        row.employee.email ?? "",
        row.employee.phone ?? "",
        row.crewNames.join(" "),
        row.employee.pay_type ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [deferredEmployeeQuery, employeeFilter, model.employeeRoster]);

  const filteredCrews = useMemo(() => {
    const q = deferredCrewQuery.trim().toLowerCase();
    if (!q) return model.crewOverview;
    return model.crewOverview.filter((crewRow) => {
      const crew = crewById.get(crewRow.id);
      if (!crew) return false;
      const haystack = [
        crew.name,
        crew.specialization ?? "",
        crew.description ?? "",
        crewRow.crewLeadName ?? "",
        ...(crew.member_names ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [deferredCrewQuery, model.crewOverview, crewById]);
  const employeeFilterCount =
    Number(employeeQuery.trim().length > 0) +
    Number(employeeFilter !== "all");
  const crewFilterCount = Number(crewQuery.trim().length > 0);

  const utilizationPct =
    model.summary.activeEmployees > 0
      ? Math.round(
          (model.summary.employeesWithActiveJobs / model.summary.activeEmployees) * 100,
        )
      : 0;

  return (
    <div className="space-y-4 pb-6">
      {/* Header with actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Employees &amp; Crews</h1>
          <p className="text-sm text-muted-foreground">
            Manage your workforce — add employees and crews to assign jobs and track payroll.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Notification bell — Drawer on mobile, DropdownMenu on desktop */}
          {isMobile ? (
            <Drawer open={remindersOpen} onOpenChange={setRemindersOpen}>
              <DrawerTrigger asChild>
                <Button variant="outline" size="sm" className="relative">
                  <Bell className="size-4" />
                  {model.alerts.length > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                      {model.alerts.length}
                    </span>
                  )}
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader className="flex items-center justify-between border-b pb-3">
                  <DrawerTitle>Reminders</DrawerTitle>
                  {model.alerts.length > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      {model.alerts.length} active
                    </Badge>
                  )}
                </DrawerHeader>
                {model.alerts.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
                    <Bell className="size-5 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No active reminders</p>
                    <p className="text-xs text-muted-foreground/70">Your workforce setup looks complete.</p>
                  </div>
                ) : (
                  <div className="max-h-[60vh] overflow-y-auto divide-y">
                    {model.alerts.map((alert) => (
                      <div key={alert.id} className="flex items-start gap-3 px-4 py-4">
                        <div className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                          alert.tone === "warning"
                            ? "bg-amber-100 dark:bg-amber-950/40"
                            : "bg-blue-100 dark:bg-blue-950/40",
                        )}>
                          {alert.tone === "warning" ? (
                            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <Info className="size-4 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold leading-snug">
                              {alert.subject}
                            </span>
                            <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                              {alert.kind.charAt(0).toUpperCase() + alert.kind.slice(1)}
                            </Badge>
                          </div>
                          <div className="mt-0.5 text-xs font-medium text-foreground/70">
                            {alert.title}
                          </div>
                          <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            {alert.detail}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t p-4">
                  <DrawerClose asChild>
                    <Button variant="outline" className="w-full">Close</Button>
                  </DrawerClose>
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="relative">
                  <Bell className="size-4" />
                  {model.alerts.length > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                      {model.alerts.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between py-2.5">
                  <span className="font-semibold">Reminders</span>
                  {model.alerts.length > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      {model.alerts.length} active
                    </Badge>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {model.alerts.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 px-3 py-5 text-center">
                    <Bell className="size-5 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No active reminders</p>
                    <p className="text-xs text-muted-foreground/70">Your workforce setup looks complete.</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {model.alerts.map((alert, index) => (
                      <div key={alert.id}>
                        {index > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuItem className="flex cursor-default items-start gap-3 px-3 py-3 focus:bg-muted/50">
                          <div className={cn(
                            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                            alert.tone === "warning"
                              ? "bg-amber-100 dark:bg-amber-950/40"
                              : "bg-blue-100 dark:bg-blue-950/40",
                          )}>
                            {alert.tone === "warning" ? (
                              <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />
                            ) : (
                              <Info className="size-3.5 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-semibold leading-snug">
                                {alert.subject}
                              </span>
                              <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                                {alert.kind.charAt(0).toUpperCase() + alert.kind.slice(1)}
                              </Badge>
                            </div>
                            <div className="mt-0.5 text-xs font-medium text-foreground/70">
                              {alert.title}
                            </div>
                            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                              {alert.detail}
                            </div>
                          </div>
                        </DropdownMenuItem>
                      </div>
                    ))}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingCrew(null);
              setCrewDialogOpen(true);
            }}
          >
            <Users className="mr-1.5 size-4" />
            Add Crew
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingEmployee(null);
              setEmployeeDialogOpen(true);
            }}
          >
            <UserPlus className="mr-1.5 size-4" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* Key Metrics Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card className="px-3 py-3 shadow-none">
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Users className="size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold tabular-nums leading-tight">
                {model.summary.totalEmployees}
              </div>
              <div className="text-[11px] text-muted-foreground">Total Employees</div>
            </div>
          </div>
        </Card>

        <Card className="px-3 py-3 shadow-none">
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-green-500/10 text-green-600 dark:text-green-400">
              <UserCheck className="size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold tabular-nums leading-tight">
                {model.summary.activeEmployees}
                <span className="ml-0.5 text-xs font-medium text-muted-foreground">
                  / {model.summary.totalEmployees}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">Active Employees</div>
            </div>
          </div>
        </Card>

        <Card className="px-3 py-3 shadow-none">
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Briefcase className="size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold tabular-nums leading-tight">
                {utilizationPct}%
              </div>
              <div className="text-[11px] text-muted-foreground">Employee Utilization</div>
            </div>
          </div>
        </Card>

        
       

        <Card className="px-3 py-3 shadow-none">
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <TrendingUp className="size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold tabular-nums leading-tight">
                {model.summary.activeCrews}
                <span className="ml-0.5 text-xs font-medium text-muted-foreground">
                  crews
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {model.summary.assignedEmployees} assigned to jobs
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary" asChild>
          <Link href="/employees-crews/roster">
            All Employees
            <ArrowRight className="ml-1.5 size-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary" asChild>
          <Link href="/employees-crews/crews">
            All Crews
            <ArrowRight className="ml-1.5 size-4" />
          </Link>
        </Button>
      </div>

      {/* Two-column grid — left column stacks roster + crews, right column is analytics */}
      <div className="grid grid-cols-1 gap-4 lg:h-[calc(100vh-26rem)] lg:grid-cols-[3fr_2fr]">
        {/* Left column: Employee Roster on top, Crew Overview below */}
        <div className="flex min-h-0 flex-col gap-4">
          <Card className="flex shrink-0 flex-col overflow-hidden shadow-none max-h-[55vh]">
            <div className="shrink-0 border-b p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-sm font-semibold">Employee Roster</div>
                  <div className="text-xs text-muted-foreground">
                    Search, filter, and review your employees at a glance.
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 lg:ml-auto lg:items-end">
                  {/* Keep the roster dialog focused on roster state only. */}
                  <FilterDialog
                    title="Employee Roster Filters"
                    description="Search and filter the roster from a modal."
                    activeCount={employeeFilterCount}
                    onClear={() => {
                      setEmployeeQuery("");
                      setEmployeeFilter("all");
                    }}
                    triggerClassName="w-full sm:w-auto"
                  >
                    <FilterDialogSection title="Search">
                      <InputGroup>
                        <InputGroupAddon>
                          <Search className="size-4" />
                        </InputGroupAddon>
                        <InputGroupInput
                          value={employeeQuery}
                          onChange={(event) => setEmployeeQuery(event.target.value)}
                          placeholder="Search employees, crews, roles..."
                        />
                      </InputGroup>
                    </FilterDialogSection>

                    <FilterDialogSection title="Status">
                      <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                        {employeeFilterTabs.map((tab) => {
                          const active = employeeFilter === tab.key;
                          return (
                            <FilterChip
                              key={tab.key}
                              active={active}
                              label={tab.label}
                              count={tab.count}
                              onClick={() => setEmployeeFilter(tab.key)}
                            />
                          );
                        })}
                      </div>
                    </FilterDialogSection>
                  </FilterDialog>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b hover:bg-muted/20">
                  <TableHead className="sticky top-0 z-10 h-10 ">Employee</TableHead>
                  <TableHead className="sticky top-0 z-10 hidden h-10 lg:table-cell">Crew</TableHead>
                  <TableHead className="sticky top-0 z-10 h-10">Role</TableHead>
                  <TableHead className="sticky top-0 z-10 hidden h-10 md:table-cell">Compensation</TableHead>
                  <TableHead className="sticky top-0 z-10 hidden h-10 xl:table-cell">Workload</TableHead>
                  <TableHead className="sticky top-0 z-10 h-10">Status</TableHead>
                  <TableHead className="sticky top-0 z-10 h-10 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredEmployeeRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No employees match the current search or filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployeeRows.map((row) => {
                    const { employee } = row;
                    const contact = contactDisplay(employee);
                    const secondaryRoleText =
                      !employee.job_title && employee.role
                        ? employee.role
                        : employee.job_title &&
                            employee.role &&
                            employee.role !== employee.job_title
                          ? employee.role
                          : `Added ${formatDate(employee.created_at)}`;

                    return (
                      <TableRow key={employee.id} className="align-top">
                        <TableCell>
                          <div className="flex items-start gap-3">
                            <Avatar size="sm">
                              <AvatarFallback>
                                {/* Get the Initials */}
                                {employee.name
                                  .split(" ")
                                  .map((word) => word.charAt(0).toUpperCase())
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-medium leading-tight">{employee.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {contact || "No contact details on file"}
                              </div>
                              {row.isRecentlyAdded && (
                                <Badge variant="secondary" className="mt-2">
                                  Added recently
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {row.crewNames.length === 0 ? (
                            <span className="text-sm text-muted-foreground">Unassigned</span>
                          ) : (
                            <div className="space-y-1">
                              {row.crewNames.slice(0, 2).map((crewName) => (
                                <div key={crewName} className="text-sm font-medium">
                                  {crewName}
                                </div>
                              ))}
                              {row.crewNames.length > 2 && (
                                <div className="text-xs text-muted-foreground">
                                  +{row.crewNames.length - 2} more crews
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">
                            {employee.job_title ?? employee.role ?? "Role pending"}
                          </div>
                          <div className="text-xs text-muted-foreground">{secondaryRoleText}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="text-sm">{payDisplay(employee)}</div>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <div className="space-y-1 text-sm">
                            <div className="font-medium tabular-nums">
                              {row.activeJobs} active · {row.completedJobs} done
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {row.activeJobs > 0
                                ? "Assigned to open work"
                                : "No open work"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge active={employee.is_active} />
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
                                  setEmployeeDialogOpen(true);
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
                    );
                  })
                )}
              </TableBody>
            </Table>
            </div>
          </Card>

          {/* Crew Overview */}
          <Card className="flex flex-1 min-h-0 flex-col overflow-hidden shadow-none max-h-[70vh] lg:max-h-none">
            <div className="shrink-0 border-b p-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Crew Overview</div>
                    <div className="text-xs text-muted-foreground">
                      Crew size, leads, jobs, and payroll.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <FilterDialog
                      title="Crew Overview Filters"
                      description="Search crew cards from a modal."
                      activeCount={crewFilterCount}
                      onClear={() => setCrewQuery("")}
                    >
                      <FilterDialogSection title="Search">
                        <InputGroup>
                          <InputGroupAddon>
                            <Search className="size-4" />
                          </InputGroupAddon>
                          <InputGroupInput
                            value={crewQuery}
                            onChange={(e) => setCrewQuery(e.target.value)}
                            placeholder="Search crews, leads, members..."
                          />
                        </InputGroup>
                      </FilterDialogSection>
                    </FilterDialog>
                    <Badge variant="outline">{model.summary.totalCrews} crews</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {model.crewOverview.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No crews have been created yet.
                </div>
              ) : filteredCrews.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No crews match your search.
                </div>
              ) : (
                filteredCrews.map((crewRow) => {
                  const crew = crewById.get(crewRow.id);
                  if (!crew) return null;

                  return (
                    <div key={crew.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-semibold">{crew.name}</div>
                            {crew.specialization && (
                              <Badge variant="outline" className="bg-primary text-white">{crew.specialization}</Badge>
                            )}
                            <StatusBadge active={crew.is_active} />
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {crewRow.crewLeadName
                              ? `Lead: ${crewRow.crewLeadName}`
                              : "No crew lead assigned"}
                          </div>
                          {crew.description && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {crew.description}
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingCrew(crew);
                              setCrewDialogOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={isPending}
                              >
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete crew?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove <span className="underline font-bold">{crew.name}</span> and its member assignments.
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isPending}>
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  disabled={isPending}
                                  onClick={() => {
                                    startTransition(async () => {
                                      const result = await deleteCrew(crew.id);
                                      if (!result.ok) {
                                        toast.error(result.message ?? "Failed to delete crew.");
                                        return;
                                      }
                                      toast.success("Crew deleted.");
                                    });
                                  }}
                                >
                                  Confirm Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
                        <div className="rounded-md bg-muted/40 px-2 py-1.5">
                          <div className="text-[10px] text-muted-foreground">Members</div>
                          <div className="text-sm font-semibold tabular-nums">
                            {crewRow.members}
                          </div>
                        </div>
                        <div className="rounded-md bg-muted/40 px-2 py-1.5">
                          <div className="text-[10px] text-muted-foreground">Active</div>
                          <div className="text-sm font-semibold tabular-nums">
                            {crewRow.activeJobs}
                          </div>
                        </div>
                        <div className="rounded-md bg-muted/40 px-2 py-1.5">
                          <div className="text-[10px] text-muted-foreground">Done</div>
                          <div className="text-sm font-semibold tabular-nums">
                            {crewRow.completedJobs}
                          </div>
                        </div>
                        <div className="rounded-md bg-muted/40 px-2 py-1.5">
                          <div className="text-[10px] text-muted-foreground">Payroll</div>
                          <div className="text-sm font-semibold tabular-nums">
                            {crewRow.payrollLoggedCents > 0
                              ? money(crewRow.payrollLoggedCents)
                              : "—"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          Crew Members
                        </div>
                        {crew.member_names.length === 0 ? (
                          <div className="mt-2 text-sm text-muted-foreground">
                            No employees assigned to this crew.
                          </div>
                        ) : (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {crew.member_names.slice(0, 5).map((name) => (
                              <Badge key={name} variant="secondary">
                                {name}
                              </Badge>
                            ))}
                            {crew.member_names.length > 5 && (
                              <Badge variant="outline">
                                +{crew.member_names.length - 5} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>{/* end left column */}

        <WorkforceAnalyticsPanel model={model} />
      </div>

      <EmployeeDialog
        key={editingEmployee?.id ?? "new-employee"}
        open={employeeDialogOpen}
        onOpenChange={setEmployeeDialogOpen}
        initial={editingEmployee}
      />

      <CrewDialog
        key={editingCrew?.id ?? "new-crew"}
        open={crewDialogOpen}
        onOpenChange={setCrewDialogOpen}
        initial={editingCrew}
        employees={employees}
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
                if (!deletingEmployee) return;
                const target = deletingEmployee;
                startTransition(async () => {
                  const result = await deleteEmployee(target.id);
                  if (!result.ok) {
                    toast.error(
                      result.message ?? "Failed to delete employee.",
                    );
                    return;
                  }
                  toast.success("Employee deleted.");
                  setDeletingEmployee(null);
                });
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
