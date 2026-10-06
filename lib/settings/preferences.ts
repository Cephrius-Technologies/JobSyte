// Onboarding: preference data is stored inside Supabase user metadata and read
// by settings UI, invoice due-date defaults, and cron notification routes. Keep
// migration/default logic here instead of scattering metadata parsing.
type UnknownRecord = Record<string, unknown>;

export type PreferenceSettings = {
  email_invoice_reminders: boolean;
  weekly_summary: boolean;
  product_updates: boolean;
  default_due_days: number;
  weather_city_id?: number;
  weather_city_name?: string;
  invoice_reminder_last_sent_on?: string;
  weekly_summary_last_sent_on?: string;
  product_updates_last_sent_month?: string;
};

function asObject(value: unknown): UnknownRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

export function clampDueDays(value: unknown, fallback = 30): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(180, Math.max(0, Math.round(parsed)));
}

export function readPreferenceSettings(userMetadata: unknown): PreferenceSettings {
  const metadata = asObject(userMetadata) ?? {};
  const rawSettings = asObject(metadata.settings) ?? {};

  return {
    email_invoice_reminders:
      typeof rawSettings.email_invoice_reminders === "boolean"
        ? rawSettings.email_invoice_reminders
        : true,
    weekly_summary:
      typeof rawSettings.weekly_summary === "boolean"
        ? rawSettings.weekly_summary
        : false,
    product_updates:
      typeof rawSettings.product_updates === "boolean"
        ? rawSettings.product_updates
        : false,
    default_due_days: clampDueDays(rawSettings.default_due_days, 30),
    weather_city_id:
      typeof rawSettings.weather_city_id === "number" &&
      Number.isSafeInteger(rawSettings.weather_city_id) && rawSettings.weather_city_id > 0
        ? rawSettings.weather_city_id
        : undefined,
    weather_city_name:
      typeof rawSettings.weather_city_name === "string" && rawSettings.weather_city_name.length <= 200
        ? rawSettings.weather_city_name
        : undefined,
    invoice_reminder_last_sent_on:
      typeof rawSettings.invoice_reminder_last_sent_on === "string"
        ? rawSettings.invoice_reminder_last_sent_on
        : undefined,
    weekly_summary_last_sent_on:
      typeof rawSettings.weekly_summary_last_sent_on === "string"
        ? rawSettings.weekly_summary_last_sent_on
        : undefined,
    product_updates_last_sent_month:
      typeof rawSettings.product_updates_last_sent_month === "string"
        ? rawSettings.product_updates_last_sent_month
        : undefined,
  };
}

export function withUpdatedPreferenceSettings(
  userMetadata: unknown,
  next: Partial<PreferenceSettings>,
): UnknownRecord {
  const metadata = asObject(userMetadata) ?? {};
  const existingSettings = asObject(metadata.settings) ?? {};

  return {
    ...metadata,
    settings: {
      ...existingSettings,
      ...next,
    },
  };
}

function parseYmdUtc(value: string): Date | null {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatYmdUtc(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function suggestDueDate(
  invoiceDate: string,
  defaultDueDays: number,
): string | null {
  const days = clampDueDays(defaultDueDays, 30);
  if (days <= 0) return null;

  const baseDate = parseYmdUtc(invoiceDate);
  if (!baseDate) return null;

  const due = new Date(baseDate.getTime());
  due.setUTCDate(due.getUTCDate() + days);
  return formatYmdUtc(due);
}

export function resolveInvoiceDueDate(
  invoiceDate: string,
  dueDateRaw: string,
  userMetadata: unknown,
): string | null {
  const explicitDueDate = dueDateRaw.trim();
  if (explicitDueDate) return explicitDueDate;

  const settings = readPreferenceSettings(userMetadata);
  return suggestDueDate(invoiceDate, settings.default_due_days);
}
