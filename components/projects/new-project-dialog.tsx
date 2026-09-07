"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Wand2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useCompany } from "@/lib/company-context";
import {
  createBuilder,
  createSubdivision,
  createProject,
} from "@/app/(jobsyte-app)/projects/actions";
import {
  CreatableCombobox,
  type ComboboxItem,
} from "@/components/projects/createable-combobox";

function toTitleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[A-Za-z]+/g, (segment) => {
      return segment[0].toUpperCase() + segment.slice(1).toLowerCase();
    });
}

function normalizeStreetNumber(value: string) {
  return value.replace(/\D+/g, "");
}

function normalizeState(value: string) {
  return value.trim().replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
}

type Item = { id: string; name: string };
type PresetJobDraft = {
  id: string;
  title: string;
  price: string;
};
type ProjectPreset = {
  id: string;
  name: string;
  jobs: PresetJobDraft[];
};

type PresetRow = {
  id: string;
  name: string;
};

type PresetJobRow = {
  id: string;
  preset_id: string;
  title: string;
  price_cents: number;
  sort_order: number | null;
};

function findItemById(items: ComboboxItem[], id: string | null) {
  if (!id) return null;
  return items.find((item) => item.id === id) ?? null;
}

function centsToPriceInput(cents: number | null | undefined) {
  if (typeof cents !== "number") return "";
  return (cents / 100).toFixed(2);
}

function createEmptyPresetJob(): PresetJobDraft {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    title: "",
    price: "",
  };
}

export function NewProjectDialog({
  open,
  onOpenChange,
  initialBuilders = [],
  initialSubdivisions = [],
  initialBuilderId = "",
  initialSubdivisionId = "",
  initialHouseNumber = "",
  initialStreetAddress = "",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialBuilders?: Item[];
  initialSubdivisions?: Item[];
  initialBuilderId?: string;
  initialSubdivisionId?: string;
  initialHouseNumber?: string;
  initialStreetAddress?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { activeCompany } = useCompany();

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [houseNumber, setHouseNumber] = useState(
    normalizeStreetNumber(initialHouseNumber),
  );
  const [streetAddress, setStreetAddress] = useState(
    toTitleCase(initialStreetAddress),
  );
  const [city, setCity] = useState("");
  const [projectState, setProjectState] = useState("");

  const [builders, setBuilders] = useState<ComboboxItem[]>(initialBuilders);
  const [subdivisions, setSubdivisions] =
    useState<ComboboxItem[]>(initialSubdivisions);

  const [builder, setBuilder] = useState<ComboboxItem | null>(
    findItemById(initialBuilders, initialBuilderId),
  );
  const [subdivision, setSubdivision] = useState<ComboboxItem | null>(
    findItemById(initialSubdivisions, initialSubdivisionId),
  );
  const [presets, setPresets] = useState<ProjectPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetJobs, setPresetJobs] = useState<PresetJobDraft[]>([]);
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [presetName, setPresetName] = useState("");

  useEffect(() => {
    if (!open) return;
    let isActive = true;

    const needsBuilders = initialBuilders.length === 0;
    const needsSubdivisions = initialSubdivisions.length === 0;
    if (!needsBuilders && !needsSubdivisions) {
      return () => {
        isActive = false;
      };
    }

    (async () => {
      const [buildersRes, subdivisionsRes] = await Promise.all([
        supabase.from("builders").select("id, name").order("name"),
        supabase.from("subdivisions").select("id, name").order("name"),
      ]);

      if (!isActive) return;
      if (needsBuilders && buildersRes.data) {
        const loadedBuilders = buildersRes.data as ComboboxItem[];
        setBuilders(loadedBuilders);
        if (initialBuilderId) {
          const initialBuilder = findItemById(loadedBuilders, initialBuilderId);
          if (initialBuilder) {
            setBuilder((current) => current ?? initialBuilder);
          }
        }
      }
      if (needsSubdivisions && subdivisionsRes.data) {
        const loadedSubdivisions = subdivisionsRes.data as ComboboxItem[];
        setSubdivisions(loadedSubdivisions);
        if (initialSubdivisionId) {
          const initialSubdivision = findItemById(
            loadedSubdivisions,
            initialSubdivisionId,
          );
          if (initialSubdivision) {
            setSubdivision((current) => current ?? initialSubdivision);
          }
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [
    open,
    initialBuilders,
    initialSubdivisions,
    initialBuilderId,
    initialSubdivisionId,
    supabase,
  ]);

  useEffect(() => {
    if (!open || !activeCompany?.id) return;
    let isActive = true;

    (async () => {
      const [presetsRes, jobsRes] = await Promise.all([
        supabase
          .from("project_presets")
          .select("id, name")
          .eq("company_id", activeCompany.id)
          .is("deleted_at", null)
          .order("name"),
        supabase
          .from("project_preset_jobs")
          .select("id, preset_id, title, price_cents, sort_order")
          .order("sort_order", { ascending: true }),
      ]);

      if (!isActive) return;
      if (presetsRes.error || jobsRes.error) {
        setPresets([]);
        return;
      }

      const jobRows = (jobsRes.data ?? []) as PresetJobRow[];
      const jobsByPreset = new Map<string, PresetJobDraft[]>();
      for (const job of jobRows) {
        const list = jobsByPreset.get(job.preset_id) ?? [];
        list.push({
          id: job.id,
          title: job.title,
          price: centsToPriceInput(job.price_cents),
        });
        jobsByPreset.set(job.preset_id, list);
      }

      setPresets(
        ((presetsRes.data ?? []) as PresetRow[]).map((preset) => ({
          id: preset.id,
          name: preset.name,
          jobs: jobsByPreset.get(preset.id) ?? [],
        })),
      );
    })();

    return () => {
      isActive = false;
    };
  }, [activeCompany?.id, open, supabase]);

  const canSubmit = useMemo(() => {
    return (
      houseNumber.trim().length > 0 &&
      streetAddress.trim().length > 0 &&
      (projectState.trim().length === 0 || projectState.trim().length === 2) &&
      !!builder &&
      !!subdivision
    );
  }, [houseNumber, streetAddress, projectState, builder, subdivision]);

  const presetJobCount = presetJobs.filter(
    (job) => job.title.trim() || job.price.trim(),
  ).length;

  async function onCreateBuilder(name: string) {
    const res = await createBuilder(name);
    if (!res.ok || !res.data)
      throw new Error(res.message ?? "Failed to create builder.");
    setBuilders((prev) => {
      if (prev.some((p) => p.id === res.data!.id)) return prev;
      return [...prev, res.data!].sort((a, b) => a.name.localeCompare(b.name));
    });
    return res.data;
  }

  async function onCreateSubdivision(name: string) {
    const res = await createSubdivision(name);
    if (!res.ok || !res.data)
      throw new Error(res.message ?? "Failed to create subdivision.");
    setSubdivisions((prev) => {
      if (prev.some((p) => p.id === res.data!.id)) return prev;
      return [...prev, res.data!].sort((a, b) => a.name.localeCompare(b.name));
    });
    return res.data;
  }

  function applyPreset(presetId: string) {
    setSelectedPresetId(presetId);

    const selected = presets.find((preset) => preset.id === presetId);
    if (!selected) {
      setPresetJobs([]);
      return;
    }

    setPresetName(selected.name);
    setPresetJobs(
      selected.jobs.map((job) => ({
        ...job,
        id: createEmptyPresetJob().id,
      })),
    );
  }

  function updatePresetJob(
    rowId: string,
    field: "title" | "price",
    value: string,
  ) {
    setPresetJobs((current) =>
      current.map((job) =>
        job.id === rowId
          ? {
              ...job,
              [field]: field === "title" ? value : value.replace(/[^0-9.]/g, ""),
            }
          : job,
      ),
    );
  }

  function removePresetJob(rowId: string) {
    setPresetJobs((current) => current.filter((job) => job.id !== rowId));
  }

  function resetPresetDraft() {
    setSelectedPresetId("");
    setPresetJobs([]);
    setSaveAsPreset(false);
    setPresetName("");
    setError(null);
  }

  function onSubmit() {
    setError(null);

    if (saveAsPreset && !presetName.trim()) {
      setError("Enter a preset name before saving this job set.");
      return;
    }
    if (saveAsPreset && presetJobCount === 0) {
      setError("Add at least one job before saving a preset.");
      return;
    }

    const fd = new FormData();
    fd.set("house_number", normalizeStreetNumber(houseNumber));
    fd.set("street_address", toTitleCase(streetAddress));


    // City/state stay separate from the street title so invoices snapshot only
    // the project address while maps can still use the extra context.

    fd.set("city", toTitleCase(city));
    fd.set("state", normalizeState(projectState));

    // We submit IDs when selected.
    if (builder?.id) fd.set("builder_id", builder.id);
    // (Fallback if you ever want: fd.set("builder_name", builder?.name ?? ""))

    if (subdivision?.id) fd.set("subdivision_id", subdivision.id);

    for (const job of presetJobs) {
      if (!job.title.trim() && !job.price.trim()) continue;
      fd.append("preset_job_title", job.title);
      fd.append("preset_job_price", job.price);
    }

    if (saveAsPreset && presetName.trim()) {
      fd.set("save_preset_name", presetName);
    }

    startTransition(async () => {
      const res = await createProject(fd);
      if (!res.ok) {
        setError(
          "message" in res && res.message
            ? res.message
            : "Failed to create project.",
        );
        return;
      }
      if (!("projectId" in res)) {
        setError("Project was created, but no project ID was returned.");
        return;
      }

      router.refresh();
      onOpenChange(false);
      router.push(`/projects/${res.projectId}`);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetPresetDraft();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>Add a project address and reuse a saved builder and subdivision, or create them here.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (isPending || !canSubmit) return;
            onSubmit();
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <div className="space-y-2">
              <label htmlFor="new-project-dialog-houseNumber" className="text-sm font-medium">Street Number</label>
              <Input id="new-project-dialog-houseNumber" value={houseNumber}
                onChange={(e) => setHouseNumber(normalizeStreetNumber(e.target.value))}
                onBlur={() =>
                  setHouseNumber((current) => normalizeStreetNumber(current))
                }
                placeholder="1234"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="new-project-dialog-streetAddress" className="text-sm font-medium">Street Address</label>
              <Input id="new-project-dialog-streetAddress" value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                onBlur={() =>
                  setStreetAddress((current) => toTitleCase(current))
                }
                placeholder="Main St"
              />
            </div>

            <div className="space-y-2 sm:col-span-1">
              <label htmlFor="new-project-dialog-city" className="text-sm font-medium">City</label>
              <Input id="new-project-dialog-city" value={city}
                onChange={(e) => setCity(e.target.value)}
                onBlur={() => setCity((current) => toTitleCase(current))}
                placeholder="Dallas"
              />
            </div>

            <div className="space-y-2 sm:col-span-1">
              <label htmlFor="new-project-dialog-projectState" className="text-sm font-medium">State</label>
              <Input id="new-project-dialog-projectState" value={projectState}
                onChange={(e) => setProjectState(normalizeState(e.target.value))}
                onBlur={() =>
                  setProjectState((current) => normalizeState(current))
                }
                placeholder="TX"
                maxLength={2}
              />
            </div>
          </div>

          <CreatableCombobox
            label="Builder"
            placeholder="Select or create builder..."
            items={builders}
            value={builder}
            onChange={setBuilder}
            onCreate={onCreateBuilder}
            onDelete={(item) => {
              setBuilders((prev) => prev.filter((entry) => entry.id !== item.id));
            }}
          />

          <CreatableCombobox
            label="Subdivision"
            placeholder="Select or create subdivision..."
            items={subdivisions}
            value={subdivision}
            onChange={setSubdivision}
            onCreate={onCreateSubdivision}
            onDelete={(item) => {
              setSubdivisions((prev) =>
                prev.filter((entry) => entry.id !== item.id),
              );
            }}
          />

          <section className="rounded-lg border border-border/80 bg-muted/20 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Wand2 className="size-4 text-primary" />
                  Project Presets
                  {presetJobCount > 0 ? (
                    <Badge variant="outline">{presetJobCount} jobs</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add repeatable jobs now; scheduled dates can be assigned later.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() =>
                  setPresetJobs((current) => [...current, createEmptyPresetJob()])
                }
              >
                <Plus className="size-4" />
                Add Job
              </Button>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Select value={selectedPresetId} onValueChange={applyPreset}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Apply a saved preset..." />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={presetJobs.length === 0}
                onClick={() => {
                  setSelectedPresetId("");
                  setPresetJobs([]);
                  setSaveAsPreset(false);
                  setPresetName("");
                }}
              >
                Clear
              </Button>
            </div>

            <div className="mt-3 space-y-2">
              {presetJobs.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/80 bg-background/70 p-3 text-xs text-muted-foreground">
                  No preset jobs selected.
                </div>
              ) : (
                presetJobs.map((job, index) => (
                  <div
                    key={job.id}
                    className="grid gap-2 rounded-md border border-border/80 bg-background/80 p-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]"
                  >
                    <Input
                      value={job.title}
                      onChange={(event) =>
                        updatePresetJob(job.id, "title", event.target.value)
                      }
                      onBlur={() =>
                        updatePresetJob(job.id, "title", toTitleCase(job.title))
                      }
                      placeholder={`Job ${index + 1} title`}
                    />
                    <Input
                      value={job.price}
                      onChange={(event) =>
                        updatePresetJob(job.id, "price", event.target.value)
                      }
                      placeholder="Price"
                      inputMode="decimal"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removePresetJob(job.id)}
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Remove preset job</span>
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 flex flex-col gap-2 rounded-md border border-border/70 bg-background/70 p-2 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={saveAsPreset}
                  onCheckedChange={(checked) => setSaveAsPreset(checked === true)}
                />
                Save these jobs as a preset
              </label>
              <Input
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                disabled={!saveAsPreset}
                placeholder="Preset name"
                className="sm:max-w-64"
              />
            </div>
          </section>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !canSubmit}
            >
              {isPending ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
