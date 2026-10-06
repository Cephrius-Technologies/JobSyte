"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ClearCutoffs = {
  notes_cleared_at: string;
  overdue_cleared_through: string;
};

async function authorizedClient(companyId: string) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin.from("company_members")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError || !membership) return null;
  return { admin, userId: user.id };
}

export async function getNotificationClearState(companyId: string): Promise<
  { ok: true; cutoffs: ClearCutoffs | null } | { ok: false; message: string }
> {
  const client = await authorizedClient(companyId);
  if (!client) return { ok: false, message: "You no longer have access to this company." };

  const { data, error } = await client.admin.from("notification_clears")
    .select("notes_cleared_at, overdue_cleared_through")
    .eq("company_id", companyId)
    .eq("user_id", client.userId)
    .maybeSingle();
  if (error) {
    console.error("Could not read notification clear state", error);
    return { ok: false, message: "Could not sync cleared notifications." };
  }
  return { ok: true, cutoffs: data };
}

export async function clearNotifications(companyId: string, overdueThrough: string): Promise<
  { ok: true; cutoffs: ClearCutoffs } | { ok: false; message: string }
> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(overdueThrough)) {
    return { ok: false, message: "Invalid date for clearing overdue jobs." };
  }
  const client = await authorizedClient(companyId);
  if (!client) return { ok: false, message: "You no longer have access to this company." };

  const cutoffs = {
    notes_cleared_at: new Date().toISOString(),
    overdue_cleared_through: overdueThrough,
  };
  const { error } = await client.admin.from("notification_clears").upsert({
    company_id: companyId,
    user_id: client.userId,
    ...cutoffs,
  }, { onConflict: "company_id,user_id" });
  if (error) {
    console.error("Could not save notification clear state", error);
    return { ok: false, message: "Could not sync cleared notifications." };
  }
  return { ok: true, cutoffs };
}
