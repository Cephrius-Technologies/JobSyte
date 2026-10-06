![JobSyte wordmark](public/jobsyte-wordmark-black-on-light.png)

# JobSyte

**Contractor operations, simplified.**

JobSyte is a web-based operations management platform built for construction contractors. It provides a central hub for organizing projects, scheduling jobs, managing invoices, and automating routine business communications — all in one place.

## Features

- **Project Management** — Create and organize construction projects by address, builder, and subdivision. Bulk import via CSV.
- **Job Scheduling** — Track individual jobs within projects, assign superintendents, set completion dates, and mark jobs done.
- **Invoicing** — Generate invoices per-project or aggregated by builder, with print-ready layouts and historical snapshots.
- **Dashboard** — At-a-glance metrics: jobs due today, open jobs this week/month, completions, revenue, and an upcoming job calendar.
- **Global Search** — Search across projects, jobs, and invoices with a `Cmd+K` command palette.
- **Automated Emails** — Configurable invoice reminders, weekly summaries, and product update notifications sent via cron job.
- **Settings** — Manage company profile, account details, and notification preferences including custom invoice due-day offsets.

## Tech Stack

- **Framework:** Next.js (App Router) + React
- **Database & Auth:** Supabase (PostgreSQL + Supabase Auth)
- **Styling:** Tailwind CSS + shadcn/ui + Radix UI
- **Animations:** Framer Motion
- **Email:** Resend API
- **Deployment:** Vercel

## Getting Started
To get started with JobSyte, refer to the JobSyte official documentation.

## Testing

- Run `npm run lint` to catch static issues before pushing.
- Run `npm run test:run` for the full local test suite.
- Run `npm run test:coverage` to generate a coverage report in `coverage/`.
