"use server";

// Onboarding: user/company settings writes live here; multi-company membership
// lifecycle lives next door in `company-actions.ts`, and preference parsing is
// centralized in `lib/settings/preferences.ts`.
import { createClient } from "@/lib/supabase/server";
import { getActiveCompanyId } from "@/lib/active-company";
import {
  clampDueDays,
  withUpdatedPreferenceSettings,
} from "@/lib/settings/preferences";
import { revalidatePath } from "next/cache";
import { getWeatherCity, searchWeatherCities as findWeatherCities } from "@/lib/weather/open-meteo";
import type { WeatherCity } from "@/lib/weather/open-meteo";

type ActionResult = { ok: true; message?: string } | { ok: false; message: string };
type PresetMutationResult =
  | { ok: true; message?: string; preset?: ProjectPresetForSettings }
  | { ok: false; message: string };

type PreferencesInput = {
  emailInvoiceReminders: boolean;
  weeklySummary: boolean;
  productUpdates: boolean;
  defaultDueDays: number;
};

export type ProjectPresetForSettings = {
  id: string;
  name: string;
  jobs: Array<{
    id: string;
    title: string;
    price_cents: number;
    sort_order: number;
  }>;
};

type ProjectPresetJobInput = {
  title: string;
  priceCents: number;
};

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toTitleCase(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";

  return normalized.replace(/[A-Za-z]+/g, (segment) => {
    return segment[0].toUpperCase() + segment.slice(1).toLowerCase();
  });
}

function normalizePhone(value: string) {
  return value.trim();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null, error: "Session expired. Please log in again." };
  }

  return { supabase, user, error: null };
}

async function getActiveCompanyForSettings() {
  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !user) return { supabase, user, companyId: null, error };

  const companyId = await getActiveCompanyId();
  if (!companyId) {
    return { supabase, user, companyId: null, error: "No active company found." };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    return { supabase, user, companyId: null, error: membershipError.message };
  }

  if (!membership) {
    return {
      supabase,
      user,
      companyId: null,
      error: "You don't have access to this company.",
    };
  }

  return { supabase, user, companyId, error: null };
}

function normalizePresetJobs(jobs: ProjectPresetJobInput[]) {
  const normalized = jobs
    .map((job) => ({
      title: toTitleCase(job.title),
      price_cents: Math.round(Number(job.priceCents)),
    }))
    .filter((job) => job.title || Number.isFinite(job.price_cents));

  for (let index = 0; index < normalized.length; index += 1) {
    const job = normalized[index];
    if (!job.title) return { ok: false as const, message: `Job ${index + 1} needs a title.` };
    if (!Number.isFinite(job.price_cents) || job.price_cents < 0) {
      return { ok: false as const, message: `Job "${job.title}" needs a valid price.` };
    }
  }

  if (normalized.length === 0) {
    return { ok: false as const, message: "Add at least one preset job." };
  }

  return { ok: true as const, jobs: normalized };
}

async function readProjectPresetById(
  presetId: string,
  companyId: string,
): Promise<ProjectPresetForSettings | null> {
  const supabase = await createClient();
  const { data: preset } = await supabase
    .from("project_presets")
    .select("id, name")
    .eq("id", presetId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!preset) return null;

  const { data: jobs } = await supabase
    .from("project_preset_jobs")
    .select("id, title, price_cents, sort_order")
    .eq("preset_id", presetId)
    .order("sort_order", { ascending: true });

  return {
    id: preset.id as string,
    name: preset.name as string,
    jobs: (jobs ?? []).map((job) => ({
      id: job.id as string,
      title: String(job.title ?? ""),
      price_cents: Number(job.price_cents ?? 0),
      sort_order: Number(job.sort_order ?? 0),
    })),
  };
}

export async function createProjectPreset(input: {
  name: string;
  jobs: ProjectPresetJobInput[];
}): Promise<PresetMutationResult> {
  const { supabase, user, companyId, error } = await getActiveCompanyForSettings();
  if (error || !user || !companyId) return { ok: false, message: error ?? "Unauthorized." };

  const name = toTitleCase(input.name);
  if (!name) return { ok: false, message: "Preset name is required." };

  const jobsResult = normalizePresetJobs(input.jobs);
  if (!jobsResult.ok) return { ok: false, message: jobsResult.message };

  const { data: preset, error: presetError } = await supabase
    .from("project_presets")
    .insert({
      company_id: companyId,
      user_id: user.id,
      name,
    })
    .select("id")
    .single();

  if (presetError || !preset?.id) {
    return {
      ok: false,
      message: presetError?.message ?? "Failed to create project preset.",
    };
  }

  const { error: jobsError } = await supabase.from("project_preset_jobs").insert(
    jobsResult.jobs.map((job, index) => ({
      preset_id: preset.id,
      title: job.title,
      price_cents: job.price_cents,
      sort_order: index,
    })),
  );

  if (jobsError) return { ok: false, message: jobsError.message };

  revalidatePath("/settings");
  return {
    ok: true,
    message: "Project preset created.",
    preset: await readProjectPresetById(preset.id as string, companyId) ?? undefined,
  };
}

export async function updateProjectPreset(input: {
  presetId: string;
  name: string;
  jobs: ProjectPresetJobInput[];
}): Promise<PresetMutationResult> {
  const { supabase, companyId, error } = await getActiveCompanyForSettings();
  if (error || !companyId) return { ok: false, message: error ?? "Unauthorized." };

  const presetId = normalizeWhitespace(input.presetId);
  const name = toTitleCase(input.name);
  if (!presetId) return { ok: false, message: "Preset id is required." };
  if (!name) return { ok: false, message: "Preset name is required." };

  const jobsResult = normalizePresetJobs(input.jobs);
  if (!jobsResult.ok) return { ok: false, message: jobsResult.message };

  const { error: updateError } = await supabase
    .from("project_presets")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", presetId)
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (updateError) return { ok: false, message: updateError.message };

  // Replace children as a set so sorting and removed rows stay in sync with the
  // management form instead of trying to diff individual job template rows.
  const { error: deleteError } = await supabase
    .from("project_preset_jobs")
    .delete()
    .eq("preset_id", presetId);
  if (deleteError) return { ok: false, message: deleteError.message };

  const { error: insertError } = await supabase.from("project_preset_jobs").insert(
    jobsResult.jobs.map((job, index) => ({
      preset_id: presetId,
      title: job.title,
      price_cents: job.price_cents,
      sort_order: index,
    })),
  );

  if (insertError) return { ok: false, message: insertError.message };

  revalidatePath("/settings");
  return {
    ok: true,
    message: "Project preset updated.",
    preset: await readProjectPresetById(presetId, companyId) ?? undefined,
  };
}

export async function deleteProjectPreset(presetIdRaw: string): Promise<ActionResult> {
  const { supabase, companyId, error } = await getActiveCompanyForSettings();
  if (error || !companyId) return { ok: false, message: error ?? "Unauthorized." };

  const presetId = normalizeWhitespace(presetIdRaw);
  if (!presetId) return { ok: false, message: "Preset id is required." };

  const { error: deleteError } = await supabase
    .from("project_presets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", presetId)
    .eq("company_id", companyId);

  if (deleteError) return { ok: false, message: deleteError.message };

  revalidatePath("/settings");
  return { ok: true, message: "Project preset deleted." };
}

export async function updateCompanyProfile(input: {
  companyId: string;
  companyName: string;
  address: string;
  phone: string;
}): Promise<ActionResult> {
  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized." };

  const companyName = normalizeWhitespace(input.companyName);
  const address = normalizeWhitespace(input.address);
  const phone = normalizePhone(input.phone);

  if (!companyName) {
    return { ok: false, message: "Company name is required." };
  }

  // Verify the user is a member of this company
  const { data: membership } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", input.companyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return { ok: false, message: "You don't have access to this company." };
  }

  // Update the companies table (source of truth for company profile)
  const { error: companyError } = await supabase
    .from("companies")
    .update({
      name: companyName,
      address: address || null,
      phone: phone || null,
    })
    .eq("id", input.companyId);

  if (companyError) {
    return { ok: false, message: companyError.message };
  }

  // Keep contractor_profiles + user_metadata in sync for backward compatibility
  await supabase.from("contractor_profiles").upsert(
    {
      user_id: user.id,
      company_name: companyName,
      address: address || null,
      phone: phone || null,
    },
    { onConflict: "user_id" },
  );

  const currentMetadata = isObject(user.user_metadata) ? user.user_metadata : {};
  await supabase.auth.updateUser({
    data: { ...currentMetadata, company_name: companyName },
  });

  return { ok: true, message: "Profile updated." };
}

export async function updatePreferences(input: PreferencesInput): Promise<ActionResult> {
  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized." };

  const defaultDueDays = clampDueDays(input.defaultDueDays, 30);
  const nextMetadata = withUpdatedPreferenceSettings(user.user_metadata, {
    email_invoice_reminders: Boolean(input.emailInvoiceReminders),
    weekly_summary: Boolean(input.weeklySummary),
    product_updates: Boolean(input.productUpdates),
    default_due_days: defaultDueDays,
  });

  const { error: updateError } = await supabase.auth.updateUser({
    data: nextMetadata,
  });

  if (updateError) return { ok: false, message: updateError.message };

  return { ok: true, message: "Preferences saved." };
}

export async function searchWeatherCities(query: string): Promise<{ ok: true; cities: WeatherCity[] } | { ok: false; message: string }> {
  const { user, error } = await getAuthenticatedClient();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized." };
  if (typeof query !== "string" || query.trim().length < 2 || query.trim().length > 100) {
    return { ok: true, cities: [] };
  }
  if (process.env.NODE_ENV === "production" && !process.env.OPEN_METEO_API_KEY) {
    return { ok: false, message: "Configure an Open-Meteo API key to search cities." };
  }
  try {
    return { ok: true, cities: await findWeatherCities(query) };
  } catch {
    return { ok: false, message: "City search is unavailable right now." };
  }
}

export async function updateWeatherCity(cityId: number | null): Promise<ActionResult> {
  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized." };
  if (cityId !== null && (!Number.isSafeInteger(cityId) || cityId <= 0)) {
    return { ok: false, message: "Choose a city from the search results." };
  }

  let city: WeatherCity | null = null;
  if (cityId !== null) {
    try {
      city = await getWeatherCity(cityId);
    } catch {
      return { ok: false, message: "Could not verify that city right now." };
    }
    if (!city) return { ok: false, message: "Could not verify that city right now." };
  }

  const cityName = city
    ? [city.name, city.admin1, city.country].filter(Boolean).join(", ")
    : undefined;
  const nextMetadata = withUpdatedPreferenceSettings(user.user_metadata, {
    weather_city_id: city?.id,
    weather_city_name: cityName,
  });
  const { error: updateError } = await supabase.auth.updateUser({ data: nextMetadata });
  if (updateError) return { ok: false, message: updateError.message };
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true, message: city ? `Weather location set to ${cityName}.` : "Weather location set to automatic." };
}

export async function updateAccountEmail(input: {
  email: string;
}): Promise<ActionResult> {
  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized." };

  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, message: "Email is required." };

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const { error: updateError } = await supabase.auth.updateUser({ email });
  if (updateError) return { ok: false, message: updateError.message };

  return {
    ok: true,
    message: "Email update requested. Check your inbox to confirm the change.",
  };
}

export async function updateAccountPassword(input: {
  nextPassword: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized." };

  const nextPassword = input.nextPassword.trim();
  const confirmPassword = input.confirmPassword.trim();

  if (!nextPassword) return { ok: false, message: "New password is required." };
  if (nextPassword.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if (nextPassword !== confirmPassword) {
    return { ok: false, message: "Password confirmation does not match." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: nextPassword,
  });

  if (updateError) return { ok: false, message: updateError.message };

  return { ok: true, message: "Password updated." };
}
