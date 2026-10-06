"use client";

// Onboarding: company-wide accounting dashboard. Project-specific expense views
// share components with `project-accounting-client.tsx`; mutations live in
// `app/(jobsyte-app)/(app)/accounting/actions.ts`.
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HighlightScroller } from "@/components/ui/highlight-scroller";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  FilterDialog,
  FilterDialogSection,
} from "@/components/ui/filter-dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProfitabilityInline } from "@/components/accounting/profitability-card";
import {
  getProjectLocationSubtitle,
  getProjectStreetTitle,
} from "@/components/projects/project-location";
import { cn } from "@/lib/utils";
import type {
  AccountingDateRangePreset,
  AccountingOverviewExpense,
  AccountingOverviewInvoice,
  AccountingOverviewJob,
  AccountingOverviewRow,
  ProjectStatus,
} from "@/components/accounting/types";

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function compactMoney(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function startOfToday(todayKey: string) {
  const today = new Date(`${todayKey}T12:00:00`);
  today.setHours(0, 0, 0, 0);
  return today;
}

function dateFromValue(value: string | null | undefined) {
  if (!value) return null;

  const raw = value.includes("T") ? value : `${value}T12:00:00`;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getRangeStart(preset: AccountingDateRangePreset, todayKey: string) {
  if (preset === "all") return null;

  const today = startOfToday(todayKey);
  const start = new Date(today);

  if (preset === "30d") start.setDate(start.getDate() - 29);
  if (preset === "90d") start.setDate(start.getDate() - 89);
  if (preset === "365d") start.setDate(start.getDate() - 364);

  return start;
}

function isWithinRange(value: string | null | undefined, rangeStart: Date | null) {
  const date = dateFromValue(value);
  if (!date) return false;
  if (!rangeStart) return true;
  return date >= rangeStart;
}

function statusBadge(status: ProjectStatus) {
  if (status === "completed")
    return <Badge variant="outline" className="border-green-300 bg-green-100 text-green-800">Completed</Badge>;
  if (status === "active")
    return <Badge variant="outline" className="border-blue-300 bg-blue-100 text-blue-800">Active</Badge>;
  return <Badge variant="outline" className="border-gray-300 bg-gray-100 text-gray-600">Not Started</Badge>;
}

function formatPresetLabel(value: AccountingDateRangePreset) {
  if (value === "30d") return "30D";
  if (value === "90d") return "90D";
  if (value === "365d") return "12M";
  return "All";
}

function SummaryCard({
  label,
  value,
  icon,
  colorClass,
  sub,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  colorClass?: string;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        {icon}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${colorClass ?? ""}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function InsightCard({
  title,
  project,
  value,
  tone = "default",
  subtitle,
}: {
  title: string;
  project?: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
  subtitle?: string;
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-green-600",
    warning: "text-yellow-600",
    danger: "text-destructive",
  }[tone];

  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="mt-2 line-clamp-1 text-sm font-medium">{project ?? "No project data yet"}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {subtitle && <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>}
    </Card>
  );
}

type StatusFilter = "all" | ProjectStatus;

type OverviewRowMetrics = AccountingOverviewRow & {
  displayRevenue: number;
  displayNetProfit: number;
  marginPct: number;
  varianceCents: number;
  outstandingReceivablesCents: number;
  overdueReceivablesCents: number;
  paidReceivablesCents: number;
  hasActivityInRange: boolean;
};

export function AccountingOverviewClient({
  rows,
  jobs,
  expenses,
  invoices,
  todayKey,
}: {
  rows: AccountingOverviewRow[];
  jobs: AccountingOverviewJob[];
  expenses: AccountingOverviewExpense[];
  invoices: AccountingOverviewInvoice[];
  todayKey: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatus] = useState<StatusFilter>("all");
  const [dateRange, setDateRange] = useState<AccountingDateRangePreset>("90d");
  const activeFilterCount =
    Number(query.trim().length > 0) +
    Number(statusFilter !== "all") +
    Number(dateRange !== "90d");

  const rangeStart = useMemo(() => getRangeStart(dateRange, todayKey), [dateRange, todayKey]);
  const today = useMemo(() => startOfToday(todayKey), [todayKey]);

  const jobsByProject = useMemo(() => {
    const map = new Map<string, AccountingOverviewJob[]>();
    for (const job of jobs) {
      const list = map.get(job.project_id) ?? [];
      list.push(job);
      map.set(job.project_id, list);
    }
    return map;
  }, [jobs]);

  const expensesByProject = useMemo(() => {
    const map = new Map<string, AccountingOverviewExpense[]>();
    for (const expense of expenses) {
      const list = map.get(expense.project_id) ?? [];
      list.push(expense);
      map.set(expense.project_id, list);
    }
    return map;
  }, [expenses]);

  const invoicesByProject = useMemo(() => {
    const map = new Map<string, AccountingOverviewInvoice[]>();
    for (const invoice of invoices) {
      const list = map.get(invoice.project_id) ?? [];
      list.push(invoice);
      map.set(invoice.project_id, list);
    }
    return map;
  }, [invoices]);

  const periodRows = useMemo<OverviewRowMetrics[]>(() => {
    return rows
      .map((row) => {
        const projectJobs = jobsByProject.get(row.project_id) ?? [];
        const projectExpenses = expensesByProject.get(row.project_id) ?? [];
        const projectInvoices = invoicesByProject.get(row.project_id) ?? [];

        const actualRevenue = projectJobs
          .filter((job) => job.is_completed && isWithinRange(job.completed_at ?? job.created_at, rangeStart))
          .reduce((sum, job) => sum + (job.price_cents ?? 0), 0);

        const estimatedRevenue = projectJobs
          .filter((job) => isWithinRange(job.scheduled_completion ?? job.created_at, rangeStart))
          .reduce((sum, job) => sum + (job.price_cents ?? 0), 0);

        const directActual = projectExpenses
          .filter(
            (expense) =>
              expense.cost_type === "direct" &&
              expense.value_type === "actual" &&
              isWithinRange(expense.expense_date ?? expense.created_at, rangeStart),
          )
          .reduce((sum, expense) => sum + expense.amount_cents, 0);

        const directTotal = projectExpenses
          .filter(
            (expense) =>
              expense.cost_type === "direct" &&
              isWithinRange(expense.expense_date ?? expense.created_at, rangeStart),
          )
          .reduce((sum, expense) => sum + expense.amount_cents, 0);

        const indirectActual = projectExpenses
          .filter(
            (expense) =>
              expense.cost_type === "indirect" &&
              expense.value_type === "actual" &&
              isWithinRange(expense.expense_date ?? expense.created_at, rangeStart),
          )
          .reduce((sum, expense) => sum + expense.amount_cents, 0);

        const indirectTotal = projectExpenses
          .filter(
            (expense) =>
              expense.cost_type === "indirect" &&
              isWithinRange(expense.expense_date ?? expense.created_at, rangeStart),
          )
          .reduce((sum, expense) => sum + expense.amount_cents, 0);

        const paidReceivables = projectInvoices
          .filter((invoice) => Boolean(invoice.is_paid) && isWithinRange(invoice.invoice_date ?? invoice.created_at, rangeStart))
          .reduce((sum, invoice) => sum + (invoice.subtotal_cents ?? 0), 0);

        const outstandingReceivables = projectInvoices
          .filter((invoice) => !invoice.is_paid && isWithinRange(invoice.invoice_date ?? invoice.created_at, rangeStart))
          .reduce((sum, invoice) => sum + (invoice.subtotal_cents ?? 0), 0);

        const overdueReceivables = projectInvoices
          .filter((invoice) => {
            if (invoice.is_paid || !invoice.due_date) return false;
            const dueDate = dateFromValue(invoice.due_date);
            if (!dueDate) return false;
            return dueDate < today && isWithinRange(invoice.invoice_date ?? invoice.created_at, rangeStart);
          })
          .reduce((sum, invoice) => sum + (invoice.subtotal_cents ?? 0), 0);

        const totalExpenses = directTotal + indirectTotal;
        const actualNetProfit = actualRevenue - directActual - indirectActual;
        const estimatedNetProfit = estimatedRevenue - directTotal - indirectTotal;
        const displayRevenue = row.status === "completed" ? actualRevenue : estimatedRevenue;
        const displayNetProfit = row.status === "completed" ? actualNetProfit : estimatedNetProfit;
        const varianceCents = actualNetProfit - estimatedNetProfit;
        const marginPct = percent(displayNetProfit, displayRevenue);
        const hasActivityInRange =
          actualRevenue > 0 ||
          estimatedRevenue > 0 ||
          totalExpenses > 0 ||
          paidReceivables > 0 ||
          outstandingReceivables > 0;

        return {
          ...row,
          revenue_cents: actualRevenue,
          estimated_revenue_cents: estimatedRevenue,
          direct_actual_cents: directActual,
          direct_total_cents: directTotal,
          indirect_actual_cents: indirectActual,
          indirect_total_cents: indirectTotal,
          gross_profit_cents: actualRevenue - directActual,
          net_profit_cents: actualNetProfit,
          est_gross_profit_cents: estimatedRevenue - directTotal,
          est_net_profit_cents: estimatedNetProfit,
          total_expenses_cents: totalExpenses,
          displayRevenue,
          displayNetProfit,
          marginPct,
          varianceCents,
          outstandingReceivablesCents: outstandingReceivables,
          overdueReceivablesCents: overdueReceivables,
          paidReceivablesCents: paidReceivables,
          hasActivityInRange,
        };
      })
      .filter((row) => dateRange === "all" || row.hasActivityInRange);
  }, [rows, jobsByProject, expensesByProject, invoicesByProject, rangeStart, today, dateRange]);

  const counts = useMemo(() => {
    return {
      all: periodRows.length,
      active: periodRows.filter((row) => row.status === "active").length,
      completed: periodRows.filter((row) => row.status === "completed").length,
      "not-started": periodRows.filter((row) => row.status === "not-started").length,
    };
  }, [periodRows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return periodRows.filter((row) => {
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      const matchesQuery =
        q.length === 0 ||
        getProjectStreetTitle(row).toLowerCase().includes(q) ||
        getProjectLocationSubtitle(row).toLowerCase().includes(q) ||
        (row.builder_name ?? "").toLowerCase().includes(q) ||
        (row.subdivision ?? "").toLowerCase().includes(q);

      return matchesStatus && matchesQuery;
    });
  }, [periodRows, query, statusFilter]);

  const totals = useMemo(() => {
    const revenue = filtered.reduce((sum, row) => sum + row.revenue_cents, 0);
    const estRevenue = filtered.reduce((sum, row) => sum + row.estimated_revenue_cents, 0);
    const totalExpenses = filtered.reduce((sum, row) => sum + row.total_expenses_cents, 0);
    const netProfit = filtered.reduce((sum, row) => sum + row.net_profit_cents, 0);
    const estNetProfit = filtered.reduce((sum, row) => sum + row.est_net_profit_cents, 0);
    const variance = filtered.reduce((sum, row) => sum + row.varianceCents, 0);
    const outstandingReceivables = filtered.reduce((sum, row) => sum + row.outstandingReceivablesCents, 0);
    const overdueReceivables = filtered.reduce((sum, row) => sum + row.overdueReceivablesCents, 0);
    const paidReceivables = filtered.reduce((sum, row) => sum + row.paidReceivablesCents, 0);

    return {
      revenue,
      estRevenue,
      totalExpenses,
      netProfit,
      estNetProfit,
      variance,
      outstandingReceivables,
      overdueReceivables,
      paidReceivables,
    };
  }, [filtered]);

  const insights = useMemo(() => {
    const topPerformer = [...filtered].sort((a, b) => b.displayNetProfit - a.displayNetProfit)[0];
    const biggestExpense = [...filtered].sort((a, b) => b.total_expenses_cents - a.total_expenses_cents)[0];
    const needsAttention = [...filtered].sort((a, b) => a.displayNetProfit - b.displayNetProfit)[0];

    return {
      topPerformer,
      biggestExpense,
      needsAttention,
    };
  }, [filtered]);

  const trendData = useMemo(() => {
    const projectIds = new Set(filtered.map((row) => row.project_id));
    const chartStart = rangeStart ?? (() => {
      const start = new Date(today);
      start.setMonth(start.getMonth() - 11, 1);
      start.setHours(0, 0, 0, 0);
      return start;
    })();

    const bucketStart = new Date(chartStart.getFullYear(), chartStart.getMonth(), 1);
    const end = new Date(today);
    const months: { label: string; revenue: number; expenses: number; net: number }[] = [];

    for (const cursor = new Date(bucketStart); cursor <= end; cursor.setMonth(cursor.getMonth() + 1)) {
      months.push({
        label: cursor.toLocaleDateString("en-US", { month: "short" }),
        revenue: 0,
        expenses: 0,
        net: 0,
      });
    }

    const monthIndex = (value: string | null | undefined) => {
      const date = dateFromValue(value);
      if (!date || date < bucketStart) return -1;
      const diff = (date.getFullYear() - bucketStart.getFullYear()) * 12 + (date.getMonth() - bucketStart.getMonth());
      return diff >= 0 && diff < months.length ? diff : -1;
    };

    for (const job of jobs) {
      if (!projectIds.has(job.project_id) || !job.is_completed) continue;
      const index = monthIndex(job.completed_at ?? job.created_at);
      if (index >= 0) months[index].revenue += job.price_cents ?? 0;
    }

    for (const expense of expenses) {
      if (!projectIds.has(expense.project_id)) continue;
      const index = monthIndex(expense.expense_date ?? expense.created_at);
      if (index >= 0) months[index].expenses += expense.amount_cents;
    }

    for (const month of months) {
      month.net = month.revenue - month.expenses;
    }

    return months;
  }, [filtered, jobs, expenses, rangeStart, today]);

  const varianceChartData = useMemo(() => {
    return [
      { label: "Actual Net", amount: totals.netProfit, fill: totals.netProfit < 0 ? "hsl(var(--destructive))" : "hsl(142 71% 45%)" },
      { label: "Projected Net", amount: totals.estNetProfit, fill: totals.estNetProfit < 0 ? "hsl(var(--destructive))" : "hsl(217 91% 60%)" },
      { label: "Variance", amount: totals.variance, fill: totals.variance < 0 ? "hsl(var(--destructive))" : "hsl(43 96% 56%)" },
    ];
  }, [totals]);

  const chartConfig = {
    revenue: { label: "Revenue", color: "hsl(221 83% 53%)" },
    expenses: { label: "Expenses", color: "hsl(25 95% 53%)" },
    net: { label: "Net", color: "hsl(142 71% 45%)" },
  };

  const varianceChartConfig = {
    actualNet: { label: "Actual Net", color: "hsl(142 71% 45%)" },
    projectedNet: { label: "Projected Net", color: "hsl(217 91% 60%)" },
    variance: { label: "Variance", color: "hsl(43 96% 56%)" },
  };

  if (rows.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">
          No projects found. Create a project and add expenses to start tracking profitability.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <HighlightScroller />
      <Card className="overflow-hidden">
        <div className="border-b p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-base font-semibold">Portfolio Snapshot</div>
              <div className="text-sm text-muted-foreground">
                Monitor profitability, receivables, and margin risk across the selected period.
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <FilterDialog
                title="Accounting Filters"
                description="Apply one set of filters across the snapshot and profitability table."
                activeCount={activeFilterCount}
                onClear={() => {
                  setQuery("");
                  setStatus("all");
                  setDateRange("90d");
                }}
              >
                <FilterDialogSection title="Date Range">
                  <div className="flex flex-wrap gap-2">
                    {(["30d", "90d", "365d", "all"] as AccountingDateRangePreset[]).map(
                      (preset) => {
                        const active = dateRange === preset;
                        return (
                          <Button
                            key={preset}
                            type="button"
                            variant={active ? "default" : "outline"}
                            size="sm"
                            onClick={() => setDateRange(preset)}
                          >
                            {formatPresetLabel(preset)}
                          </Button>
                        );
                      },
                    )}
                  </div>
                </FilterDialogSection>

                <FilterDialogSection title="Status">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    {[
                      { key: "all", label: "All", count: counts.all },
                      { key: "active", label: "Active", count: counts.active },
                      { key: "completed", label: "Completed", count: counts.completed },
                      {
                        key: "not-started",
                        label: "Not Started",
                        count: counts["not-started"],
                      },
                    ].map((tab) => {
                      const active = statusFilter === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setStatus(tab.key as StatusFilter)}
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

                <FilterDialogSection title="Search">
                  <InputGroup>
                    <InputGroupAddon>
                      <Search className="size-4" />
                    </InputGroupAddon>
                    <InputGroupInput
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search projects..."
                    />
                  </InputGroup>
                </FilterDialogSection>
              </FilterDialog>
              <Badge variant="outline">{filtered.length} Visible Projects</Badge>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            <SummaryCard
              label="Realized Revenue"
              value={money(totals.revenue)}
              sub="Completed jobs in range"
            />
            <SummaryCard
              label="Projected Revenue"
              value={money(totals.estRevenue)}
              sub="Scheduled + created pipeline"
            />
            <SummaryCard
              label="Total Expenses"
              value={money(totals.totalExpenses)}
              sub={`${percent(totals.totalExpenses, totals.estRevenue)}% of projected revenue`}
            />
            <SummaryCard
              label="Net Profit"
              value={money(totals.estNetProfit)}
              colorClass={totals.estNetProfit < 0 ? "text-destructive" : "text-green-600"}
              icon={
                totals.estNetProfit >= 0
                  ? <TrendingUp className="size-4 text-green-600" />
                  : <TrendingDown className="size-4 text-destructive" />
              }
              sub={`${percent(totals.estNetProfit, totals.estRevenue)}% projected margin`}
            />
            <SummaryCard
              label="Net Variance"
              value={money(totals.variance)}
              colorClass={totals.variance < 0 ? "text-destructive" : "text-yellow-600"}
              icon={
                totals.variance >= 0
                  ? <ArrowUpRight className="size-4 text-yellow-600" />
                  : <ArrowDownRight className="size-4 text-destructive" />
              }
              sub="Actual vs projected net"
            />
            <SummaryCard
              label="Outstanding A/R"
              value={money(totals.outstandingReceivables)}
              colorClass={totals.overdueReceivables > 0 ? "text-destructive" : undefined}
              sub={`${money(totals.overdueReceivables)} overdue`}
            />
          </div>
        </div>

        <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="space-y-4">
            <Card className="overflow-hidden border shadow-none">
              <div className="border-b p-4">
                <div className="text-sm font-semibold">Profitability Trend</div>
                <div className="text-xs text-muted-foreground">
                  Revenue, costs, and net movement over time for the selected portfolio slice.
                </div>
              </div>
              <div className="p-4">
                <ChartContainer config={chartConfig} className="h-56 w-full aspect-auto">
                  <LineChart data={trendData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis
                      tickFormatter={(value) => compactMoney(Number(value))}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <div className="flex w-full items-center justify-between gap-3">
                              <span>{typeof name === "string" ? name : "Value"}</span>
                              <span className="font-mono tabular-nums">{money(Number(value))}</span>
                            </div>
                          )}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line dataKey="revenue" name="Revenue" type="monotone" stroke="var(--color-revenue)" strokeWidth={2.5} dot={false} />
                    <Line dataKey="expenses" name="Expenses" type="monotone" stroke="var(--color-expenses)" strokeWidth={2.5} dot={false} />
                    <Line dataKey="net" name="Net" type="monotone" stroke="var(--color-net)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ChartContainer>
              </div>
            </Card>

            <Card className="overflow-hidden border shadow-none">
              <div className="border-b p-4">
                <div className="text-sm font-semibold">Estimate vs Actual</div>
                <div className="text-xs text-muted-foreground">
                  Compare realized and projected net profit for the visible project set.
                </div>
              </div>
              <div className="p-4">
                <ChartContainer config={varianceChartConfig} className="h-56 w-full aspect-auto">
                  <BarChart data={varianceChartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis
                      tickFormatter={(value) => compactMoney(Number(value))}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          hideLabel
                          formatter={(value, _name, item) => (
                            <div className="flex w-full items-center justify-between gap-3">
                              <span>{item.payload.label}</span>
                              <span className="font-mono tabular-nums">{money(Number(value))}</span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="amount" radius={8} maxBarSize={56}>
                      {varianceChartData.map((entry) => (
                        <Cell key={entry.label} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>

                <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Visible Projects</div>
                    <div className="mt-1 text-lg font-semibold">{filtered.length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                    <div className="mt-1 text-lg font-semibold">{filtered.filter((row) => row.status === "completed").length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Outstanding A/R</div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">{money(totals.outstandingReceivables)}</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">A/R Summary</div>
                  <div className="mt-1 text-sm font-medium">Invoice health in the selected range</div>
                </div>
                <Badge variant="outline">{formatPresetLabel(dateRange)}</Badge>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div>
                  <div className="text-xs text-muted-foreground">Outstanding</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">{money(totals.outstandingReceivables)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Overdue</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-destructive">{money(totals.overdueReceivables)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Paid</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-green-600">{money(totals.paidReceivables)}</div>
                </div>
              </div>
            </Card>

            <InsightCard
              title="Top Performer"
              project={
                insights.topPerformer
                  ? getProjectStreetTitle(insights.topPerformer)
                  : undefined
              }
              value={money(insights.topPerformer?.displayNetProfit ?? 0)}
              tone="success"
              subtitle={insights.topPerformer ? `${insights.topPerformer.marginPct}% margin` : undefined}
            />
            <InsightCard
              title="Highest Spend"
              project={
                insights.biggestExpense
                  ? getProjectStreetTitle(insights.biggestExpense)
                  : undefined
              }
              value={money(insights.biggestExpense?.total_expenses_cents ?? 0)}
              subtitle={insights.biggestExpense ? `${money(insights.biggestExpense.displayRevenue)} revenue basis` : undefined}
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold">Project Profitability</div>
            <div className="text-xs text-muted-foreground">
              Drill into a project to review its accounting breakdown, expenses, and chart view.
            </div>
          </div>

          <span className="text-sm text-muted-foreground">
            {filtered.length} project{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="max-h-[55vh] overflow-auto xl:max-h-[calc(100vh-22rem)]">
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-muted/20 hover:bg-muted/20">
                <TableHead className="sticky top-0 z-10 h-11 bg-muted/20 backdrop-blur-sm">Project</TableHead>
                <TableHead className="sticky top-0 z-10 hidden h-11 bg-muted/20 backdrop-blur-sm md:table-cell">Status</TableHead>
                <TableHead className="sticky top-0 z-10 hidden h-11 bg-muted/20 backdrop-blur-sm lg:table-cell text-right">Revenue</TableHead>
                <TableHead className="sticky top-0 z-10 hidden h-11 bg-muted/20 backdrop-blur-sm lg:table-cell text-right">Expenses</TableHead>
                <TableHead className="sticky top-0 z-10 hidden h-11 bg-muted/20 backdrop-blur-sm xl:table-cell text-right">Variance</TableHead>
                <TableHead className="sticky top-0 z-10 h-11 bg-muted/20 backdrop-blur-sm text-right">Net Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No projects match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const isEstimate = row.status !== "completed";
                  const locationSubtitle = getProjectLocationSubtitle(row);

                  return (
                    <TableRow
                      key={row.project_id}
                      className="group h-14 cursor-pointer"
                      onClick={() => router.push(`/accounting/${row.project_id}`)}
                    >
                      <TableCell>
                        <div className="font-medium leading-tight">
                          {getProjectStreetTitle(row)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[row.builder_name, row.subdivision].filter(Boolean).join(" • ")}
                        </div>
                        {locationSubtitle ? (
                          <div className="text-xs text-muted-foreground">
                            {locationSubtitle}
                          </div>
                        ) : null}
                        <div className="mt-1 md:hidden">{statusBadge(row.status)}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {statusBadge(row.status)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums text-sm">
                        {money(row.displayRevenue)}
                        {isEstimate && (
                          <span className="ml-1 text-xs text-yellow-600">est.</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums text-sm">
                        {money(row.total_expenses_cents)}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-right tabular-nums text-sm">
                        <span className={row.varianceCents < 0 ? "text-destructive" : "text-yellow-600"}>
                          {money(row.varianceCents)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <ProfitabilityInline
                          netProfit={row.displayNetProfit}
                          revenue={row.displayRevenue}
                          isEstimate={isEstimate}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

      </Card>
    </div>
  );
}
