# JobSyte UI redesign

Implemented on the existing `ui/rework` branch. No production push or merge was performed.

## Design system

Light mode uses a near-white page (`#F8F9FB`), white surfaces, neutral borders, muted secondary text, and an indigo primary action (`#4338CA`). Dark mode uses charcoal pages (`#111318`), elevated surfaces (`#191C23`), and a readable indigo accent (`#A5B4FC`). Success, warning, information, and error states have semantic foreground and soft-background tokens.

Inter remains the application font. Page titles use 24px semibold type; section titles use 16px; body text uses 14px; metadata uses 12px. Desktop gutters are 24–32px; mobile gutters are 16px. Page content is constrained to 1600px. Controls use 40px defaults with 44px minimum touch targets on phones, excluding calendar date cells.

## Changes

- Quiet sidebar, compact header, constrained content, skip link, and route-scoped breadcrumbs/actions.
- Shared `PageHeader`, `StatCard`, `StatusBadge`, `EmptyState`, and `PageSkeleton` components; updated shadcn primitives.
- Neutral dashboard summaries and section styling; four explicit project metrics; consistent jobs badges and tables.
- Compact project financial/status summaries use columns and explicit gaps to keep Jobs and the map higher on desktop. On smaller screens, Jobs and the map precede the financial breakdown; the project-detail skeleton follows this layout.
- Project and invoice tables on desktop, with readable list rows on mobile/tablet. Existing grouped views and filters remain available.
- Projects has a dedicated route loading layout matching its header, toolbar, mobile list, desktop table, and desktop preview panel. It reads the same saved view preference as the page and shows nested subdivision/builder/street placeholders for Grouped view. Project detail retains its separate metric-and-table loading layout.
- Project actions, including the existing delete confirmation, remain accessible from the action menu.
- Better project/job dialogs, associated form labels, searchable saved selections, and viewport-limited dropdowns.
- Invoice creation sections, visible selected jobs, and a mobile action footer with live subtotal and safe-area spacing.
- Semantic invoice document table with separate description, project address, subdivision, and amount columns. Print CSS excludes shell/actions, repeats table headers, and permits page overflow.
- Consistent settings/auth styling and shared improvements across accounting, workforce, payroll, and calendar controls.

## Preserved behavior

Supabase clients, queries, server actions, middleware, company context, authentication/session handling, database schema, and RLS assumptions were not redesigned. Server Components remain server components. Existing saved builders, subdivisions, project presets, contractor presets, and bill-to presets continue using their existing storage and actions. No independent builder CRUD architecture or new database-backed billing fields were introduced.

Two intentional presentation-state changes are covered by regression tests:

1. Breadcrumbs and contextual actions are scoped to the route, preventing a previous page's content from lingering during navigation.
2. Builder invoice jobs start unchecked. Explicit selection still supports completed work from multiple projects under the same builder, and only selected job IDs are submitted.

The map remains inside Projects and is absent from sidebar navigation. Pre-existing edits to the project dialog and project-map message, and the deleted standalone Map page, were preserved.

## Validation

- Production build passes.
- Full `tsc --noEmit` passes. Existing tests needed explicit Vitest imports and current employee fixture fields; application types were not weakened.
- All 48 tests across 14 files pass, including the new breadcrumb and invoice-selection regressions.
- ESLint has no errors. Three existing warnings remain in the demo component and edit-job dialog.
- `git diff --check` passes.
- HTTP smoke checks: `/login`, `/signup`, and `/verify` return 200; signed-out requests to Dashboard, Projects, Invoices, invoice creation, and Settings redirect to `/login`.

## Browser validation still required

The in-app browser returned no available sessions. Authenticated visual QA, live Supabase submissions, actual print pagination, and screenshots at 375, 768, 1024, 1440, and 1920px have therefore not been verified. Automated component tests use mocked data; HTTP checks verify signed-out routing, not successful sign-in.

Before release, review both themes at those widths; create a project with saved/new lookup values; add and complete/uncomplete a job; create an invoice across two projects; verify the subtotal and separate subdivision column; check delete-menu cancellation; and inspect a multi-page print preview. Use an authorized test account and test records for write operations.
