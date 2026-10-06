import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ProjectProfitability, ProjectStatus } from "@/components/accounting/types";

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function ProfitLine({
  label,
  cents,
  isEstimate = false,
  bold = false,
}: {
  label: string;
  cents: number;
  isEstimate?: boolean;
  bold?: boolean;
}) {
  const isNeg = cents < 0;
  return (
    <div className={`flex items-center justify-between gap-3 ${bold ? "font-semibold" : "text-sm"}`}>
      <span className="text-muted-foreground leading-none">
        {label}
        {isEstimate && (
          <span className="ml-1 text-xs font-normal text-yellow-600 dark:text-yellow-400">
            (est.)
          </span>
        )}
      </span>
      <span
        className={
          isNeg
            ? "tabular-nums leading-none text-destructive"
            : "tabular-nums leading-none text-foreground"
        }
      >
        {money(cents)}
      </span>
    </div>
  );
}

function statusColors(status: ProjectStatus) {
  if (status === "completed") return "border-green-300 bg-green-100 text-green-800";
  if (status === "active")    return "border-blue-300 bg-blue-100 text-blue-800";
  return "border-gray-300 bg-gray-100 text-gray-600";
}

function statusLabel(status: ProjectStatus) {
  if (status === "completed")   return "Completed";
  if (status === "active")      return "Active";
  return "Not Started";
}

export function ProfitabilityCard({
  data,
  projectId,
  showLink = false,
}: {
  data: ProjectProfitability;
  projectId: string;
  showLink?: boolean;
}) {
  const isCompleted = data.status === "completed";

  const revenue       = isCompleted ? data.revenue_cents       : data.estimated_revenue_cents;
  const directCosts   = isCompleted ? data.direct_actual_cents  : data.direct_total_cents;
  const indirectCosts = isCompleted ? data.indirect_actual_cents : data.indirect_total_cents;
  const grossProfit   = isCompleted ? data.gross_profit_cents   : data.est_gross_profit_cents;
  const netProfit     = isCompleted ? data.net_profit_cents     : data.est_net_profit_cents;

  const margin = revenue !== 0 ? Math.round((netProfit / revenue) * 100) : null;
  const profitTone = netProfit < 0 ? "text-destructive" : "text-foreground";

  return (
    <Card className="p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Profitability</div>
        <Badge variant="outline" className={statusColors(data.status)}>
          {statusLabel(data.status)}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="space-y-0.5 rounded-md border bg-muted/10 px-3 py-2.5">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {isCompleted ? "Net Profit" : "Estimated Net Profit"}
          </div>
          <div className={`text-3xl font-semibold leading-none tabular-nums ${profitTone}`}>
            {money(netProfit)}
          </div>
          <div className="text-sm text-muted-foreground">
            Gross Profit: <span className="tabular-nums text-foreground">{money(grossProfit)}</span>
          </div>
        </div>

        <ProfitLine
          label="Revenue"
          cents={revenue}
          isEstimate={!isCompleted}
        />
        <ProfitLine
          label="Direct Costs"
          cents={-directCosts}
          isEstimate={!isCompleted}
        />
        <ProfitLine
          label="Indirect Costs"
          cents={-indirectCosts}
          isEstimate={!isCompleted}
        />
        <div className="border-t pt-2 space-y-1.5">
          <ProfitLine
            label="Gross Profit"
            cents={grossProfit}
            isEstimate={!isCompleted}
            bold
          />
          <ProfitLine
            label="Net Profit"
            cents={netProfit}
            isEstimate={!isCompleted}
            bold
          />
        </div>

        {margin !== null && (
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span>Net Margin</span>
            <span className={margin < 0 ? "text-destructive" : ""}>{margin}%</span>
          </div>
        )}
      </div>

      {showLink && (
        <div className="border-t pt-2.5">
          <Link
            href={`/accounting/${projectId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            View Accounting
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}
    </Card>
  );
}

/** Compact inline version for the overview table. */
export function ProfitabilityInline({
  netProfit,
  revenue,
  isEstimate,
}: {
  netProfit: number;
  revenue: number;
  isEstimate: boolean;
}) {
  const margin = revenue !== 0 ? Math.round((netProfit / revenue) * 100) : null;
  const isNeg  = netProfit < 0;

  return (
    <div className="text-right">
      <div
        className={`font-medium tabular-nums ${isNeg ? "text-destructive" : "text-foreground"}`}
      >
        {money(netProfit)}
        {isEstimate && (
          <span className="ml-1 text-xs font-normal text-yellow-600 dark:text-yellow-400">est.</span>
        )}
      </div>
      {margin !== null && (
        <div className="text-xs text-muted-foreground">{margin}% margin</div>
      )}
    </div>
  );
}
