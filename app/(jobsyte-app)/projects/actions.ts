"use server";

// Onboarding: project-level server actions handle project CRUD plus CSV-style
// import parsing. Pair this with `components/projects/projects-page.tsx` for
// the UI and `app/(jobsyte-app)/(app)/projects/[id]/actions.ts` for job rows.
import { createClient } from "@/lib/supabase/server";
import { getActiveCompanyId } from "@/lib/active-company";
import { revalidatePath } from "next/cache";
import {
  getProjectStreetGroupLabel,
  renameProjectStreetAddress,
} from "@/components/projects/project-location";

type IdName = { id: string; name: string };
type ProjectPresetJobInput = {
  title: string;
  price_cents: number;
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

function normalizeName(value: string) {
  return toTitleCase(value);
}

function normalizeProjectAddress(value: string) {
  return toTitleCase(value);
}

function normalizeHouseNumber(value: string) {
  return normalizeWhitespace(value);
}

function isValidHouseNumber(value: string) {
  return /^\d+$/.test(value);
}

function normalizeStreetAddress(value: string) {
  return toTitleCase(value);
}

function normalizeCity(value: string) {
  return toTitleCase(value);
}

function normalizeState(value: string) {
  return normalizeWhitespace(value)
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

function combineProjectAddress(houseNumber: string, streetAddress: string) {
  return normalizeProjectAddress(`${houseNumber} ${streetAddress}`);
}

function normalizeHeader(value: string) {
  return normalizeWhitespace(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parsePriceToCents(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function parseProjectPresetJobs(formData: FormData) {
  const titles = formData
    .getAll("preset_job_title")
    .map((value) => toTitleCase(String(value || "")));
  const prices = formData
    .getAll("preset_job_price")
    .map((value) => String(value || "").trim());
  const jobs: ProjectPresetJobInput[] = [];

  for (let index = 0; index < Math.max(titles.length, prices.length); index += 1) {
    const title = titles[index] ?? "";
    const priceRaw = prices[index] ?? "";

    if (!title && !priceRaw) continue;
    if (!title) {
      return {
        ok: false as const,
        message: `Preset job ${index + 1} needs a title.`,
      };
    }

    const price_cents = parsePriceToCents(priceRaw);
    if (price_cents === null) {
      return {
        ok: false as const,
        message: `Preset job "${title}" needs a valid price.`,
      };
    }

    jobs.push({ title, price_cents });
  }

  return { ok: true as const, jobs };
}

async function saveProjectPreset({
  companyId,
  userId,
  name,
  jobs,
}: {
  companyId: string;
  userId: string;
  name: string;
  jobs: ProjectPresetJobInput[];
}) {
  const supabase = await createClient();
  const presetName = normalizeName(name);
  if (!presetName) return { ok: true };
  if (jobs.length === 0) {
    return { ok: false, message: "Add at least one job before saving a preset." };
  }

  // Upsert manually because the case-insensitive unique index is expression
  // based; Supabase upsert cannot target lower(name) directly.
  const existing = await supabase
    .from("project_presets")
    .select("id")
    .eq("company_id", companyId)
    .ilike("name", presetName)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing.error) return { ok: false, message: existing.error.message };

  const presetId = existing.data?.id as string | undefined;
  const presetResult = presetId
    ? await supabase
        .from("project_presets")
        .update({ name: presetName, updated_at: new Date().toISOString() })
        .eq("id", presetId)
        .eq("company_id", companyId)
        .select("id")
        .single()
    : await supabase
        .from("project_presets")
        .insert({
          company_id: companyId,
          user_id: userId,
          name: presetName,
        })
        .select("id")
        .single();

  if (presetResult.error || !presetResult.data?.id) {
    return {
      ok: false,
      message: presetResult.error?.message ?? "Failed to save project preset.",
    };
  }

  const savedPresetId = presetResult.data.id as string;

  const deleteJobs = await supabase
    .from("project_preset_jobs")
    .delete()
    .eq("preset_id", savedPresetId);
  if (deleteJobs.error) return { ok: false, message: deleteJobs.error.message };

  const insertJobs = await supabase.from("project_preset_jobs").insert(
    jobs.map((job, index) => ({
      preset_id: savedPresetId,
      title: job.title,
      price_cents: job.price_cents,
      sort_order: index,
    })),
  );

  if (insertJobs.error) return { ok: false, message: insertJobs.error.message };

  return { ok: true };
}

function parseScheduledDate(value: string) {
  const raw = normalizeWhitespace(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!slashMatch) return null;

  const month = Number(slashMatch[1]);
  const day = Number(slashMatch[2]);
  const year = Number(slashMatch[3]);
  if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  const yyyy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseCompositeCell(value: string) {
  const raw = normalizeWhitespace(value);
  if (!raw) return null;

  const match = raw.match(
    /^(.+?)\s*-+>\s*job\s*:\s*(.+?)\s*-+>\s*price\s*:?\s*(.+)$/i,
  );
  if (!match) return null;

  return {
    projectAddress: match[1],
    jobTitle: match[2],
    priceRaw: match[3],
  };
}

function isMissingStatusColumnError(message: string | undefined) {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("column") && normalized.includes("status");
}

function isMissingProjectLocationColumnError(message: string | undefined) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("project_city") ||
    normalized.includes("project_state") ||
    (normalized.includes("schema cache") && normalized.includes("projects"))
  );
}

function withoutProjectLocationFields<
  T extends { project_city?: string | null; project_state?: string | null },
>(value: T) {
  const { project_city, project_state, ...rest } = value;
  void project_city;
  void project_state;
  return rest;
}

async function setProjectStatusActive(projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ status: "active" })
    .eq("id", projectId);

  // Some older databases may not have the status column yet; project list pages
  // already derive status from jobs, so only real update failures should block.
  if (error && !isMissingStatusColumnError(error.message)) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}

function parseCsv(content: string) {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

function buildRowObject(headers: string[], row: string[]) {
  const obj: Record<string, string> = {};
  headers.forEach((header, index) => {
    obj[header] = normalizeWhitespace(row[index] ?? "");
  });
  return obj;
}

type ImportFieldName = keyof typeof IMPORT_HEADER_ALIASES;

// Heuristic detectors for column content sniffing (used when CSV headers are
// missing or don't match any known aliases). Returns true when a cell looks
// like the given field type.
function looksLikePrice(value: string) {
  const v = normalizeWhitespace(value);
  if (!v) return false;
  if (!/^\$?\s*[\d,]+(\.\d{1,2})?$/.test(v)) return false;
  return parsePriceToCents(v) !== null;
}

function looksLikeDate(value: string) {
  return parseScheduledDate(value) !== null;
}

function looksLikeAddress(value: string) {
  const v = normalizeWhitespace(value);
  if (!v) return false;
  // Starts with one or more digits followed by a space and at least one letter.
  return /^\d+\s+[A-Za-z]/.test(v);
}

function looksLikeNumeric(value: string) {
  const v = normalizeWhitespace(value);
  if (!v) return false;
  return /^\d+$/.test(v);
}

function detectFieldFromColumn(values: string[]): ImportFieldName | null {
  const nonEmpty = values
    .map((v) => normalizeWhitespace(v))
    .filter((v) => v.length > 0);
  if (nonEmpty.length === 0) return null;
  const total = nonEmpty.length;

  let priceMatches = 0;
  let dateMatches = 0;
  let addressMatches = 0;
  let houseNumberMatches = 0;

  for (const v of nonEmpty) {
    if (looksLikePrice(v)) priceMatches += 1;
    if (looksLikeDate(v)) dateMatches += 1;
    if (looksLikeAddress(v)) addressMatches += 1;
    if (looksLikeNumeric(v)) houseNumberMatches += 1;
  }

  // Order matters — price/date/address are the most distinguishable.
  if (priceMatches / total >= 0.7) return "price";
  if (dateMatches / total >= 0.7) return "scheduledCompletion";
  if (addressMatches / total >= 0.7) return "projectAddress";
  if (houseNumberMatches / total >= 0.7) return "houseNumber";
  return null;
}

// Build a map from field name -> column index by:
//  1. Matching header aliases first.
//  2. Sniffing data columns for any required/known fields still unmapped.
//  3. Falling back: the first remaining textual column becomes the job title.
function buildFieldColumnMap(
  headers: string[],
  dataRows: string[][],
): Map<ImportFieldName, number> {
  const fieldToColumn = new Map<ImportFieldName, number>();
  const usedColumns = new Set<number>();

  // Pass 1: header alias match.
  for (const fieldName of Object.keys(IMPORT_HEADER_ALIASES) as ImportFieldName[]) {
    const aliases = IMPORT_HEADER_ALIASES[fieldName].map((a) =>
      normalizeHeader(a),
    );
    for (let i = 0; i < headers.length; i += 1) {
      if (usedColumns.has(i)) continue;
      if (aliases.includes(headers[i])) {
        fieldToColumn.set(fieldName, i);
        usedColumns.add(i);
        break;
      }
    }
  }

  // Pass 2: content sniffing for remaining columns.
  for (let i = 0; i < headers.length; i += 1) {
    if (usedColumns.has(i)) continue;
    const columnValues = dataRows.map((row) => row[i] ?? "");
    const detected = detectFieldFromColumn(columnValues);
    if (detected && !fieldToColumn.has(detected)) {
      fieldToColumn.set(detected, i);
      usedColumns.add(i);
    }
  }

  // Pass 3: job title fallback — first remaining mostly-text column.
  if (!fieldToColumn.has("jobTitle")) {
    for (let i = 0; i < headers.length; i += 1) {
      if (usedColumns.has(i)) continue;
      const columnValues = dataRows
        .map((row) => normalizeWhitespace(row[i] ?? ""))
        .filter((v) => v.length > 0);
      if (columnValues.length === 0) continue;
      const numericCount = columnValues.filter(
        (v) => looksLikePrice(v) || looksLikeDate(v) || looksLikeNumeric(v),
      ).length;
      if (numericCount / columnValues.length < 0.5) {
        fieldToColumn.set("jobTitle", i);
        usedColumns.add(i);
        break;
      }
    }
  }

  return fieldToColumn;
}

function getFieldValue(
  rawRow: string[],
  fieldToColumn: Map<ImportFieldName, number>,
  field: ImportFieldName,
): string {
  const idx = fieldToColumn.get(field);
  if (idx === undefined) return "";
  return normalizeWhitespace(rawRow[idx] ?? "");
}

// Translate raw error text (often from Supabase/Postgres) into a short message
// the end user can act on. Anything we don't recognize falls back to a generic
// line so we never leak DB internals into the UI.
function friendlyImportError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes("builder is missing")) {
    return "Missing builder. Add a builder column or set a default builder.";
  }
  if (msg.includes("subdivision is missing")) {
    return "Missing subdivision. Add a subdivision column or set a default subdivision.";
  }
  if (msg.includes("project address is required")) {
    return "Missing project address.";
  }
  if (msg.includes("invalid input syntax")) {
    return "One of the values in this row is in an unexpected format.";
  }
  if (msg.includes("duplicate key") || msg.includes("already exists")) {
    return "This row already exists and was skipped.";
  }
  if (msg.includes("permission") || msg.includes("not allowed") || msg.includes("rls")) {
    return "You don't have permission to add this record.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Network problem while saving. Try again.";
  }
  return "This row couldn't be imported. Check the values and try again.";
}

function normalizeJobKey(parts: {
  title: string;
  priceCents: number;
  scheduled?: string | null;
  superintendent?: string | null;
}) {
  return [
    normalizeWhitespace(parts.title).toLowerCase(),
    String(parts.priceCents),
    normalizeWhitespace(parts.scheduled ?? "").toLowerCase(),
    normalizeWhitespace(parts.superintendent ?? "").toLowerCase(),
  ].join("|");
}

const IMPORT_HEADER_ALIASES = {
  projectAddress: [
    "project_address",
    "projectaddress",
    "address",
    "project",
    "site_address",
    "siteaddress",
    "job_address",
    "jobaddress",
    "job_site",
    "jobsite",
    "lot_address",
    "lotaddress",
    "property_address",
    "propertyaddress",
    "property",
    "location",
  ],
  houseNumber: [
    "house_number",
    "housenumber",
    "street_number",
    "streetnumber",
    "street no",
    "street_no",
    "lot",
    "lot_number",
    "lotnumber",
    "lot_no",
    "lot#",
  ],
  streetAddress: [
    "street_address",
    "streetaddress",
    "street",
    "street_name",
    "streetname",
    "address_line",
    "addressline",
    "address_line_1",
    "addressline1",
  ],
  jobTitle: [
    "job_title",
    "jobtitle",
    "job",
    "title",
    "description",
    "job_description",
    "jobdescription",
    "cost_code_description",
    "costcodedescription",
    "cost_code_desc",
    "costcodedesc",
    "item_description",
    "itemdescription",
    "line_description",
    "linedescription",
    "line_item",
    "lineitem",
    "task",
    "task_name",
    "taskname",
    "scope",
    "scope_of_work",
    "scopeofwork",
    "work_description",
    "workdescription",
    "service",
    "service_description",
    "servicedescription",
  ],
  price: [
    "price",
    "amount",
    "job_price",
    "jobprice",
    "job_cost",
    "jobcost",
    "cost",
    "total",
    "total_price",
    "totalprice",
    "total_amount",
    "totalamount",
    "subtotal",
    "extended_price",
    "extendedprice",
    "extended_amount",
    "extendedamount",
    "ext_price",
    "extprice",
    "unit_price",
    "unitprice",
    "contract_amount",
    "contractamount",
    "contract_price",
    "contractprice",
    "billed_amount",
    "billedamount",
    "line_total",
    "linetotal",
  ],
  builderName: [
    "builder_name",
    "buildername",
    "builder",
    "customer",
    "customer_name",
    "customername",
    "client",
    "client_name",
    "clientname",
    "bill_to",
    "billto",
    "account",
    "account_name",
    "accountname",
    "company",
    "company_name",
    "companyname",
    "gc_name",
    "gcname",
    "general_contractor",
    "generalcontractor",
  ],
  subdivisionName: [
    "subdivision_name",
    "subdivisionname",
    "subdivision",
    "community",
    "community_name",
    "communityname",
    "neighborhood",
    "development",
    "development_name",
    "developmentname",
    "project_name",
    "projectname",
    "tract",
    "tract_name",
    "tractname",
    "phase",
  ],
  superintendent: [
    "superintendent",
    "super",
    "site_super",
    "sitesuper",
    "site_superintendent",
    "sitesuperintendent",
    "gc",
    "crew",
    "crew_name",
    "crewname",
    "contractor",
    "foreman",
    "lead",
    "crew_lead",
    "crewlead",
    "project_manager",
    "projectmanager",
    "pm",
    "assigned_to",
    "assignedto",
  ],
  scheduledCompletion: [
    "scheduled_completion",
    "scheduledcompletion",
    "scheduled",
    "scheduled_for",
    "scheduledfor",
    "scheduled_date",
    "scheduleddate",
    "date",
    "due",
    "due_date",
    "duedate",
    "completion",
    "completion_date",
    "completiondate",
    "target",
    "target_date",
    "targetdate",
    "expected",
    "expected_date",
    "expecteddate",
    "expected_completion",
    "expectedcompletion",
    "deadline",
    "finish",
    "finish_date",
    "finishdate",
    "end_date",
    "enddate",
  ],
} as const;

type ImportPreviewProject = {
  projectAddress: string;
  builderName: string;
  subdivisionName: string;
  isNew: boolean;
  jobs: {
    title: string;
    priceCents: number;
    scheduledCompletion: string | null;
    superintendent: string | null;
    isDuplicate: boolean;
  }[];
};

type ImportSummary = {
  dryRun: boolean;
  rowsRead: number;
  buildersCreated: number;
  subdivisionsCreated: number;
  projectsCreated: number;
  jobsCreated: number;
  jobsSkippedDuplicate: number;
  rowsSkippedInvalid: number;
  rowErrors: string[];
  preview: ImportPreviewProject[];
};

type ImportResult =
  | { ok: true; summary: ImportSummary }
  | { ok: false; message: string };

export async function createBuilder(
  nameRaw: string,
): Promise<{ ok: boolean; data?: IdName; message?: string }> {
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Session expired. Please log in again." };
  }

  const name = normalizeName(nameRaw);
  if (!name) return { ok: false, message: "Builder name is required." };

  // Insert first; if duplicate (unique index), fetch existing row
  const ins = await supabase
    .from("builders")
    .insert({ user_id: user.id, name })
    .select("id, name")
    .single();

  if (!ins.error && ins.data) return { ok: true, data: ins.data as IdName };

  // Duplicate? Fetch existing
  const sel = await supabase
    .from("builders")
    .select("id, name")
    .eq("user_id", user.id)
    .ilike("name", name) // case-insensitive-ish; ok for MVP
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (sel.data) return { ok: true, data: sel.data as IdName };

  return {
    ok: false,
    message: ins.error?.message ?? "Failed to save builder.",
  };
}

export async function createSubdivision(
  nameRaw: string,
): Promise<{ ok: boolean; data?: IdName; message?: string }> {
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
    error: userError,
  } = await (await supabase).auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Session expired. Please log in again." };
  }

  const name = normalizeName(nameRaw);
  if (!name) return { ok: false, message: "Subdivision name is required." };

  const ins = await supabase
    .from("subdivisions")
    .insert({ user_id: user.id, name })
    .select("id, name")
    .single();

  if (!ins.error && ins.data) return { ok: true, data: ins.data as IdName };

  const sel = await supabase
    .from("subdivisions")
    .select("id, name")
    .eq("user_id", user.id)
    .ilike("name", name)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (sel.data) return { ok: true, data: sel.data as IdName };

  return {
    ok: false,
    message: ins.error?.message ?? "Failed to save subdivision.",
  };
}

export async function createProject(formData: FormData) {
  const supabase = createClient();

  // Check auth
  const {
    data: { user },
    error: userError,
  } = await (await supabase).auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Session expired. Please log in again." };
  }

  const houseNumberRaw = String(formData.get("house_number") || "");
  const streetAddressRaw = String(formData.get("street_address") || "");
  const cityRaw = String(formData.get("city") || "");
  const stateRaw = String(formData.get("state") || "");
  const projectAddressRaw = String(formData.get("project_address") || "");

  const houseNumber = normalizeHouseNumber(houseNumberRaw);
  const streetAddress = normalizeStreetAddress(streetAddressRaw);
  const city = normalizeCity(cityRaw);
  const projectState = normalizeState(stateRaw);
  const usingSplitAddress =
    houseNumberRaw.trim().length > 0 || streetAddressRaw.trim().length > 0;
  const project_address = usingSplitAddress
    ? combineProjectAddress(houseNumber, streetAddress)
    : normalizeProjectAddress(projectAddressRaw);

  // We will accept either selected IDs or typed names.
  const builder_id = String(formData.get("builder_id") || "").trim() || null;
  const builder_name_raw = String(formData.get("builder_name") || "").trim();

  const subdivision_id =
    String(formData.get("subdivision_id") || "").trim() || null;
  const subdivision_name_raw = String(
    formData.get("subdivision_name") || "",
  ).trim();

  if (usingSplitAddress && (!houseNumber || !streetAddress)) {
    return {
      ok: false,
      message: "Street number and street address are required.",
    };
  }
  if (usingSplitAddress && !isValidHouseNumber(houseNumber)) {
    return { ok: false, message: "Street number must be numeric." };
  }
  if (usingSplitAddress && stateRaw.trim() && projectState.length !== 2) {
    return { ok: false, message: "State must be a two-letter abbreviation." };
  }
  if (!project_address) {
    return { ok: false, message: "Project address is required." };
  }

  const presetJobsResult = parseProjectPresetJobs(formData);
  if (!presetJobsResult.ok) {
    return { ok: false, message: presetJobsResult.message };
  }
  const presetJobs = presetJobsResult.jobs;
  const presetNameToSave = normalizeName(
    String(formData.get("save_preset_name") || ""),
  );

  // Resolve builder
  let finalBuilderId: string | null = builder_id;
  let builder_name_snapshot = "";

  if (finalBuilderId) {
    const { data: b } = await (await supabase)
      .from("builders")
      .select("id, name")
      .eq("id", finalBuilderId)
      .maybeSingle();

    if (!b) return { ok: false, message: "Selected builder not found." };
    builder_name_snapshot = b.name;
  } else {
    const name = normalizeName(builder_name_raw);
    if (!name) return { ok: false, message: "Builder is required." };
    const created = await createBuilder(name);
    if (!created.ok || !created.data)
      return {
        ok: false,
        message: created.message ?? "Failed to save builder.",
      };
    finalBuilderId = created.data.id;
    builder_name_snapshot = created.data.name;
  }

  // Resolve subdivision (REQUIRED)
  let finalSubdivisionId: string | null = subdivision_id;
  let subdivision_snapshot: string | null = null;

  const subName = normalizeName(subdivision_name_raw);

  if (finalSubdivisionId) {
    const { data: s } = await (await supabase)
      .from("subdivisions")
      .select("id, name")
      .eq("id", finalSubdivisionId)
      .maybeSingle();

    if (!s) return { ok: false, message: "Selected subdivision not found." };
    subdivision_snapshot = s.name;
  } else {
    // If no ID, we require a name and create it
    if (!subName) return { ok: false, message: "Subdivision is required." };

    const created = await createSubdivision(subName);
    if (!created.ok || !created.data) {
      return {
        ok: false,
        message: created.message ?? "Failed to save subdivision.",
      };
    }

    finalSubdivisionId = created.data.id;
    subdivision_snapshot = created.data.name;
  }

  // Insert project
  const companyId = await getActiveCompanyId();
  if (!companyId) return { ok: false, message: "No active company found." };

  if (presetNameToSave) {
    const savePreset = await saveProjectPreset({
      companyId,
      userId: user.id,
      name: presetNameToSave,
      jobs: presetJobs,
    });
    if (!savePreset.ok) return savePreset;
  }

  const projectInsert = {
    user_id: user.id,
    company_id: companyId,
    project_address,
    project_city: city || null,
    project_state: projectState || null,
    builder_id: finalBuilderId,
    subdivision_id: finalSubdivisionId,
    builder_name: builder_name_snapshot, // keep your existing columns as snapshots
    subdivision: subdivision_snapshot,
  };

  let insertResult = await (
    await supabase
  )
    .from("projects")
    .insert(projectInsert)
    .select("id")
    .single();

  if (
    insertResult.error &&
    isMissingProjectLocationColumnError(insertResult.error.message)
  ) {
    insertResult = await (
      await supabase
    )
      .from("projects")
      .insert(withoutProjectLocationFields(projectInsert))
      .select("id")
      .single();
  }

  const { data, error } = insertResult;

  if (error) return { ok: false, message: error.message };

  if (presetJobs.length > 0) {
    // Preset-generated jobs intentionally start unscheduled. Dates remain a
    // normal job-edit concern after the project shell and repeated scope exist.
    const { error: jobsError } = await (
      await supabase
    )
      .from("jobs")
      .insert(
        presetJobs.map((job) => ({
          project_id: data.id as string,
          company_id: companyId,
          title: job.title,
          price_cents: job.price_cents,
          scheduled_completion: null,
        })),
      );

    if (jobsError) {
      await (
        await supabase
      )
        .from("projects")
        .delete()
        .eq("id", data.id as string)
        .eq("user_id", user.id);
      return { ok: false, message: jobsError.message };
    }

    const statusResult = await setProjectStatusActive(data.id as string);
    if (!statusResult.ok) return statusResult;
  }

  revalidatePath("/projects");
  revalidatePath("/dashboard");

  return { ok: true, projectId: data.id as string };
  // Reload window
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, message: "Session expired. Please log in again." };
  }

  const id = projectId.trim();
  if (!id) return { ok: false, message: "Invalid project ID." };

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (projectError) return { ok: false, message: "Failed to find project." };
  if (!project) return { ok: false, message: "Project not found." };

  // Hard-delete the project and its jobs, but preserve invoice history. Every
  // invoice_items row already stores frozen snapshots of address / builder /
  // subdivision / job title / price, so the invoice will continue to render
  // correctly after the underlying jobs row is gone — we just need to drop the
  // job_id link first so a FK doesn't block the delete (or cascade-delete the
  // invoice line). Same idea for payroll: payments.job_id is ON DELETE
  // CASCADE, so we null it before removing the jobs to keep payroll history.
  const { data: projectJobs, error: projectJobsError } = await supabase
    .from("jobs")
    .select("id")
    .eq("project_id", id);
  if (projectJobsError) {
    return { ok: false, message: "Failed to load project jobs." };
  }

  const projectJobIds = (projectJobs ?? []).map((row) => row.id as string);

  if (projectJobIds.length > 0) {
    // Detach invoice items from the jobs (keep the snapshot data intact).
    const { error: detachInvoiceItemsError } = await supabase
      .from("invoice_items")
      .update({ job_id: null })
      .in("job_id", projectJobIds);
    if (detachInvoiceItemsError) {
      return {
        ok: false,
        message: "Failed to detach invoice history from project jobs.",
      };
    }

    // Detach payments so the ON DELETE CASCADE doesn't wipe payroll history.
    const { error: detachPaymentsError } = await supabase
      .from("payments")
      .update({ job_id: null })
      .in("job_id", projectJobIds);
    if (detachPaymentsError) {
      return {
        ok: false,
        message: "Failed to detach payroll history from project jobs.",
      };
    }

    // Now hard-delete every job for this project.
    const { error: jobsDeleteError } = await supabase
      .from("jobs")
      .delete()
      .in("id", projectJobIds);
    if (jobsDeleteError) {
      return { ok: false, message: "Failed to delete project jobs." };
    }
  }

  const { error: projectDeleteError } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (projectDeleteError) {
    return { ok: false, message: "Failed to delete project." };
  }

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath("/accounting");
  return { ok: true };
}

/**
 * Hard-delete a batch of projects (and their jobs) at once. Used by the
 * subdivision/street group "delete all" buttons in the projects page.
 *
 * Same semantics as deleteProject: invoice_items.job_id and payments.job_id
 * are nulled out first so invoice snapshots and payroll history survive,
 * then jobs and projects are removed.
 */
export async function deleteProjects(projectIds: string[]) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, message: "Session expired. Please log in again." };
  }

  const ids = Array.from(
    new Set(
      (projectIds ?? [])
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter((id) => id.length > 0),
    ),
  );
  if (ids.length === 0) {
    return { ok: false, message: "No projects selected." };
  }

  // Restrict to projects the current user actually owns.
  const { data: ownedProjects, error: ownedError } = await supabase
    .from("projects")
    .select("id")
    .in("id", ids)
    .eq("user_id", user.id);
  if (ownedError) return { ok: false, message: "Failed to load projects." };

  const ownedIds = (ownedProjects ?? []).map((p) => p.id as string);
  if (ownedIds.length === 0) {
    return { ok: false, message: "No matching projects found." };
  }

  const { data: projectJobs, error: projectJobsError } = await supabase
    .from("jobs")
    .select("id")
    .in("project_id", ownedIds);
  if (projectJobsError) {
    return { ok: false, message: "Failed to load project jobs." };
  }

  const projectJobIds = (projectJobs ?? []).map((row) => row.id as string);

  if (projectJobIds.length > 0) {
    const { error: detachInvoiceItemsError } = await supabase
      .from("invoice_items")
      .update({ job_id: null })
      .in("job_id", projectJobIds);
    if (detachInvoiceItemsError) {
      return {
        ok: false,
        message: "Failed to detach invoice history from project jobs.",
      };
    }

    const { error: detachPaymentsError } = await supabase
      .from("payments")
      .update({ job_id: null })
      .in("job_id", projectJobIds);
    if (detachPaymentsError) {
      return {
        ok: false,
        message: "Failed to detach payroll history from project jobs.",
      };
    }

    const { error: jobsDeleteError } = await supabase
      .from("jobs")
      .delete()
      .in("id", projectJobIds);
    if (jobsDeleteError) {
      return { ok: false, message: "Failed to delete project jobs." };
    }
  }

  const { error: projectsDeleteError } = await supabase
    .from("projects")
    .delete()
    .in("id", ownedIds)
    .eq("user_id", user.id);
  if (projectsDeleteError) {
    return { ok: false, message: "Failed to delete projects." };
  }

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath("/accounting");
  return { ok: true, deletedCount: ownedIds.length };
}

export async function renameProjectStreetGroup(
  projectIds: string[],
  streetAddressRaw: string,
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, message: "Session expired. Please log in again." };
  }

  const companyId = await getActiveCompanyId();
  if (!companyId) return { ok: false, message: "No active company found." };

  const ids = Array.from(
    new Set(
      (projectIds ?? [])
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean),
    ),
  );
  if (ids.length === 0) {
    return { ok: false, message: "No projects selected." };
  }

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, project_address")
    .in("id", ids)
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (projectsError) {
    return { ok: false, message: "Failed to load street projects." };
  }
  if ((projects ?? []).length !== ids.length) {
    return {
      ok: false,
      message: "One or more projects in this street could not be found.",
    };
  }

  const streetGroups = new Set(
    (projects ?? []).map((project) =>
      getProjectStreetGroupLabel(String(project.project_address)).toLowerCase(),
    ),
  );
  if (streetGroups.size !== 1) {
    return { ok: false, message: "The selected projects are not in one street." };
  }

  const updates = (projects ?? []).map((project) => ({
    id: String(project.id),
    project_address: renameProjectStreetAddress(
      String(project.project_address),
      streetAddressRaw,
    ),
  }));
  if (updates.some((project) => !project.project_address)) {
    return {
      ok: false,
      message: "Every project needs a numeric street number before this street can be renamed.",
    };
  }

  const updateResults = await Promise.all(
    updates.map((project) =>
      supabase
        .from("projects")
        .update({ project_address: project.project_address as string })
        .eq("id", project.id)
        .eq("company_id", companyId)
        .is("deleted_at", null),
    ),
  );
  if (updateResults.some((result) => result.error)) {
    return { ok: false, message: "Failed to update every project address." };
  }

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/accounting");
  revalidatePath("/calendar");
  revalidatePath("/map");
  return { ok: true, updatedCount: updates.length };
}

export async function editProject(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Session expired. Please log in again." };
  }

  const projectId = String(formData.get("project_id") || "").trim();
  const houseNumberRaw = String(formData.get("house_number") || "");
  const streetAddressRaw = String(formData.get("street_address") || "");
  const cityRaw = String(formData.get("city") || "");
  const stateRaw = String(formData.get("state") || "");
  const projectAddressRaw = String(formData.get("project_address") || "");

  const houseNumber = normalizeHouseNumber(houseNumberRaw);
  const streetAddress = normalizeStreetAddress(streetAddressRaw);
  const city = normalizeCity(cityRaw);
  const projectState = normalizeState(stateRaw);
  const usingSplitAddress =
    houseNumberRaw.trim().length > 0 || streetAddressRaw.trim().length > 0;
  const project_address = usingSplitAddress
    ? combineProjectAddress(houseNumber, streetAddress)
    : normalizeProjectAddress(projectAddressRaw);

  const builder_id = String(formData.get("builder_id") || "").trim() || null;
  const builder_name_raw = String(formData.get("builder_name") || "").trim();

  const subdivision_id =
    String(formData.get("subdivision_id") || "").trim() || null;
  const subdivision_name_raw = String(
    formData.get("subdivision_name") || "",
  ).trim();

  if (!projectId) return { ok: false, message: "Project id is required." };
  if (usingSplitAddress && (!houseNumber || !streetAddress)) {
    return {
      ok: false,
      message: "Street number and street address are required.",
    };
  }
  if (usingSplitAddress && !isValidHouseNumber(houseNumber)) {
    return { ok: false, message: "Street number must be numeric." };
  }
  if (usingSplitAddress && stateRaw.trim() && projectState.length !== 2) {
    return { ok: false, message: "State must be a two-letter abbreviation." };
  }
  if (!project_address)
    return { ok: false, message: "Project address is required." };

  const { data: existing, error: existingErr } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingErr) return { ok: false, message: existingErr.message };
  if (!existing) return { ok: false, message: "Project not found." };

  let finalBuilderId: string | null = builder_id;
  let builder_name_snapshot = "";

  if (finalBuilderId) {
    const { data: b } = await supabase
      .from("builders")
      .select("id, name")
      .eq("id", finalBuilderId)
      .maybeSingle();

    if (!b) return { ok: false, message: "Selected builder not found." };
    builder_name_snapshot = b.name;
  } else {
    const name = normalizeName(builder_name_raw);
    if (!name) return { ok: false, message: "Builder is required." };
    const created = await createBuilder(name);
    if (!created.ok || !created.data) {
      return { ok: false, message: created.message ?? "Failed to save builder." };
    }
    finalBuilderId = created.data.id;
    builder_name_snapshot = created.data.name;
  }

  let finalSubdivisionId: string | null = subdivision_id;
  let subdivision_snapshot: string | null = null;

  if (finalSubdivisionId) {
    const { data: s } = await supabase
      .from("subdivisions")
      .select("id, name")
      .eq("id", finalSubdivisionId)
      .maybeSingle();

    if (!s) return { ok: false, message: "Selected subdivision not found." };
    subdivision_snapshot = s.name;
  } else {
    const name = normalizeName(subdivision_name_raw);
    if (!name) return { ok: false, message: "Subdivision is required." };
    const created = await createSubdivision(name);
    if (!created.ok || !created.data) {
      return {
        ok: false,
        message: created.message ?? "Failed to save subdivision.",
      };
    }
    finalSubdivisionId = created.data.id;
    subdivision_snapshot = created.data.name;
  }

  const projectUpdate = {
    project_address,
    project_city: city || null,
    project_state: projectState || null,
    builder_id: finalBuilderId,
    builder_name: builder_name_snapshot,
    subdivision_id: finalSubdivisionId,
    subdivision: subdivision_snapshot,
  };

  let updateResult = await supabase
    .from("projects")
    .update(projectUpdate)
    .eq("id", projectId)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (
    updateResult.error &&
    isMissingProjectLocationColumnError(updateResult.error.message)
  ) {
    updateResult = await supabase
      .from("projects")
      .update(withoutProjectLocationFields(projectUpdate))
      .eq("id", projectId)
      .eq("user_id", user.id)
      .is("deleted_at", null);
  }

  const updateErr = updateResult.error;
  if (updateErr) return { ok: false, message: updateErr.message };
  return { ok: true };
}

export async function importProjectsJobsCsv(
  formData: FormData,
): Promise<ImportResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Session expired. Please log in again." };
  }
  const userId = user.id;

  const companyId = await getActiveCompanyId();
  if (!companyId) {
    return { ok: false, message: "No active company found." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "Select a CSV file to import." };
  }
  if (file.size <= 0) return { ok: false, message: "The selected file is empty." };
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, message: "CSV is too large. Max size is 8MB." };
  }

  const defaultBuilder = toTitleCase(String(formData.get("default_builder") || ""));
  const defaultSubdivision = toTitleCase(
    String(formData.get("default_subdivision") || ""),
  );
  const dryRun = String(formData.get("dry_run") || "").toLowerCase() === "true";

  const csvRaw = (await file.text()).replace(/^\uFEFF/, "");
  const rows = parseCsv(csvRaw);
  if (rows.length < 2) {
    return {
      ok: false,
      message: "CSV must include a header row and at least one data row.",
    };
  }

  const headers = rows[0].map((header) => normalizeHeader(header));
  const dataRows = rows
    .slice(1)
    .filter((row) => row.some((cell) => normalizeWhitespace(cell).length > 0));
  if (dataRows.length === 0) {
    return { ok: false, message: "CSV has no data rows to import." };
  }

  // Resolve which column carries which field. Prefer header aliases, then fall
  // back to data sniffing so the import works even when the CSV uses arbitrary
  // column names or no recognizable header at all.
  const fieldToColumn = buildFieldColumnMap(headers, dataRows);

  const builderCache = new Map<string, string>();
  const subdivisionCache = new Map<string, string>();
  const projectCache = new Map<string, string>();
  const jobCacheByProject = new Map<string, Set<string>>();

  const summary: ImportSummary = {
    dryRun,
    rowsRead: dataRows.length,
    buildersCreated: 0,
    subdivisionsCreated: 0,
    projectsCreated: 0,
    jobsCreated: 0,
    jobsSkippedDuplicate: 0,
    rowsSkippedInvalid: 0,
    rowErrors: [],
    preview: [],
  };

  // Maps a project key to its index in summary.preview so multiple jobs for the
  // same project are grouped together in the UI.
  const previewIndexByProject = new Map<string, number>();

  async function resolveBuilderId(rawName: string): Promise<string> {
    const name = toTitleCase(rawName || defaultBuilder);
    if (!name) {
      throw new Error(
        "Builder is missing. Add a builder column or set a default builder.",
      );
    }

    const cacheKey = name.toLowerCase();
    const cached = builderCache.get(cacheKey);
    if (cached) return cached;

    const { data: existing, error: selectError } = await supabase
      .from("builders")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", name)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (selectError) throw new Error(selectError.message);

    if (existing?.id) {
      builderCache.set(cacheKey, existing.id);
      return existing.id;
    }

    if (dryRun) {
      const dryId = `dry-builder-${cacheKey}`;
      builderCache.set(cacheKey, dryId);
      summary.buildersCreated += 1;
      return dryId;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("builders")
      .insert({ user_id: userId, name })
      .select("id")
      .single();
    if (insertError || !inserted?.id) {
      throw new Error(insertError?.message ?? "Failed to create builder.");
    }

    builderCache.set(cacheKey, inserted.id);
    summary.buildersCreated += 1;
    return inserted.id;
  }

  async function resolveSubdivisionId(rawName: string): Promise<string> {
    const name = toTitleCase(rawName || defaultSubdivision);
    if (!name) {
      throw new Error(
        "Subdivision is missing. Add a subdivision column or set a default subdivision.",
      );
    }

    const cacheKey = name.toLowerCase();
    const cached = subdivisionCache.get(cacheKey);
    if (cached) return cached;

    const { data: existing, error: selectError } = await supabase
      .from("subdivisions")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", name)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (selectError) throw new Error(selectError.message);

    if (existing?.id) {
      subdivisionCache.set(cacheKey, existing.id);
      return existing.id;
    }

    if (dryRun) {
      const dryId = `dry-subdivision-${cacheKey}`;
      subdivisionCache.set(cacheKey, dryId);
      summary.subdivisionsCreated += 1;
      return dryId;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("subdivisions")
      .insert({ user_id: userId, name })
      .select("id")
      .single();
    if (insertError || !inserted?.id) {
      throw new Error(insertError?.message ?? "Failed to create subdivision.");
    }

    subdivisionCache.set(cacheKey, inserted.id);
    summary.subdivisionsCreated += 1;
    return inserted.id;
  }

  async function resolveProjectId(input: {
    projectAddress: string;
    builderId: string;
    subdivisionId: string;
    builderName: string;
    subdivisionName: string;
  }) {
    const projectAddress = normalizeProjectAddress(input.projectAddress);
    if (!projectAddress) throw new Error("Project address is required.");

    const cacheKey = [
      input.builderId,
      input.subdivisionId,
      projectAddress.toLowerCase(),
    ].join("|");
    const cached = projectCache.get(cacheKey);
    if (cached) return cached;

    // In dry-run mode, builderId/subdivisionId can be synthetic placeholders
    // (e.g. "dry-builder-foo") for entities that don't exist yet. Skip the
    // existing-project lookup in that case — Supabase would reject the
    // non-UUID value with "invalid input syntax for type uuid".
    const builderIsDry = input.builderId.startsWith("dry-builder-");
    const subdivisionIsDry = input.subdivisionId.startsWith("dry-subdivision-");
    const skipLookup = dryRun && (builderIsDry || subdivisionIsDry);

    if (!skipLookup) {
      const { data: existing, error: selectError } = await supabase
        .from("projects")
        .select("id")
        .eq("company_id", companyId)
        .eq("builder_id", input.builderId)
        .eq("subdivision_id", input.subdivisionId)
        .ilike("project_address", projectAddress)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (selectError) throw new Error(selectError.message);

      if (existing?.id) {
        projectCache.set(cacheKey, existing.id);
        return existing.id;
      }
    }

    if (dryRun) {
      const dryId = `dry-project-${cacheKey.replace(/[^a-z0-9-]/gi, "-")}`;
      projectCache.set(cacheKey, dryId);
      summary.projectsCreated += 1;
      return dryId;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("projects")
      .insert({
        user_id: userId,
        company_id: companyId,
        project_address: projectAddress,
        builder_id: input.builderId,
        subdivision_id: input.subdivisionId,
        builder_name: input.builderName,
        subdivision: input.subdivisionName,
      })
      .select("id")
      .single();
    if (insertError || !inserted?.id) {
      throw new Error(insertError?.message ?? "Failed to create project.");
    }

    projectCache.set(cacheKey, inserted.id);
    summary.projectsCreated += 1;
    return inserted.id;
  }

  async function getProjectJobCache(projectId: string) {
    const cached = jobCacheByProject.get(projectId);
    if (cached) return cached;

    if (dryRun && projectId.startsWith("dry-project-")) {
      const drySet = new Set<string>();
      jobCacheByProject.set(projectId, drySet);
      return drySet;
    }

    const { data: jobs, error } = await supabase
      .from("jobs")
      .select("title, price_cents, scheduled_completion, superintendent")
      .eq("project_id", projectId)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);

    const keys = new Set(
      (jobs ?? []).map((job) =>
        normalizeJobKey({
          title: job.title ?? "",
          priceCents: job.price_cents ?? 0,
          scheduled: job.scheduled_completion ?? "",
          superintendent: job.superintendent ?? "",
        }),
      ),
    );
    jobCacheByProject.set(projectId, keys);
    return keys;
  }

  for (let i = 0; i < dataRows.length; i += 1) {
    const lineNumber = i + 2;
    const rawRow = dataRows[i] ?? [];
    const row = buildRowObject(headers, rawRow);

    const compositeSource = Object.values(row).find((value) =>
      normalizeWhitespace(value).includes("---->"),
    );
    const composite = compositeSource ? parseCompositeCell(compositeSource) : null;

    const projectAddressRaw = getFieldValue(rawRow, fieldToColumn, "projectAddress");
    const houseNumberRaw = getFieldValue(rawRow, fieldToColumn, "houseNumber");
    const streetAddressRaw = getFieldValue(rawRow, fieldToColumn, "streetAddress");
    const splitAddress = normalizeWhitespace(
      [houseNumberRaw, streetAddressRaw].filter(Boolean).join(" "),
    );
    const projectAddress =
      projectAddressRaw ||
      splitAddress ||
      normalizeWhitespace(composite?.projectAddress ?? "");
    const jobTitleRaw =
      getFieldValue(rawRow, fieldToColumn, "jobTitle") ||
      normalizeWhitespace(composite?.jobTitle ?? "");
    const priceRaw =
      getFieldValue(rawRow, fieldToColumn, "price") ||
      normalizeWhitespace(composite?.priceRaw ?? "");
    const builderNameRaw = getFieldValue(rawRow, fieldToColumn, "builderName");
    const subdivisionNameRaw = getFieldValue(
      rawRow,
      fieldToColumn,
      "subdivisionName",
    );
    const superintendentRaw = getFieldValue(
      rawRow,
      fieldToColumn,
      "superintendent",
    );
    const scheduledRaw = getFieldValue(
      rawRow,
      fieldToColumn,
      "scheduledCompletion",
    );

    const title = toTitleCase(jobTitleRaw);
    const priceCents = parsePriceToCents(priceRaw);
    const superintendent = toTitleCase(superintendentRaw) || null;
    const scheduledCompletion = parseScheduledDate(scheduledRaw);

    if (!projectAddress || !title || priceCents === null) {
      const missing: string[] = [];
      if (!projectAddress) missing.push("project address");
      if (!title) missing.push("job title");
      if (priceCents === null) missing.push("price");
      summary.rowsSkippedInvalid += 1;
      summary.rowErrors.push(
        `Row ${lineNumber}: missing or invalid ${missing.join(", ")}.`,
      );
      continue;
    }

    try {
      const builderName = toTitleCase(builderNameRaw || defaultBuilder);
      const subdivisionName = toTitleCase(subdivisionNameRaw || defaultSubdivision);
      const builderId = await resolveBuilderId(builderNameRaw);
      const subdivisionId = await resolveSubdivisionId(subdivisionNameRaw);
      const projectsBefore = summary.projectsCreated;
      const projectId = await resolveProjectId({
        projectAddress,
        builderId,
        subdivisionId,
        builderName,
        subdivisionName,
      });
      const projectIsNew = summary.projectsCreated > projectsBefore;

      const jobCache = await getProjectJobCache(projectId);
      const nextJobKey = normalizeJobKey({
        title,
        priceCents,
        scheduled: scheduledCompletion,
        superintendent,
      });

      const isDuplicate = jobCache.has(nextJobKey);

      // Group jobs under their project for the user-facing preview.
      let previewIdx = previewIndexByProject.get(projectId);
      if (previewIdx === undefined) {
        previewIdx =
          summary.preview.push({
            projectAddress: normalizeProjectAddress(projectAddress),
            builderName,
            subdivisionName,
            isNew: projectIsNew,
            jobs: [],
          }) - 1;
        previewIndexByProject.set(projectId, previewIdx);
      }
      summary.preview[previewIdx].jobs.push({
        title,
        priceCents,
        scheduledCompletion,
        superintendent,
        isDuplicate,
      });

      if (isDuplicate) {
        summary.jobsSkippedDuplicate += 1;
        continue;
      }

      if (!dryRun) {
        const { error: insertJobError } = await supabase.from("jobs").insert({
          project_id: projectId,
          company_id: companyId,
          title,
          price_cents: priceCents,
          scheduled_completion: scheduledCompletion,
          superintendent,
        });
        if (insertJobError) throw new Error(insertJobError.message);
      }

      jobCache.add(nextJobKey);
      summary.jobsCreated += 1;
    } catch (error) {
      summary.rowsSkippedInvalid += 1;
      const rawMessage = error instanceof Error ? error.message : "Unknown error";
      summary.rowErrors.push(`Row ${lineNumber}: ${friendlyImportError(rawMessage)}`);
    }
  }

  if (!dryRun) {
    revalidatePath("/projects");
    revalidatePath("/dashboard");
  }

  return { ok: true, summary: { ...summary, rowErrors: summary.rowErrors.slice(0, 200) } };
}
