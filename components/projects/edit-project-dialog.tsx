"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createBuilder,
  createSubdivision,
  editProject,
} from "@/app/(jobsyte-app)/projects/actions";
import {
  CreatableCombobox,
  type ComboboxItem,
} from "@/components/projects/createable-combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { EditableProject } from "./types";

type Item = { id: string; name: string };

function toTitleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[A-Za-z]+/g, (segment) => {
      return segment[0].toUpperCase() + segment.slice(1).toLowerCase();
    });
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeStreetNumber(value: string) {
  return value.replace(/\D+/g, "");
}

function normalizeState(value: string) {
  return value.trim().replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
}

function splitProjectAddress(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return { houseNumber: "", streetAddress: "", city: "", state: "" };
  }

  const [streetLine = "", city = "", state = ""] = normalized
    .split(",")
    .map((part) => normalizeWhitespace(part));
  const firstSpace = streetLine.indexOf(" ");
  if (firstSpace === -1) {
    return {
      houseNumber: streetLine,
      streetAddress: "",
      city,
      state: normalizeState(state),
    };
  }

  return {
    houseNumber: streetLine.slice(0, firstSpace),
    streetAddress: streetLine.slice(firstSpace + 1),
    city,
    state: normalizeState(state),
  };
}

function findItemByName(items: ComboboxItem[], name: string | null) {
  const target = (name ?? "").trim().toLowerCase();
  if (!target) return null;
  return items.find((item) => item.name.trim().toLowerCase() === target) ?? null;
}

function getInitialCity(project: EditableProject) {
  return project.project_city ?? splitProjectAddress(project.project_address).city;
}

function getInitialState(project: EditableProject) {
  return project.project_state ?? splitProjectAddress(project.project_address).state;
}

export function EditProjectDialog({
  open,
  onOpenChange,
  project,
  initialBuilders,
  initialSubdivisions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project: EditableProject;
  initialBuilders: Item[];
  initialSubdivisions: Item[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [houseNumber, setHouseNumber] = useState(
    normalizeStreetNumber(splitProjectAddress(project.project_address).houseNumber),
  );
  const [streetAddress, setStreetAddress] = useState(
    splitProjectAddress(project.project_address).streetAddress,
  );
  const [city, setCity] = useState(getInitialCity(project));
  const [projectState, setProjectState] = useState(
    getInitialState(project),
  );
  const [builders, setBuilders] = useState<ComboboxItem[]>(initialBuilders);
  const [subdivisions, setSubdivisions] =
    useState<ComboboxItem[]>(initialSubdivisions);

  const [builder, setBuilder] = useState<ComboboxItem | null>(
    findItemByName(initialBuilders, project.builder_name),
  );
  const [subdivision, setSubdivision] = useState<ComboboxItem | null>(
    findItemByName(initialSubdivisions, project.subdivision),
  );

  useEffect(() => {
    setBuilders(initialBuilders);
  }, [initialBuilders]);

  useEffect(() => {
    setSubdivisions(initialSubdivisions);
  }, [initialSubdivisions]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const splitAddress = splitProjectAddress(project.project_address);
    setHouseNumber(normalizeStreetNumber(splitAddress.houseNumber));
    setStreetAddress(splitAddress.streetAddress);
    setCity(getInitialCity(project));
    setProjectState(getInitialState(project));
    setBuilder(findItemByName(initialBuilders, project.builder_name));
    setSubdivision(findItemByName(initialSubdivisions, project.subdivision));
  }, [open, project, initialBuilders, initialSubdivisions]);

  const canSubmit = useMemo(() => {
    return (
      houseNumber.trim().length > 0 &&
      streetAddress.trim().length > 0 &&
      (projectState.trim().length === 0 || projectState.trim().length === 2) &&
      !!builder &&
      !!subdivision
    );
  }, [houseNumber, streetAddress, projectState, builder, subdivision]);

  async function onCreateBuilder(name: string) {
    const res = await createBuilder(name);
    if (!res.ok || !res.data) {
      throw new Error(res.message ?? "Failed to create builder.");
    }
    setBuilders((prev) => {
      if (prev.some((p) => p.id === res.data!.id)) return prev;
      return [...prev, res.data!].sort((a, b) => a.name.localeCompare(b.name));
    });
    return res.data;
  }

  async function onCreateSubdivision(name: string) {
    const res = await createSubdivision(name);
    if (!res.ok || !res.data) {
      throw new Error(res.message ?? "Failed to create subdivision.");
    }
    setSubdivisions((prev) => {
      if (prev.some((p) => p.id === res.data!.id)) return prev;
      return [...prev, res.data!].sort((a, b) => a.name.localeCompare(b.name));
    });
    return res.data;
  }

  function onSubmit() {
    setError(null);

    const fd = new FormData();
    fd.set("project_id", project.id);
    fd.set("house_number", normalizeStreetNumber(houseNumber));
    fd.set("street_address", toTitleCase(streetAddress));
    // Preserve the full map-qualified address when users edit projects that
    // were created with city/state context.
    fd.set("city", toTitleCase(city));
    fd.set("state", normalizeState(projectState));

    if (builder?.id) fd.set("builder_id", builder.id);
    if (subdivision?.id) fd.set("subdivision_id", subdivision.id);

    startTransition(async () => {
      const res = await editProject(fd);
      if (!res.ok) {
        setError(res.message ?? "Failed to update project.");
        return;
      }

      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (isPending || !canSubmit) return;
            onSubmit();
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <div className="space-y-2">
              <label htmlFor="edit-project-dialog-houseNumber" className="text-sm font-medium">Street Number</label>
              <Input id="edit-project-dialog-houseNumber" value={houseNumber}
                onChange={(e) => setHouseNumber(normalizeStreetNumber(e.target.value))}
                onBlur={() =>
                  setHouseNumber((current) => normalizeStreetNumber(current))
                }
                placeholder="1234"
              />
            </div>

            <div className="space-y-2 sm:col-span-3">
              <label htmlFor="edit-project-dialog-streetAddress" className="text-sm font-medium">Street Address</label>
              <Input id="edit-project-dialog-streetAddress" value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                onBlur={() =>
                  setStreetAddress((current) => toTitleCase(current))
                }
                placeholder="Main St"
              />
            </div>

            <div className="space-y-2 sm:col-span-1">
              <label htmlFor="edit-project-dialog-city" className="text-sm font-medium">City</label>
              <Input id="edit-project-dialog-city" value={city}
                onChange={(e) => setCity(e.target.value)}
                onBlur={() => setCity((current) => toTitleCase(current))}
                placeholder="Dallas"
              />
            </div>

            <div className="space-y-2 sm:col-span-1">
              <label htmlFor="edit-project-dialog-projectState" className="text-sm font-medium">State</label>
              <Input id="edit-project-dialog-projectState" value={projectState}
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

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
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
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
