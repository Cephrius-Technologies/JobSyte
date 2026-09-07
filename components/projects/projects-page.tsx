"use client";

// Onboarding: this is the main project workbench. Server data is loaded by
// `app/(jobsyte-app)/(app)/projects/page.tsx`; mutations live in
// `app/(jobsyte-app)/(app)/projects/actions.ts` and job dialogs in
// `components/jobs/*`.
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useBrowserStoredState } from "@/hooks/use-browser-storage";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  FileText,
  Home,
  List,
  ListTodo,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { AddJobDialog } from "@/components/jobs/add-job-dialog";
import { CreateInvoiceDialog } from "@/components/invoices/create-invoice-dialog";
import { ImportProjectJobsButton } from "@/components/projects/import-project-jobs-button";
import { NewProjectButton } from "@/components/projects/new-project-button";
import {
  getProjectLocationSubtitle,
  getProjectStreetTitle,
} from "@/components/projects/project-location";
import type {
  LookupItem,
  ProjectBillingStatus,
  ProjectListItem,
} from "@/components/projects/types";
import {
  QuickJobComplete,
  type QuickJobItem,
} from "@/components/projects/quick-job-complete";
import { QuickJobDrawer } from "@/components/projects/quick-job-drawer";
import { getProjectJobs } from "@/components/projects/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FilterDialog,
  FilterDialogSection,
} from "@/components/ui/filter-dialog";
import { cn } from "@/lib/utils";
import { DeleteProjectButton } from "./delete-project-button";
import { EditProjectDialog } from "./edit-project-dialog";
import { SubdivisionGroupActionsMenu } from "./subdivision-group-actions-menu";
import { StreetGroupActionsMenu } from "./street-group-actions-menu";

import { parseProjectsView, PROJECTS_VIEW_STORAGE_KEY, type ProjectsView as ViewMode } from "./projects-view";
const PROJECTS_SELECTED_STORAGE_KEY = "projects:selected-project-id";
const PROJECTS_EXPANDED_SUBDIVISIONS_STORAGE_KEY =
  "projects:expanded-subdivisions";
const PROJECTS_EXPANDED_BUILDERS_STORAGE_KEY = "projects:expanded-builders";
const PROJECTS_EXPANDED_STREETS_STORAGE_KEY = "projects:expanded-streets";
const UNASSIGNED_BUILDER = "__unassigned_builder__";
const UNASSIGNED_SUBDIVISION = "__unassigned_subdivision__";

type StatusFilter = "all" | ProjectListItem["status"] | ProjectBillingStatus;

type StreetGroup = {
  key: string;
  label: string;
  projects: ProjectListItem[];
  totalJobCount: number;
  openJobCount: number;
};

type BuilderGroup = {
  key: string;
  label: string;
  streets: StreetGroup[];
  builder_id: string | null;
  projectCount: number;
  totalJobCount: number;
  openJobCount: number;
};

type SubdivisionGroup = {
  key: string;
  label: string;
  builders: BuilderGroup[];
  subdivision_id: string | null;
  projectCount: number;
  totalJobCount: number;
  openJobCount: number;
};

function formatRelativeTime(value: string | null): string {
  if (!value) return "No activity yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity yet";

  return format(date, "MMM d, yyyy");
}

function statusLabel(status: ProjectListItem["status"]): string {
  if (status === "not-started") return "Not Started";
  if (status === "completed") return "Completed";
  return "Active";
}

function billingStatusLabel(status: ProjectBillingStatus): string {
  if (status === "paid") return "Paid";
  return "Invoiced";
}

function ProjectStatusBadges({ project }: { project: ProjectListItem }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <StatusBadge
        tone={
          project.status === "completed"
            ? "success"
            : project.status === "not-started"
              ? "neutral"
              : "info"
        }
      >
        {statusLabel(project.status)}
      </StatusBadge>
      {project.billing_statuses.map((status) => (
        <StatusBadge
          key={status}
          tone={status === "paid" ? "success" : "neutral"}
        >
          {billingStatusLabel(status)}
        </StatusBadge>
      ))}
    </span>
  );
}

function toInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function parseStoredKeys(raw: string | null): string[] | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return null;
  }
}

function serializeStoredKeys(value: string[] | null) {
  return value === null ? null : JSON.stringify(value);
}

function getStreetFolderLabel(projectAddress: string): string {
  const normalized = (projectAddress.split(",")[0] ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!normalized) return "Unassigned Street";

  const match = normalized.match(/^\d+\s+(.+)$/);
  if (match?.[1]) return match[1].trim();

  return normalized;
}

function ProjectCardActionsDropdown({
  project,
  builders,
  subdivisions,
  onViewProject,
  onQuickComplete,
}: {
  project: ProjectListItem;
  builders: LookupItem[];
  subdivisions: LookupItem[];
  onViewProject?: (projectId: string) => void;
  onQuickComplete?: (projectId: string) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Project actions"
            className="cursor-pointer gap-2 border-border hover:bg-muted"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
            <span className="hidden sm:inline">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={(event) => {
              event.preventDefault();
              setEditOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Edit Project
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={(event) => {
              event.preventDefault();
              setAddJobOpen(true);
            }}
          >
            <Plus className="size-4" />
            New Job
          </DropdownMenuItem>
          {/* Quick Complete button only visible when selected project sidebar is not visible (< xl) */}
          <div className="xl:hidden">
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={(event) => {
                event.preventDefault();
                onQuickComplete?.(project.id);
              }}
            >
              <ListTodo className="size-4" />
              Quick Complete
            </DropdownMenuItem>
          </div>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link
              href={`/projects/${project.id}`}
              className="flex w-full items-center gap-2"
              onClick={() => onViewProject?.(project.id)}
            >
              <ArrowRight className="size-4" />
              View Jobs
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={(event) => {
              event.preventDefault();
              setCreateInvoiceOpen(true);
            }}
          >
            <FileText className="size-4" />
            New Invoice
          </DropdownMenuItem>
          <DeleteProjectButton
            projectId={project.id}
            trigger={
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(event) => event.preventDefault()}
              >
                <Trash2 className="size-4" />
                Delete Project
              </DropdownMenuItem>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <EditProjectDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        initialBuilders={builders}
        initialSubdivisions={subdivisions}
      />
      <AddJobDialog
        projectId={project.id}
        open={addJobOpen}
        onOpenChange={setAddJobOpen}
      />
      <CreateInvoiceDialog
        projectId={project.id}
        open={createInvoiceOpen}
        onOpenChange={setCreateInvoiceOpen}
      />
    </>
  );
}

export function ProjectsPageClient({
  projects,
  builders,
  subdivisions,
}: {
  projects: ProjectListItem[];
  builders: LookupItem[];
  subdivisions: LookupItem[];
}) {
  const [query, setQuery] = useState("");
  const [crewFilter, setCrewFilter] = useState("all");
  const [builderFilter, setBuilderFilter] = useState("all");
  const [subdivisionFilter, setSubdivisionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [view, setView] = useBrowserStoredState<ViewMode>({
    key: PROJECTS_VIEW_STORAGE_KEY,
    defaultValue: "list",
    parse: parseProjectsView,
    serialize: (value) => value,
  });
  const [expandedSubdivisions, setExpandedSubdivisions] = useBrowserStoredState<
    string[] | null
  >({
    key: PROJECTS_EXPANDED_SUBDIVISIONS_STORAGE_KEY,
    defaultValue: null,
    parse: parseStoredKeys,
    serialize: serializeStoredKeys,
  });
  const [expandedBuilders, setExpandedBuilders] = useBrowserStoredState<
    string[] | null
  >({
    key: PROJECTS_EXPANDED_BUILDERS_STORAGE_KEY,
    defaultValue: null,
    parse: parseStoredKeys,
    serialize: serializeStoredKeys,
  });
  const [expandedStreets, setExpandedStreets] = useBrowserStoredState<
    string[] | null
  >({
    key: PROJECTS_EXPANDED_STREETS_STORAGE_KEY,
    defaultValue: null,
    parse: parseStoredKeys,
    serialize: serializeStoredKeys,
  });
  const [selectedProjectId, setSelectedProjectId] = useBrowserStoredState<
    string | null
  >({
    key: PROJECTS_SELECTED_STORAGE_KEY,
    storage: "session",
    defaultValue: projects[0]?.id ?? null,
    parse: (raw) => raw || projects[0]?.id || null,
    serialize: (value) => value,
  });
  const [selectedProjectJobs, setSelectedProjectJobs] = useState<
    QuickJobItem[]
  >([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [quickCompleteDrawerOpen, setQuickCompleteDrawerOpen] = useState(false);
  const isMobile = useIsMobile();
  const router = useRouter();

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedProjectJobs([]);
      return;
    }

    // Clear previous project's jobs immediately to avoid showing stale data
    setSelectedProjectJobs([]);

    let isMounted = true;

    const fetchJobs = async () => {
      setIsLoadingJobs(true);
      try {
        const result = await getProjectJobs(selectedProjectId);
        if (!isMounted) {
          return;
        }

        if (result.ok) {
          setSelectedProjectJobs(result.jobs);
        } else {
          // On error, ensure we don't keep stale jobs in the UI
          setSelectedProjectJobs([]);
          console.error(
            "Failed to load jobs for project",
            selectedProjectId,
            result,
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingJobs(false);
        }
      }
    };

    fetchJobs();

    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  const crewOptions = useMemo(() => {
    const set = new Set<string>();
    for (const project of projects) {
      for (const name of project.crew_names) {
        set.add(name);
      }
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();

    return projects
      .filter((project) => {
        const normalizedBuilder = project.builder_name ?? UNASSIGNED_BUILDER;
        const normalizedSubdivision =
          project.subdivision ?? UNASSIGNED_SUBDIVISION;

        const matchesCrew =
          crewFilter === "all" || project.crew_names.includes(crewFilter);
        const matchesBuilder =
          builderFilter === "all" || builderFilter === normalizedBuilder;
        const matchesSubdivision =
          subdivisionFilter === "all" ||
          subdivisionFilter === normalizedSubdivision;
        // Lifecycle and billing are separate states, so the status filter can
        // match either the work state ("Completed") or billing state ("Invoiced").
        const matchesStatus =
          statusFilter === "all" ||
          statusFilter === project.status ||
          project.billing_statuses.includes(
            statusFilter as ProjectBillingStatus,
          );
        const matchesQuery =
          q.length === 0 ||
          getProjectStreetTitle(project).toLowerCase().includes(q) ||
          getProjectLocationSubtitle(project).toLowerCase().includes(q) ||
          (project.builder_name ?? "").toLowerCase().includes(q) ||
          (project.subdivision ?? "").toLowerCase().includes(q) ||
          project.crew_names.some((name) => name.toLowerCase().includes(q));

        return (
          matchesCrew &&
          matchesBuilder &&
          matchesSubdivision &&
          matchesStatus &&
          matchesQuery
        );
      })
      .sort((a, b) => {
        const aActivity = a.last_activity_at ?? a.created_at ?? "";
        const bActivity = b.last_activity_at ?? b.created_at ?? "";
        return bActivity.localeCompare(aActivity);
      });
  }, [
    projects,
    query,
    crewFilter,
    builderFilter,
    subdivisionFilter,
    statusFilter,
  ]);

  const groupedProjects = useMemo<SubdivisionGroup[]>(() => {
    const subdivisionMap = new Map<
      string,
      {
        key: string;
        label: string;
        subdivision_id: string | null;
        builders: Map<
          string,
          {
            key: string;
            label: string;
            builder_id: string | null;
            streets: Map<
              string,
              {
                key: string;
                label: string;
                projects: ProjectListItem[];
              }
            >;
          }
        >;
      }
    >();

    for (const project of filteredProjects) {
      const subdivisionLabel =
        project.subdivision?.trim() || "Unassigned Subdivision";
      const subdivisionKey =
        project.subdivision_id ??
        (project.subdivision?.trim()
          ? `subdivision:${subdivisionLabel.toLowerCase()}`
          : UNASSIGNED_SUBDIVISION);
      const builderLabel = project.builder_name?.trim() || "Unassigned Builder";
      const builderKey = `${subdivisionKey}::${
        project.builder_id ??
        (project.builder_name?.trim()
          ? `builder:${builderLabel.toLowerCase()}`
          : UNASSIGNED_BUILDER)
      }`;
      const streetLabel = getStreetFolderLabel(project.project_address);
      const streetKey = `${builderKey}::${streetLabel.toLowerCase()}`;

      const subdivisionGroup = subdivisionMap.get(subdivisionKey) ?? {
        key: subdivisionKey,
        label: subdivisionLabel,
        subdivision_id: project.subdivision_id,
        builders: new Map(),
      };

      const builderGroup = subdivisionGroup.builders.get(builderKey) ?? {
        key: builderKey,
        label: builderLabel,
        builder_id: project.builder_id,
        streets: new Map(),
      };

      const streetGroup = builderGroup.streets.get(streetKey) ?? {
        key: streetKey,
        label: streetLabel,
        projects: [],
      };

      streetGroup.projects.push(project);
      builderGroup.streets.set(streetKey, streetGroup);
      subdivisionGroup.builders.set(builderKey, builderGroup);
      subdivisionMap.set(subdivisionKey, subdivisionGroup);
    }

    return Array.from(subdivisionMap.values())
      .map((subdivisionGroup) => {
        const builders = Array.from(subdivisionGroup.builders.values())
          .map((builderGroup) => {
            const streets = Array.from(builderGroup.streets.values())
              .map((streetGroup) => {
                const sortedProjects = [...streetGroup.projects].sort((a, b) =>
                  getProjectStreetTitle(a).localeCompare(
                    getProjectStreetTitle(b),
                  ),
                );

                return {
                  key: streetGroup.key,
                  label: streetGroup.label,
                  projects: sortedProjects,
                  totalJobCount: sortedProjects.reduce(
                    (sum, project) => sum + project.job_count,
                    0,
                  ),
                  openJobCount: sortedProjects.reduce(
                    (sum, project) => sum + project.open_job_count,
                    0,
                  ),
                };
              })
              .sort((a, b) => a.label.localeCompare(b.label));

            return {
              key: builderGroup.key,
              label: builderGroup.label,
              streets,
              builder_id: builderGroup.builder_id,
              projectCount: streets.reduce(
                (sum, streetGroup) => sum + streetGroup.projects.length,
                0,
              ),
              totalJobCount: streets.reduce(
                (sum, streetGroup) => sum + streetGroup.totalJobCount,
                0,
              ),
              openJobCount: streets.reduce(
                (sum, streetGroup) => sum + streetGroup.openJobCount,
                0,
              ),
            };
          })
          .sort((a, b) => a.label.localeCompare(b.label));

        return {
          key: subdivisionGroup.key,
          label: subdivisionGroup.label,
          builders,
          subdivision_id: subdivisionGroup.subdivision_id,
          projectCount: builders.reduce(
            (sum, builderGroup) => sum + builderGroup.projectCount,
            0,
          ),
          totalJobCount: builders.reduce(
            (sum, builderGroup) => sum + builderGroup.totalJobCount,
            0,
          ),
          openJobCount: builders.reduce(
            (sum, builderGroup) => sum + builderGroup.openJobCount,
            0,
          ),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredProjects]);

  const effectiveExpandedSubdivisions = useMemo(() => {
    const subdivisionKeys = new Set(groupedProjects.map((group) => group.key));
    const defaultExpanded = groupedProjects[0] ? [groupedProjects[0].key] : [];
    const currentExpanded = expandedSubdivisions ?? defaultExpanded;

    return currentExpanded.filter((key) => subdivisionKeys.has(key));
  }, [expandedSubdivisions, groupedProjects]);

  const effectiveExpandedBuilders = useMemo(() => {
    const builderKeys = new Set(
      groupedProjects.flatMap((group) =>
        group.builders.map((builderGroup) => builderGroup.key),
      ),
    );
    const defaultExpanded = groupedProjects[0]?.builders[0]
      ? [groupedProjects[0].builders[0].key]
      : [];
    const currentExpanded = expandedBuilders ?? defaultExpanded;

    return currentExpanded.filter((key) => builderKeys.has(key));
  }, [expandedBuilders, groupedProjects]);

  const effectiveExpandedStreets = useMemo(() => {
    const streetKeys = new Set(
      groupedProjects.flatMap((group) =>
        group.builders.flatMap((builderGroup) =>
          builderGroup.streets.map((streetGroup) => streetGroup.key),
        ),
      ),
    );
    const defaultExpanded = groupedProjects[0]?.builders[0]?.streets[0]
      ? [groupedProjects[0].builders[0].streets[0].key]
      : [];
    const currentExpanded = expandedStreets ?? defaultExpanded;

    return currentExpanded.filter((key) => streetKeys.has(key));
  }, [expandedStreets, groupedProjects]);

  const effectiveSelectedProjectId = useMemo(() => {
    if (filteredProjects.length === 0) return null;
    if (!selectedProjectId) return filteredProjects[0].id;

    const exists = filteredProjects.some(
      (project) => project.id === selectedProjectId,
    );
    return exists ? selectedProjectId : filteredProjects[0].id;
  }, [filteredProjects, selectedProjectId]);

  const selectedProject = useMemo(() => {
    if (!effectiveSelectedProjectId) return null;
    return (
      filteredProjects.find(
        (project) => project.id === effectiveSelectedProjectId,
      ) ?? null
    );
  }, [filteredProjects, effectiveSelectedProjectId]);

  // Count both text and structured filters so the trigger shows the full state.
  const activeFilterCount =
    Number(query.trim().length > 0) +
    Number(crewFilter !== "all") +
    Number(builderFilter !== "all") +
    Number(subdivisionFilter !== "all") +
    Number(statusFilter !== "all");

  function resetFilters() {
    setQuery("");
    setCrewFilter("all");
    setBuilderFilter("all");
    setSubdivisionFilter("all");
    setStatusFilter("all");
  }

  function toggleSubdivision(subdivisionKey: string) {
    setExpandedSubdivisions((prev) => {
      const defaultExpanded = groupedProjects[0]
        ? [groupedProjects[0].key]
        : [];
      const currentExpanded = prev ?? defaultExpanded;

      if (currentExpanded.includes(subdivisionKey)) {
        return currentExpanded.filter((key) => key !== subdivisionKey);
      }

      return [...currentExpanded, subdivisionKey];
    });
  }

  function toggleBuilder(builderKey: string) {
    setExpandedBuilders((prev) => {
      const defaultExpanded = groupedProjects[0]?.builders[0]
        ? [groupedProjects[0].builders[0].key]
        : [];
      const currentExpanded = prev ?? defaultExpanded;

      if (currentExpanded.includes(builderKey)) {
        return currentExpanded.filter((key) => key !== builderKey);
      }

      return [...currentExpanded, builderKey];
    });
  }

  function toggleStreet(streetKey: string) {
    setExpandedStreets((prev) => {
      const defaultExpanded = groupedProjects[0]?.builders[0]?.streets[0]
        ? [groupedProjects[0].builders[0].streets[0].key]
        : [];
      const currentExpanded = prev ?? defaultExpanded;

      if (currentExpanded.includes(streetKey)) {
        return currentExpanded.filter((key) => key !== streetKey);
      }

      return [...currentExpanded, streetKey];
    });
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <PageHeader
            title="Projects"
            description="Manage your active and completed construction projects."
          />
          <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <ImportProjectJobsButton className="w-full sm:w-auto" />
            <NewProjectButton
              initialBuilders={builders}
              initialSubdivisions={subdivisions}
              buttonClassName="w-full sm:w-auto"
            />
          </div>
        </div>
        <EmptyState
          title="No projects yet"
          description="Create your first project to begin tracking jobs and invoices."
          action={
            <NewProjectButton
              initialBuilders={builders}
              initialSubdivisions={subdivisions}
              buttonLabel="Create Project"
            />
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <PageHeader
            title="Projects"
            description="Manage your active and completed construction projects."
          />

          <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
              <FilterDialog
                title="Project Filters"
                description="Search and filter projects from a single modal."
                activeCount={activeFilterCount}
                onClear={resetFilters}
              >
                <FilterDialogSection title="Search">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search projects..."
                  />
                </FilterDialogSection>

                <FilterDialogSection title="Superintendent / GC">
                  <Select value={crewFilter} onValueChange={setCrewFilter}>
                    <SelectTrigger className="w-full justify-between">
                      <SelectValue placeholder="All Crew" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Superintendents / GC</SelectItem>
                      {crewOptions.map((crewName) => (
                        <SelectItem key={crewName} value={crewName}>
                          {crewName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterDialogSection>

                <FilterDialogSection title="Builder">
                  <Select
                    value={builderFilter}
                    onValueChange={setBuilderFilter}
                  >
                    <SelectTrigger className="w-full justify-between">
                      <SelectValue placeholder="All Builders" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Builders</SelectItem>
                      {builders.map((builder) => (
                        <SelectItem key={builder.id} value={builder.name}>
                          {builder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterDialogSection>

                <FilterDialogSection title="Subdivision">
                  <Select
                    value={subdivisionFilter}
                    onValueChange={setSubdivisionFilter}
                  >
                    <SelectTrigger className="w-full justify-between">
                      <SelectValue placeholder="All Subdivisions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Subdivisions</SelectItem>
                      {subdivisions.map((subdivision) => (
                        <SelectItem
                          key={subdivision.id}
                          value={subdivision.name}
                        >
                          {subdivision.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterDialogSection>

                <FilterDialogSection title="Status">
                  <Select
                    value={statusFilter}
                    onValueChange={(value) =>
                      setStatusFilter(value as StatusFilter)
                    }
                  >
                    <SelectTrigger className="w-full justify-between">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="invoiced">Invoiced</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="not-started">Not Started</SelectItem>
                    </SelectContent>
                  </Select>
                </FilterDialogSection>
              </FilterDialog>
              <div className="ml-auto sm:ml-0 inline-flex overflow-hidden rounded-md border bg-background">
                <Button
                  type="button"
                  variant={view === "list" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-none border-0 cursor-pointer"
                  onClick={() => setView("list")}
                  aria-label="List view"
                >
                  <List className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant={view === "grouped" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-none border-0 cursor-pointer"
                  onClick={() => setView("grouped")}
                  aria-label="Grouped view"
                >
                  <Building2 className="size-4" />
                </Button>
              </div>
            </div>

            <NewProjectButton
              initialBuilders={builders}
              initialSubdivisions={subdivisions}
              buttonClassName="w-full sm:w-auto"
            />
            <ImportProjectJobsButton className="w-full sm:w-auto" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          {filteredProjects.length === 0 ? (
            <Card className="p-8">
              <div className="text-sm text-muted-foreground">
                No projects match the current filters.
              </div>
            </Card>
          ) : view === "grouped" ? (
            <div className="space-y-3">
              {groupedProjects.map((subdivisionGroup) => {
                const isSubdivisionExpanded =
                  effectiveExpandedSubdivisions.includes(subdivisionGroup.key);

                return (
                  <Card
                    key={subdivisionGroup.key}
                    className="overflow-hidden border-border"
                  >
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        className="flex flex-1 flex-col items-start gap-2 text-left transition-colors hover:text-primary cursor-pointer sm:flex-row sm:items-center sm:justify-between"
                        onClick={() => toggleSubdivision(subdivisionGroup.key)}
                      >
                        <div className="flex items-center gap-2 cursor-pointer">
                          <ChevronDown
                            className={cn(
                              "size-4 shrink-0 transition-transform cursor-pointer",
                              isSubdivisionExpanded && "rotate-180",
                            )}
                          />
                          <div className="text-base font-semibold ">
                            {subdivisionGroup.label}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground sm:text-right">
                          {subdivisionGroup.projectCount}{" "}
                          {subdivisionGroup.projectCount === 1
                            ? "project"
                            : "projects"}{" "}
                          • {subdivisionGroup.totalJobCount} jobs •{" "}
                          {subdivisionGroup.openJobCount} open
                        </div>
                      </button>
                      <SubdivisionGroupActionsMenu
                        builders={builders}
                        subdivisions={subdivisions}
                        subdivisionId={
                          subdivisionGroup.subdivision_id ?? undefined
                        }
                        subdivisionLabel={subdivisionGroup.label}
                        projectIds={subdivisionGroup.builders.flatMap(
                          (builderGroup) =>
                            builderGroup.streets.flatMap((streetGroup) =>
                              streetGroup.projects.map((project) => project.id),
                            ),
                        )}
                      />
                    </div>

                    {/* User viewing after subdivision selection */}

                    {isSubdivisionExpanded && (
                      <div className="space-y-3 border-t p-3 sm:p-4">
                        {subdivisionGroup.builders.map((builderGroup) => {
                          const isBuilderExpanded =
                            effectiveExpandedBuilders.includes(
                              builderGroup.key,
                            );

                          return (
                            <div key={builderGroup.key} className="space-y-2">
                              <button
                                type="button"
                                className="flex w-full flex-col items-start gap-2 rounded-md border bg-muted/30 p-3 text-left transition-colors hover:bg-muted/50 dark:bg-card/60 dark:hover:bg-card/90 cursor-pointer sm:flex-row sm:items-center sm:justify-between"
                                onClick={() => toggleBuilder(builderGroup.key)}
                              >
                                <div className="flex items-center gap-2">
                                  <ChevronDown
                                    className={cn(
                                      "size-4 shrink-0 transition-transform cursor-pointer",
                                      isBuilderExpanded && "rotate-180",
                                    )}
                                  />
                                  <div className="font-medium">
                                    {builderGroup.label}
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground sm:text-right">
                                  {builderGroup.projectCount}{" "}
                                  {builderGroup.projectCount === 1
                                    ? "project"
                                    : "projects"}{" "}
                                  • {builderGroup.totalJobCount} jobs •{" "}
                                  {builderGroup.openJobCount} open
                                </div>
                              </button>

                              {/* User viewing after builder selection */}
                              {isBuilderExpanded && (
                                <div className="space-y-2 pl-2 sm:pl-5">
                                  {builderGroup.streets.map((streetGroup) => {
                                    const isStreetExpanded =
                                      effectiveExpandedStreets.includes(
                                        streetGroup.key,
                                      );

                                    return (
                                      <div
                                        key={streetGroup.key}
                                        className="space-y-2"
                                      >
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                                          <button
                                            type="button"
                                            className="flex flex-1 flex-col items-start gap-2 rounded-md border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/35 cursor-pointer sm:flex-row sm:items-center sm:justify-between"
                                            onClick={() =>
                                              toggleStreet(streetGroup.key)
                                            }
                                          >
                                            <div className="flex items-center gap-2">
                                              <ChevronDown
                                                className={cn(
                                                  "size-4 shrink-0 transition-transform cursor-pointer",
                                                  isStreetExpanded &&
                                                    "rotate-180",
                                                )}
                                              />
                                              <div className="font-medium">
                                                {streetGroup.label}
                                              </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground sm:text-right">
                                              {streetGroup.projects.length}{" "}
                                              {streetGroup.projects.length === 1
                                                ? "project"
                                                : "projects"}{" "}
                                              • {streetGroup.totalJobCount} jobs
                                              • {streetGroup.openJobCount} open
                                            </div>
                                          </button>
                                          <StreetGroupActionsMenu
                                            builders={builders}
                                            subdivisions={subdivisions}
                                            builderId={
                                              builderGroup.builder_id ??
                                              undefined
                                            }
                                            subdivisionId={
                                              subdivisionGroup.subdivision_id ??
                                              undefined
                                            }
                                            streetAddress={streetGroup.label}
                                            streetLabel={streetGroup.label}
                                            projectIds={streetGroup.projects.map(
                                              (project) => project.id,
                                            )}
                                          />
                                        </div>

                                        {/* Where user views projects via the street. */}
                                        {isStreetExpanded && (
                                          <div className="space-y-2 pl-2 sm:pl-4">
                                            {streetGroup.projects.map(
                                              (project) => {
                                                const isSelected =
                                                  effectiveSelectedProjectId ===
                                                  project.id;
                                                const locationSubtitle =
                                                  getProjectLocationSubtitle(
                                                    project,
                                                  );

                                                return (
                                                  <Card
                                                    key={project.id}
                                                    className={cn(
                                                      "border-border p-3 transition-colors cursor-pointer",
                                                      isSelected
                                                        ? "bg-muted/50 ring-1 ring-border"
                                                        : "hover:bg-muted/50",
                                                    )}
                                                    onClick={() => {
                                                      setSelectedProjectId(
                                                        project.id,
                                                      );
                                                      if (isMobile) {
                                                        router.push(
                                                          `/projects/${project.id}`,
                                                        );
                                                      }
                                                    }}
                                                  >
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                      <div className="min-w-0 space-y-1">
                                                        <div className="break-words font-medium">
                                                          {getProjectStreetTitle(
                                                            project,
                                                          )}
                                                        </div>
                                                        {locationSubtitle ? (
                                                          <div className="text-xs text-muted-foreground">
                                                            {locationSubtitle}
                                                          </div>
                                                        ) : null}
                                                        <div className="text-xs text-muted-foreground">
                                                          {project.job_count}{" "}
                                                          jobs •{" "}
                                                          {
                                                            project.open_job_count
                                                          }{" "}
                                                          open • Last activity{" "}
                                                          {formatRelativeTime(
                                                            project.last_activity_at,
                                                          )}
                                                        </div>
                                                      </div>

                                                      <div className="flex flex-wrap items-center gap-2">
                                                        <ProjectStatusBadges
                                                          project={project}
                                                        />
                                                        <div
                                                          onClick={(event) =>
                                                            event.stopPropagation()
                                                          }
                                                        >
                                                          <ProjectCardActionsDropdown
                                                            project={project}
                                                            builders={builders}
                                                            subdivisions={
                                                              subdivisions
                                                            }
                                                            onViewProject={
                                                              setSelectedProjectId
                                                            }
                                                            onQuickComplete={(
                                                              projectId,
                                                            ) => {
                                                              setSelectedProjectId(
                                                                projectId,
                                                              );
                                                              setQuickCompleteDrawerOpen(
                                                                true,
                                                              );
                                                            }}
                                                          />
                                                        </div>
                                                        <div
                                                          onClick={(event) =>
                                                            event.stopPropagation()
                                                          }
                                                        >
                                                          <DeleteProjectButton
                                                            projectId={
                                                              project.id
                                                            }
                                                          />
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </Card>
                                                );
                                              },
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <>
              <div className="divide-y rounded-xl border bg-card lg:hidden">
                {filteredProjects.map((project) => (
                  <article key={project.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/projects/${project.id}`}
                        className="min-w-0 py-1 font-medium leading-relaxed break-words hover:text-primary"
                        onClick={() => setSelectedProjectId(project.id)}
                      >
                        {getProjectStreetTitle(project)}
                      </Link>
                      <ProjectCardActionsDropdown
                        project={project}
                        builders={builders}
                        subdivisions={subdivisions}
                        onViewProject={setSelectedProjectId}
                        onQuickComplete={(projectId) => {
                          setSelectedProjectId(projectId);
                          setQuickCompleteDrawerOpen(true);
                        }}
                      />
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground break-words">
                      {project.subdivision ?? "No subdivision"}
                      {project.builder_name ?? "Unassigned builder"} ·{" "}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <ProjectStatusBadges project={project} />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {project.job_count - project.open_job_count} /{" "}
                        {project.job_count} jobs complete
                      </span>
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden min-w-0 overflow-hidden rounded-xl border bg-card lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project Address</TableHead>
                      <TableHead>Subdivision / Builder</TableHead>
                      <TableHead>Job Progress</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((project) => (
                      <TableRow
                        key={project.id}
                        data-state={
                          effectiveSelectedProjectId === project.id
                            ? "selected"
                            : undefined
                        }
                        className="cursor-pointer"
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          if (isMobile) router.push(`/projects/${project.id}`);
                        }}
                      >
                        <TableCell>
                          <Link
                            href={`/projects/${project.id}`}
                            className="font-medium text-foreground hover:text-primary hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {getProjectStreetTitle(project)}
                          </Link>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {getProjectLocationSubtitle(project)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{project.subdivision ?? "No subdivision"}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {project.builder_name ?? "Unassigned"}
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {project.job_count - project.open_job_count} /{" "}
                          {project.job_count}
                          <span className="ml-1 text-xs text-muted-foreground">
                            complete
                          </span>
                        </TableCell>
                        <TableCell>
                          <ProjectStatusBadges project={project} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatRelativeTime(project.last_activity_at)}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <ProjectCardActionsDropdown
                            project={project}
                            builders={builders}
                            subdivisions={subdivisions}
                            onViewProject={setSelectedProjectId}
                            onQuickComplete={(projectId) => {
                              setSelectedProjectId(projectId);
                              setQuickCompleteDrawerOpen(true);
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <div className="hidden h-fit space-y-4 xl:sticky xl:top-4 xl:block">
          <Card className="border-border p-5">
            {selectedProject ? (
              <div className="space-y-6">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Selected Project
                  </div>
                  <div className="mt-2 text-xl font-semibold tracking-tight leading-snug">
                    {getProjectStreetTitle(selectedProject)}
                  </div>
                  {getProjectLocationSubtitle(selectedProject) ? (
                    <div className="mt-2 text-sm text-muted-foreground">
                      {getProjectLocationSubtitle(selectedProject)}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-md border border-border bg-muted/30 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-2xl font-semibold leading-none">
                        {selectedProject.job_count}{" "}
                        {selectedProject.job_count === 1 ? "Job" : "Jobs"}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {selectedProject.open_job_count === 0
                          ? "All jobs completed"
                          : `${selectedProject.open_job_count} open job${selectedProject.open_job_count === 1 ? "" : "s"}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Last activity
                      </div>
                      <div className="mt-1 text-xl font-semibold leading-tight">
                        {formatRelativeTime(selectedProject.last_activity_at)}{" "}
                        {formatRelativeTime(selectedProject.created_at) ===
                          "No activity yet" &&
                          "(Created " +
                            formatRelativeTime(selectedProject.created_at) +
                            ")"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    Jobs
                  </div>
                  {isLoadingJobs ? (
                    <div className="animate-pulse rounded-md border border-dashed border-border p-4">
                      <p className="text-sm text-muted-foreground">
                        Loading jobs...
                      </p>
                    </div>
                  ) : (
                    <div className="hidden xl:block">
                      <QuickJobComplete jobs={selectedProjectJobs} />
                    </div>
                  )}
                </div>

                <div className="space-y-3 border-t pt-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    Superintendents / GC:
                  </div>
                  {selectedProject.crew_names.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No Superintendents / GCs assigned.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedProject.crew_names
                        .slice(0, 5)
                        .map((crewName) => (
                          <div
                            key={crewName}
                            className="flex items-center gap-3"
                          >
                            <Avatar size="sm">
                              <AvatarFallback>
                                {toInitials(crewName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-base font-medium">
                              {crewName}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t pt-4 text-sm text-muted-foreground">
                  {getProjectLocationSubtitle(selectedProject) ? (
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4" />
                      Location: {getProjectLocationSubtitle(selectedProject)}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4" />
                    Builder: {selectedProject.builder_name ?? "Unassigned"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Home className="size-4" />
                    Subdivision: {selectedProject.subdivision ?? "Unassigned"}
                  </div>
                  <div className="flex items-center gap-2">
                    <UserRound className="size-4" />
                    Status:
                    <span className="flex flex-wrap items-center gap-2">
                      <ProjectStatusBadges project={selectedProject} />
                    </span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Link
                    href={`/projects/${selectedProject.id}`}
                    className="inline-flex items-center gap-1 text-muted-foreground text-lg font-medium text-gray-500 hover:text-primary dark:text-white dark:hover:text-primary/90 transition delay-100"
                  >
                    View Project
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Select a project to view details.
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Quick Complete Drawer for mobile/card actions */}
      {selectedProjectJobs.length > 0 && (
        <QuickJobDrawer
          jobs={selectedProjectJobs}
          open={quickCompleteDrawerOpen}
          onOpenChange={setQuickCompleteDrawerOpen}
        />
      )}
    </div>
  );
}
