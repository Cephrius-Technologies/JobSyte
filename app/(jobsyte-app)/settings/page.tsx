// Onboarding: settings server page. It loads profile, company, and preference
// data before handing control to `components/settings/settings-page.tsx`.
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { BreadcrumbSetter } from "@/components/app-shell/breadcrumb-setter";
import { SettingsPageClient } from "@/components/settings/settings-page";
import { readPreferenceSettings } from "@/lib/settings/preferences";
import type { ProjectPresetForSettings } from "@/app/(jobsyte-app)/settings/actions";

type CompanyProfile = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
};

type CompanyMembershipRow = {
  company: CompanyProfile | null;
};

type ProjectPresetRow = {
  id: string;
  name: string;
};

type ProjectPresetJobRow = {
  id: string;
  preset_id: string;
  title: string;
  price_cents: number;
  sort_order: number | null;
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  // Read active company from cookie (set by CompanyProvider)
  const cookieStore = await cookies();
  const activeCompanyId = cookieStore.get("jobsyte:active-company-id")?.value;

  // Fetch company profile from the companies table
  let company: CompanyProfile | null = null;

  if (activeCompanyId) {
    const { data } = await supabase
      .from("companies")
      .select("id, name, address, phone")
      .eq("id", activeCompanyId)
      .maybeSingle();
    company = data;
  }

  // Fallback: get the first company the user belongs to
  if (!company) {
    const { data: membership } = await supabase
      .from("company_members")
      .select("company:companies(id, name, address, phone)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    company = (membership as CompanyMembershipRow | null)?.company ?? null;
  }

  const settings = readPreferenceSettings(user.user_metadata);
  let projectPresets: ProjectPresetForSettings[] = [];

  if (company?.id) {
    const [presetsRes, jobsRes] = await Promise.all([
      supabase
        .from("project_presets")
        .select("id, name")
        .eq("company_id", company.id)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("project_preset_jobs")
        .select("id, preset_id, title, price_cents, sort_order")
        .order("sort_order", { ascending: true }),
    ]);

    if (!presetsRes.error && !jobsRes.error) {
      const jobsByPreset = new Map<string, ProjectPresetForSettings["jobs"]>();
      for (const job of (jobsRes.data ?? []) as ProjectPresetJobRow[]) {
        const list = jobsByPreset.get(job.preset_id) ?? [];
        list.push({
          id: job.id,
          title: job.title,
          price_cents: job.price_cents,
          sort_order: job.sort_order ?? 0,
        });
        jobsByPreset.set(job.preset_id, list);
      }

      projectPresets = ((presetsRes.data ?? []) as ProjectPresetRow[]).map(
        (preset) => ({
          id: preset.id,
          name: preset.name,
          jobs: jobsByPreset.get(preset.id) ?? [],
        }),
      );
    }
  }

  return (
    <div className="space-y-6">
      <BreadcrumbSetter crumbs={[{ label: "Settings", href: "/settings" }]} />
      <SettingsPageClient
        initialProfile={{
          companyId: company?.id ?? "",
          companyName: company?.name ?? "",
          address: company?.address ?? "",
          phone: company?.phone ?? "",
        }}
        account={{
          email: user.email ?? "",
          createdAt: user.created_at ?? null,
          lastSignInAt: user.last_sign_in_at ?? null,
        }}
        initialPreferences={{
          emailInvoiceReminders: settings.email_invoice_reminders,
          weeklySummary: settings.weekly_summary,
          productUpdates: settings.product_updates,
          defaultDueDays: settings.default_due_days,
          weatherCityName: settings.weather_city_name,
        }}
        initialProjectPresets={projectPresets}
      />
    </div>
  );
}
