import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompanyId } from "@/lib/active-company";
import { PageHeader } from "@/components/ui/page-header";
import { BreadcrumbSetter } from "@/components/app-shell/breadcrumb-setter";
import { CreateInvoiceByBuilder } from "@/components/invoices/create-invoice-by-builder";
import { readPreferenceSettings } from "@/lib/settings/preferences";

export default async function NewInvoicePage() {
  const supabase = createClient();

  const {
    data: { user },
    error,
  } = await (await supabase).auth.getUser();

  if (error || !user) redirect("/login");

  const companyId = await getActiveCompanyId();
  if (!companyId) redirect("/login");

  const settings = readPreferenceSettings(user.user_metadata);

  const [buildersRes, companyRes] = await Promise.all([
    (await supabase).from("builders").select("id, name").order("name"),
    (await supabase)
      .from("companies")
      .select("name, address, phone")
      .eq("id", companyId)
      .maybeSingle(),
  ]);

  const company = companyRes.data;

  return (
    <div className="space-y-6">
      <BreadcrumbSetter
        crumbs={[
          { label: "Invoices", href: "/invoices" },
          { label: "New Invoice" },
        ]}
      />

      <PageHeader title="New Invoice" description="Select a builder, then choose completed jobs across their projects." />

      <div>
        <CreateInvoiceByBuilder
          builders={buildersRes.data ?? []}
          defaultDueDays={settings.default_due_days}
          initialContractor={{
            company_name: company?.name ?? "",
            address: company?.address ?? "",
            phone: company?.phone ?? "",
          }}
        />
      </div>
    </div>
  );
}
