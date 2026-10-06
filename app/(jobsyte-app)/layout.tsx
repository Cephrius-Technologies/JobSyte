import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CompanyProvider } from "@/lib/company-context";

type CompanyMembershipRow = {
  role: string;
  company: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    logo_url: string | null;
  } | null;
};

function firstCompany(
  company: CompanyMembershipRow["company"] | CompanyMembershipRow["company"][],
) {
  return Array.isArray(company) ? company[0] ?? null : company;
}

// Onboarding: every authenticated product page flows through this layout.
// It verifies the Supabase user, loads company memberships, then hands tenant
// context to `lib/company-context.ts`; server actions read that tenant through
// `lib/active-company.ts`.
// Keep authenticated product routes out of search results.
export const metadata: Metadata = {
  title: "App | JobSyte",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login");

  // Fetch all companies the user belongs to
  const { data: memberships } = await supabase
    .from("company_members")
    .select("role, company:companies(id, name, address, phone, logo_url)")
    .eq("user_id", data.user.id);

  const companies = ((memberships ?? []) as unknown as CompanyMembershipRow[])
    .map((membership) => ({
      role: membership.role,
      company: firstCompany(membership.company),
    }))
    .filter((membership): membership is CompanyMembershipRow & {
      company: NonNullable<CompanyMembershipRow["company"]>;
    } => Boolean(membership.company))
    .map((membership) => ({
      ...membership.company,
      role: membership.role,
    }));

  return (
    <CompanyProvider companies={companies}>
      <AppShell userId={data.user.id}>{children}</AppShell>
    </CompanyProvider>
  );
}
