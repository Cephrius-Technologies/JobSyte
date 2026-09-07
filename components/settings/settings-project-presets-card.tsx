"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  createProjectPreset,
  deleteProjectPreset,
  updateProjectPreset,
  type ProjectPresetForSettings,
} from "@/app/(jobsyte-app)/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PresetJobDraft = {
  id: string;
  title: string;
  price: string;
};

function toTitleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[A-Za-z]+/g, (segment) => {
      return segment[0].toUpperCase() + segment.slice(1).toLowerCase();
    });
}

function centsToPriceInput(cents: number) {
  return (cents / 100).toFixed(2);
}

function priceInputToCents(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function createDraftId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function emptyDraftJob(): PresetJobDraft {
  return { id: createDraftId(), title: "", price: "" };
}

function toDraftJobs(preset?: ProjectPresetForSettings): PresetJobDraft[] {
  if (!preset) return [emptyDraftJob()];
  return preset.jobs.map((job) => ({
    id: createDraftId(),
    title: job.title,
    price: centsToPriceInput(job.price_cents),
  }));
}

export function SettingsProjectPresetsCard({
  initialPresets,
}: {
  initialPresets: ProjectPresetForSettings[];
}) {
  const [presets, setPresets] = useState<ProjectPresetForSettings[]>(initialPresets);
  const [editingId, setEditingId] = useState<string | null>(
    initialPresets[0]?.id ?? null,
  );
  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === editingId) ?? null,
    [editingId, presets],
  );
  const [draftName, setDraftName] = useState(selectedPreset?.name ?? "");
  const [draftJobs, setDraftJobs] = useState<PresetJobDraft[]>(
    toDraftJobs(selectedPreset ?? undefined),
  );
  const [isPending, startTransition] = useTransition();

  function loadPreset(preset: ProjectPresetForSettings) {
    setEditingId(preset.id);
    setDraftName(preset.name);
    setDraftJobs(toDraftJobs(preset));
  }

  function startNewPreset() {
    setEditingId(null);
    setDraftName("");
    setDraftJobs([emptyDraftJob()]);
  }

  function updateDraftJob(
    rowId: string,
    field: "title" | "price",
    value: string,
  ) {
    setDraftJobs((current) =>
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

  function removeDraftJob(rowId: string) {
    setDraftJobs((current) => {
      const next = current.filter((job) => job.id !== rowId);
      return next.length > 0 ? next : [emptyDraftJob()];
    });
  }

  function buildPayloadJobs() {
    return draftJobs
      .map((job) => ({
        title: toTitleCase(job.title),
        priceCents: priceInputToCents(job.price),
      }))
      .filter((job) => job.title || job.priceCents !== null)
      .map((job) => ({
        title: job.title,
        priceCents: job.priceCents ?? -1,
      }));
  }

  function savePreset() {
    const payload = {
      name: draftName,
      jobs: buildPayloadJobs(),
    };

    startTransition(async () => {
      const result = editingId
        ? await updateProjectPreset({ presetId: editingId, ...payload })
        : await createProjectPreset(payload);

      if (!result.ok || !result.preset) {
        toast.error(result.message ?? "Failed to save project preset.");
        return;
      }

      setPresets((current) => {
        const exists = current.some((preset) => preset.id === result.preset!.id);
        const next = exists
          ? current.map((preset) =>
              preset.id === result.preset!.id ? result.preset! : preset,
            )
          : [...current, result.preset!];

        return next.sort((left, right) => left.name.localeCompare(right.name));
      });
      loadPreset(result.preset);
      toast.success(result.message ?? "Project preset saved.");
    });
  }

  function deletePreset(preset: ProjectPresetForSettings) {
    const confirmed = window.confirm(`Delete "${preset.name}"?`);
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteProjectPreset(preset.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const nextPresets = presets.filter((item) => item.id !== preset.id);
      setPresets(nextPresets);
      const nextSelected = nextPresets[0] ?? null;
      if (nextSelected) loadPreset(nextSelected);
      else startNewPreset();
      toast.success(result.message ?? "Project preset deleted.");
    });
  }

  const totalJobs = presets.reduce((sum, preset) => sum + preset.jobs.length, 0);

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Save className="size-4 text-muted-foreground" />
            Project Presets
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage reusable job scopes and prices for new projects.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{presets.length} presets</Badge>
          <Badge variant="outline">{totalJobs} jobs</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(13rem,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={startNewPreset}
          >
            <Plus className="size-4" />
            New Preset
          </Button>

          <div className="space-y-2">
            {presets.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/80 p-3 text-sm text-muted-foreground">
                No project presets yet.
              </div>
            ) : (
              presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => loadPreset(preset)}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    preset.id === editingId
                      ? "border-primary/40 bg-primary/10"
                      : "border-border/80 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{preset.name}</span>
                    <Badge variant="outline">{preset.jobs.length}</Badge>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border/80 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <Label htmlFor="project-preset-name">Preset Name</Label>
              <Input
                id="project-preset-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => setDraftName((current) => toTitleCase(current))}
                placeholder="Foundation Package"
              />
            </div>
            {editingId ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => selectedPreset && deletePreset(selectedPreset)}
                disabled={isPending || !selectedPreset}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            {draftJobs.map((job, index) => (
              <div
                key={job.id}
                className="grid gap-2 rounded-md border border-border/80 bg-muted/20 p-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]"
              >
                <Input
                  value={job.title}
                  onChange={(event) =>
                    updateDraftJob(job.id, "title", event.target.value)
                  }
                  onBlur={() => updateDraftJob(job.id, "title", toTitleCase(job.title))}
                  placeholder={`Job ${index + 1} title`}
                />
                <Input
                  value={job.price}
                  onChange={(event) =>
                    updateDraftJob(job.id, "price", event.target.value)
                  }
                  placeholder="Price"
                  inputMode="decimal"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeDraftJob(job.id)}
                >
                  <X className="size-4" />
                  <span className="sr-only">Remove preset job</span>
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraftJobs((current) => [...current, emptyDraftJob()])}
            >
              <Plus className="size-4" />
              Add Job
            </Button>
            <Button
              type="button"
              onClick={savePreset}
              disabled={isPending || !draftName.trim()}
            >
              <Pencil className="size-4" />
              {isPending ? "Saving..." : editingId ? "Update Preset" : "Create Preset"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
