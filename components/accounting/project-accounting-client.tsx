"use client";

// Onboarding: project-level accounting view. It shares expense dialogs and table
// components with the global accounting page, all backed by
// `app/(jobsyte-app)/(app)/accounting/actions.ts`.
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AddExpenseButton } from "@/components/accounting/add-expense-dialog";
import { ExpenseTable } from "@/components/accounting/expense-table";
import { ProfitabilityCard } from "@/components/accounting/profitability-card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ProjectExpense, ProjectProfitability } from "@/components/accounting/types";

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

function SummaryTile({
  label,
  value,
  sub,
  colorClass,
}: {
  label: string;
  value: string;
  sub?: string;
  colorClass?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${colorClass ?? ""}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

export function ProjectAccountingClient({
  projectId,
  profitability,
  expenses,
}: {
  projectId: string;
  profitability: ProjectProfitability;
  expenses: ProjectExpense[];
}) {
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");
  const isCompleted   = profitability.status === "completed";
  const revenue       = isCompleted ? profitability.revenue_cents       : profitability.estimated_revenue_cents;
  const directCosts   = isCompleted ? profitability.direct_actual_cents  : profitability.direct_total_cents;
  const indirectCosts = isCompleted ? profitability.indirect_actual_cents : profitability.indirect_total_cents;
  const grossProfit   = isCompleted ? profitability.gross_profit_cents    : profitability.est_gross_profit_cents;
  const netProfit     = isCompleted ? profitability.net_profit_cents     : profitability.est_net_profit_cents;

  const totalExpenses = directCosts + indirectCosts;
  const marginPct = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;
  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount_cents, 0);
  const actualExpenseCount = expenses.filter((expense) => expense.value_type === "actual").length;
  const estimatedExpenseCount = expenses.filter((expense) => expense.value_type === "estimated").length;

  const revenueFill = "var(--color-revenue)";
  const directFill = "var(--color-direct)";
  const indirectFill = "var(--color-indirect)";
  const netFill = "var(--color-net)";

  const financialChartData = [
    { label: "Revenue", amount: revenue, fill: revenueFill },
    { label: "Direct", amount: directCosts, fill: directFill },
    { label: "Indirect", amount: indirectCosts, fill: indirectFill },
    { label: "Net", amount: netProfit, fill: netFill },
  ];

  const pieChartData = [
    { label: "Direct Costs", amount: directCosts, fill: directFill },
    { label: "Indirect Costs", amount: indirectCosts, fill: indirectFill },
    {
      label: netProfit < 0 ? "Loss" : "Net Profit",
      amount: Math.abs(netProfit),
      fill: netFill,
    },
  ].filter((entry) => entry.amount > 0);

  const pieTotal = pieChartData.reduce((sum, item) => sum + item.amount, 0);

  const chartConfig = {
    revenue: {
      label: "Revenue",
      theme: {
        light: "hsl(220 9% 46%)",
        dark: "hsl(220 7% 36%)",
      },
    },
    direct: { label: "Direct", color: "hsl(221 83% 53%)" },
    indirect: { label: "Indirect", color: "hsl(25 95% 53%)" },
    net: { label: "Net", color: netProfit < 0 ? "hsl(var(--destructive))" : "hsl(142 71% 45%)" },
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <SummaryTile
          label={isCompleted ? "Revenue" : "Est. Revenue"}
          value={money(revenue)}
        />
        <SummaryTile
          label={isCompleted ? "Gross Profit" : "Est. Gross Profit"}
          value={money(grossProfit)}
          colorClass={grossProfit < 0 ? "text-destructive" : "text-foreground"}
        />
        <SummaryTile
          label={isCompleted ? "Total Costs" : "Est. Total Costs"}
          value={money(totalExpenses)}
          sub={`${money(directCosts)} direct • ${money(indirectCosts)} indirect`}
        />
        <SummaryTile
          label={isCompleted ? "Net Profit" : "Est. Net Profit"}
          value={money(netProfit)}
          colorClass={netProfit < 0 ? "text-destructive" : "text-green-600"}
          sub={`${marginPct}% margin`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <ProfitabilityCard data={profitability} projectId={projectId} />

        <Card className="p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-semibold">Financial Overview</div>
              <div className="text-xs text-muted-foreground">
                Compare totals as bars or switch to a financial mix view.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="w-fit">
                {isCompleted ? "Actuals" : "Estimated"}
              </Badge>
              <ToggleGroup
                type="single"
                value={chartType}
                onValueChange={(value) => {
                  if (value === "bar" || value === "pie") {
                    setChartType(value);
                  }
                }}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="bar" aria-label="Show bar chart">
                  Bar
                </ToggleGroupItem>
                <ToggleGroupItem value="pie" aria-label="Show pie chart">
                  Pie
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="mt-4">
            <ChartContainer
              config={chartConfig}
              className="h-65 w-full aspect-auto"
            >
              {chartType === "bar" ? (
                <BarChart data={financialChartData} margin={{ top: 12, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                  />
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
                        formatter={(value, _name, item) => {
                          return (
                            <div className="flex w-full items-center justify-between gap-3">
                              <span>{item.payload.label}</span>
                              <span className="font-mono tabular-nums">{money(Number(value))}</span>
                            </div>
                          );
                        }}
                      />
                    }
                  />
                  <Bar dataKey="amount" radius={8} maxBarSize={48}>
                    {financialChartData.map((entry) => (
                      <Cell key={entry.label} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value, _name, item) => {
                          const amount = Number(value);
                          const pct = pieTotal > 0 ? Math.round((amount / pieTotal) * 100) : 0;

                          return (
                            <div className="flex w-full items-center justify-between gap-3">
                              <span>{item.payload.label}</span>
                              <span className="font-mono tabular-nums">
                                {money(amount)} • {pct}%
                              </span>
                            </div>
                          );
                        }}
                      />
                    }
                  />
                  <Pie
                    data={pieChartData}
                    dataKey="amount"
                    nameKey="label"
                    innerRadius={60}
                    outerRadius={92}
                    paddingAngle={3}
                  >
                    {pieChartData.map((entry) => (
                      <Cell key={entry.label} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              )}
            </ChartContainer>
          </div>

          <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">
                {chartType === "bar" ? "Expense Entries" : "Pie Total"}
              </div>
              <div className="mt-1 text-lg font-semibold">{expenses.length}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                {chartType === "bar" ? "Actual vs Est." : "Largest Segment"}
              </div>
              <div className="mt-1 text-lg font-semibold">
                {chartType === "bar"
                  ? `${actualExpenseCount}/${estimatedExpenseCount}`
                  : (pieChartData.toSorted((a, b) => b.amount - a.amount)[0]?.label ?? "—")}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                {chartType === "bar" ? "Tracked Spend" : "Displayed Total"}
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {chartType === "bar" ? money(expenseTotal) : money(pieTotal)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Expenses</div>
            <div className="text-xs text-muted-foreground">
              {expenses.length} expense{expenses.length === 1 ? "" : "s"} •{" "}
              {money(expenses.reduce((s, e) => s + e.amount_cents, 0))} total
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AddExpenseButton projectId={projectId} />
          </div>
        </div>

        <div className="mt-4">
          <ExpenseTable expenses={expenses} />
        </div>
      </Card>
    </div>
  );
}
