import { describe, expect, it } from "vitest";
import {
  buildInvoiceReminderEmail,
  buildProductUpdatesEmail,
  buildWeeklySummaryEmail,
} from "@/lib/notifications/templates";

describe("notification templates", () => {
  it("escapes invoice content and builds the invoice reminder summary", () => {
    const email = buildInvoiceReminderEmail({
      overdueCount: 2,
      dueSoonCount: 1,
      asOfYmd: "2026-05-21",
      appUrl: "https://app.jobsyte.co",
      invoices: [
        {
          invoiceLabel: `INV-001 <script>alert("x")</script>`,
          billTo: "O'Brien Builders & Sons",
          dueDate: "2026-05-25",
          total: "$4,500",
          status: "overdue",
        },
      ],
    });

    expect(email.subject).toBe("JobSyte invoice reminder: 2 overdue, 1 due soon");
    expect(email.html).toContain("Invoice Reminder");
    expect(email.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(email.html).toContain("O&#39;Brien Builders &amp; Sons");
    expect(email.html).toContain("https://app.jobsyte.co/invoices");
  });

  it("summarizes weekly metrics and links back to the dashboard", () => {
    const email = buildWeeklySummaryEmail({
      weekStart: "2026-05-11",
      weekEnd: "2026-05-17",
      appUrl: "https://app.jobsyte.co",
      metrics: {
        jobsCreated: 7,
        jobsCompleted: 4,
        openJobs: 11,
        invoicesIssued: 3,
        totalInvoiced: "$18,400",
        overdueInvoices: 2,
      },
    });

    expect(email.subject).toBe(
      "JobSyte Weekly Summary (2026-05-11 to 2026-05-17)",
    );
    expect(email.html).toContain("Your Weekly Job Snapshot");
    expect(email.html).toContain("Reporting period: <strong>2026-05-11</strong> to <strong>2026-05-17</strong>.");
    expect(email.html).toContain("$18,400");
    expect(email.html).toContain('href="https://app.jobsyte.co/"');
  });

  it("renders product updates using the resolved month label", () => {
    const email = buildProductUpdatesEmail({
      monthKey: "2026-05",
      appUrl: "https://app.jobsyte.co",
      bullets: ["Added crew analytics", "Improved payroll review flows"],
    });

    expect(email.subject).toBe("JobSyte Product Updates (May 2026)");
    expect(email.html).toContain("What Is New In JobSyte");
    expect(email.html).toContain("Added crew analytics");
    expect(email.html).toContain("Improved payroll review flows");
  });
});
