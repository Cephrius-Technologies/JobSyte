export type CostType = "direct" | "indirect";
export type ValueType = "actual" | "estimated";
export type ProjectStatus = "active" | "completed" | "not-started";
export type AccountingDateRangePreset = "all" | "30d" | "90d" | "365d";

export const EXPENSE_CATEGORIES = [
  "Labor",
  "Materials",
  "Equipment",
  "Subcontractors",
  "Permits & Fees",
  "Insurance",
  "Overhead",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number] | string;

export type ProjectExpense = {
  id: string;
  project_id: string;
  company_id: string;
  created_by: string;
  payment_id: string | null;
  source_type: "manual" | "payroll";
  name: string;
  description: string | null;
  category: string | null;
  cost_type: CostType;
  value_type: ValueType;
  amount_cents: number;
  expense_date: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectProfitability = {
  project_id: string;
  project_address: string;
  project_city: string | null;
  project_state: string | null;
  builder_name: string | null;
  subdivision: string | null;
  status: ProjectStatus;
  /** Sum of price_cents for completed jobs. */
  revenue_cents: number;
  /** Sum of price_cents for all non-deleted jobs. */
  estimated_revenue_cents: number;
  /** actual direct expenses only. */
  direct_actual_cents: number;
  /** direct expenses (actual + estimated). */
  direct_total_cents: number;
  /** actual indirect expenses only. */
  indirect_actual_cents: number;
  /** indirect expenses (actual + estimated). */
  indirect_total_cents: number;
  // Derived — computed in TypeScript to avoid SQL round-trips
  gross_profit_cents: number;
  net_profit_cents: number;
  est_gross_profit_cents: number;
  est_net_profit_cents: number;
};

export type AccountingOverviewRow = Omit<
  ProjectProfitability,
  "gross_profit_cents" | "net_profit_cents" | "est_gross_profit_cents" | "est_net_profit_cents"
> & {
  gross_profit_cents: number;
  net_profit_cents: number;
  est_gross_profit_cents: number;
  est_net_profit_cents: number;
  total_expenses_cents: number;
};

export type AccountingOverviewJob = {
  project_id: string;
  price_cents: number;
  is_completed: boolean;
  created_at: string | null;
  completed_at: string | null;
  scheduled_completion: string | null;
};

export type AccountingOverviewExpense = {
  project_id: string;
  amount_cents: number;
  cost_type: CostType;
  value_type: ValueType;
  expense_date: string | null;
  created_at: string | null;
};

export type AccountingOverviewInvoice = {
  project_id: string;
  subtotal_cents: number;
  invoice_date: string | null;
  due_date: string | null;
  is_paid: boolean | null;
  created_at: string | null;
};
