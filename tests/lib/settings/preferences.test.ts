import { describe, expect, it } from "vitest";
import {
  clampDueDays,
  readPreferenceSettings,
  resolveInvoiceDueDate,
  suggestDueDate,
  withUpdatedPreferenceSettings,
} from "@/lib/settings/preferences";

describe("preferences helpers", () => {
  it("clamps due days into a safe range", () => {
    expect(clampDueDays("14.6")).toBe(15);
    expect(clampDueDays(-20)).toBe(0);
    expect(clampDueDays(999)).toBe(180);
    expect(clampDueDays("oops", 45)).toBe(45);
  });

  it("reads defaults and preserves valid metadata", () => {
    expect(readPreferenceSettings(null)).toEqual({
      email_invoice_reminders: true,
      weekly_summary: false,
      product_updates: false,
      default_due_days: 30,
      invoice_reminder_last_sent_on: undefined,
      weekly_summary_last_sent_on: undefined,
      product_updates_last_sent_month: undefined,
    });

    expect(
      readPreferenceSettings({
        settings: {
          email_invoice_reminders: false,
          weekly_summary: true,
          product_updates: true,
          default_due_days: "45",
          invoice_reminder_last_sent_on: "2026-05-01",
          weekly_summary_last_sent_on: "2026-05-04",
          product_updates_last_sent_month: "2026-05",
        },
      }),
    ).toEqual({
      email_invoice_reminders: false,
      weekly_summary: true,
      product_updates: true,
      default_due_days: 45,
      invoice_reminder_last_sent_on: "2026-05-01",
      weekly_summary_last_sent_on: "2026-05-04",
      product_updates_last_sent_month: "2026-05",
    });
  });

  it("merges updated settings without dropping sibling metadata", () => {
    expect(
      withUpdatedPreferenceSettings(
        {
          full_name: "Alex Contractor",
          settings: {
            weekly_summary: false,
          },
        },
        {
          weekly_summary: true,
          default_due_days: 21,
        },
      ),
    ).toEqual({
      full_name: "Alex Contractor",
      settings: {
        weekly_summary: true,
        default_due_days: 21,
      },
    });
  });

  it("suggests and resolves invoice due dates from UTC-safe calendar math", () => {
    expect(suggestDueDate("2026-01-31", 14)).toBe("2026-02-14");
    expect(suggestDueDate("2026-02-30", 14)).toBeNull();
    expect(suggestDueDate("2026-01-31", 0)).toBeNull();

    expect(
      resolveInvoiceDueDate(
        "2026-04-10",
        "",
        { settings: { default_due_days: 21 } },
      ),
    ).toBe("2026-05-01");
    expect(
      resolveInvoiceDueDate(
        "2026-04-10",
        "2026-04-22",
        { settings: { default_due_days: 21 } },
      ),
    ).toBe("2026-04-22");
  });
});
